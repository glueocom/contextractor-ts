import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, open, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface DatasetMetadataFile {
  name: string;
  createdAt: string;
  modifiedAt: string;
  accessedAt: string;
  itemCount: number;
}

export interface GetItemsOptions {
  offset?: number;
  limit?: number;
  desc?: boolean;
}

export interface GetItemsResult {
  items: unknown[];
  total: number;
  offset: number;
  limit: number;
  count: number;
}

const METADATA_FILE = '__metadata__.json';
const INDEX_DIGITS = 9;

function indexToFilename(index: number): string {
  return `${String(index).padStart(INDEX_DIGITS, '0')}.json`;
}

/**
 * Append-only dataset backed by per-item JSON files on disk.
 *
 * Layout (Crawlee/Apify compatible):
 *   <storageDir>/datasets/<name>/
 *     __metadata__.json
 *     000000000.json
 *     000000001.json
 *     …
 *
 * Concurrent appenders coordinate via __metadata__.json:
 * each writer reads itemCount, claims the next sequential index, writes the
 * item file, then updates metadata atomically (write to .tmp, then rename).
 * On contention the writer retries with jittered backoff up to MAX_RETRIES
 * times. This is safe for the low-concurrency CLI use case; the worst
 * outcome of a collision is a retry (never data loss).
 */
export class Dataset {
  readonly dir: string;
  readonly name: string;

  constructor(storageDir: string, name: string) {
    this.name = name;
    this.dir = path.join(storageDir, 'datasets', name);
  }

  /** Push one item or an array of items. Returns the assigned indexes. */
  async pushData(item: unknown | unknown[]): Promise<number[]> {
    const items = Array.isArray(item) ? item : [item];
    const indexes: number[] = [];

    for (const it of items) {
      const idx = await this.appendItem(it);
      indexes.push(idx);
    }

    return indexes;
  }

  async getItems(opts: GetItemsOptions = {}): Promise<GetItemsResult> {
    if (!existsSync(this.dir)) {
      return { items: [], total: 0, offset: 0, limit: opts.limit ?? 0, count: 0 };
    }

    // Count actual item files on disk (not just metadata.itemCount) so that
    // concurrent writers that raced on the metadata counter don't cause missing
    // records. The metadata counter is a best-effort cache; the files are ground truth.
    const entries = await readdir(this.dir);
    const itemFiles = entries.filter((e) => /^\d{9}\.json$/.test(e)).sort();
    const total = itemFiles.length;

    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? total;

    let indices = Array.from({ length: total }, (_, i) => i);
    if (opts.desc) indices = indices.reverse();

    const slice = indices.slice(offset, offset + limit);
    const items: unknown[] = [];

    for (const idx of slice) {
      const filename = itemFiles[idx];
      if (!filename) continue;
      const file = path.join(this.dir, filename);
      const raw = await readFile(file, 'utf8');
      items.push(JSON.parse(raw) as unknown);
    }

    return { items, total, offset, limit, count: items.length };
  }

  async count(): Promise<number> {
    if (!existsSync(this.dir)) return 0;
    const entries = await readdir(this.dir);
    return entries.filter((e) => /^\d{9}\.json$/.test(e)).length;
  }

  async metadata(): Promise<DatasetMetadataFile> {
    await this.ensureDir();
    return this.readMetadata();
  }

  async drop(): Promise<void> {
    if (!existsSync(this.dir)) return;
    await rm(this.dir, { recursive: true, force: true });
  }

  // Private helpers

  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const metaPath = path.join(this.dir, METADATA_FILE);
    if (!existsSync(metaPath)) {
      await this.writeMetadata({
        name: this.name,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        itemCount: 0,
      });
    }
  }

  private async readMetadata(): Promise<DatasetMetadataFile> {
    const metaPath = path.join(this.dir, METADATA_FILE);
    if (!existsSync(metaPath)) {
      return {
        name: this.name,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        itemCount: 0,
      };
    }
    const raw = await readFile(metaPath, 'utf8');
    return JSON.parse(raw) as DatasetMetadataFile;
  }

  private async writeMetadata(meta: DatasetMetadataFile): Promise<void> {
    const metaPath = path.join(this.dir, METADATA_FILE);
    // Use a unique tmp name to avoid collisions between concurrent writers.
    const tmp = `${metaPath}.${randomBytes(8).toString('hex')}.tmp`;
    await writeFile(tmp, JSON.stringify(meta, null, 2), 'utf8');
    await rename(tmp, metaPath);
  }

  /**
   * Appends a single item. Returns the index it was assigned.
   *
   * Strategy: scan for the next available sequential index and attempt to
   * create the item file with O_EXCL (exclusive create). If another concurrent
   * writer already claimed that slot, increment and retry. This is the
   * standard POSIX lock-free atomic-file-claim pattern; the kernel guarantees
   * that only one opener wins on O_EXCL even across processes.
   */
  private async appendItem(item: unknown): Promise<number> {
    await this.ensureDir();

    const MAX_RETRIES = 20;
    const data = JSON.stringify(item);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Count existing files each attempt so we always start from the right
      // next candidate after another writer claimed a slot.
      const entries = await readdir(this.dir);
      const existingFiles = entries.filter((e) => /^\d{9}\.json$/.test(e));
      const idx = existingFiles.length;

      const itemPath = path.join(this.dir, indexToFilename(idx));

      // Claim the slot atomically with O_EXCL: fails with EEXIST if taken.
      let fh: Awaited<ReturnType<typeof open>> | undefined;
      try {
        fh = await open(itemPath, 'wx');
      } catch (err) {
        // EEXIST means another writer just took this slot; retry.
        if (isErrnoError(err) && err.code === 'EEXIST') {
          await jitter(2 + attempt);
          continue;
        }
        throw err;
      }

      try {
        await fh.writeFile(data, 'utf8');
      } finally {
        await fh.close();
      }

      // Best-effort metadata update (not critical: getItems counts files).
      const meta = await this.readMetadata();
      const now = new Date().toISOString();
      try {
        await this.writeMetadata({
          ...meta,
          modifiedAt: now,
          accessedAt: now,
          itemCount: idx + 1,
        });
      } catch {
        // Metadata write failure is non-fatal; file is already written.
      }

      return idx;
    }

    throw new Error(`Failed to claim a dataset slot after ${MAX_RETRIES} attempts`);
  }
}

function jitter(maxMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.random() * maxMs));
}

function isErrnoError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
