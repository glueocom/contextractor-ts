import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';

const METADATA_FILE = '__metadata__.json';

export interface KvsMetadataFile {
  name: string;
  createdAt: string;
  modifiedAt: string;
  accessedAt: string;
}

export interface KvsRecord {
  value: Buffer;
  contentType: string;
}

export interface KvsKeyInfo {
  key: string;
  size: number;
  contentType: string;
}

export interface ListKeysResult {
  items: KvsKeyInfo[];
  count: number;
  isTruncated: boolean;
  nextExclusiveStartKey: string | undefined;
}

function contentTypeToExtension(contentType: string): string {
  const ext = mime.extension(contentType);
  if (ext) return `.${ext}`;
  // Fallback for common types the mime-types package might not cover.
  if (contentType.includes('json')) return '.json';
  if (contentType.includes('html')) return '.html';
  if (contentType.includes('text')) return '.txt';
  return '.bin';
}

function extensionToContentType(ext: string): string {
  const ct = mime.lookup(ext);
  return ct || 'application/octet-stream';
}

/**
 * Mutable key-value store backed by per-record files on disk.
 *
 * Layout (Crawlee/Apify compatible):
 *   <storageDir>/key_value_stores/<name>/
 *     __metadata__.json
 *     INPUT.json
 *     OUTPUT.json
 *     <key>.<ext>       — extension derived from MIME type
 */
export class KeyValueStore {
  readonly dir: string;
  readonly name: string;

  constructor(storageDir: string, name: string) {
    this.name = name;
    this.dir = path.join(storageDir, 'key_value_stores', name);
  }

  async setValue(
    key: string,
    value: unknown,
    contentType = 'application/json; charset=utf-8',
  ): Promise<void> {
    await this.ensureDir();

    const ext = contentTypeToExtension(contentType);
    const filePath = path.join(this.dir, `${key}${ext}`);
    const tmp = `${filePath}.${randomBytes(8).toString('hex')}.tmp`;

    let data: Buffer;
    if (Buffer.isBuffer(value)) {
      data = value;
    } else if (typeof value === 'string') {
      data = Buffer.from(value, 'utf8');
    } else {
      data = Buffer.from(JSON.stringify(value), 'utf8');
    }

    await writeFile(tmp, data);
    await rename(tmp, filePath);

    const meta = await this.readMetadata();
    const now = new Date().toISOString();
    await this.writeMetadata({ ...meta, modifiedAt: now, accessedAt: now });
  }

  async getValue(key: string): Promise<KvsRecord | null> {
    if (!existsSync(this.dir)) return null;

    const entries = await readdir(this.dir);
    const matchingEntry = entries.find((entry) => {
      const base = path.basename(entry, path.extname(entry));
      return base === key && entry !== METADATA_FILE;
    });

    if (!matchingEntry) return null;

    const filePath = path.join(this.dir, matchingEntry);
    const value = await readFile(filePath);
    const contentType = extensionToContentType(path.extname(matchingEntry));

    return { value, contentType };
  }

  async deleteValue(key: string): Promise<void> {
    if (!existsSync(this.dir)) return;

    const entries = await readdir(this.dir);
    const matchingEntry = entries.find((entry) => {
      const base = path.basename(entry, path.extname(entry));
      return base === key && entry !== METADATA_FILE;
    });

    if (!matchingEntry) return;

    await unlink(path.join(this.dir, matchingEntry));
  }

  async listKeys(
    opts: { limit?: number; exclusiveStartKey?: string } = {},
  ): Promise<ListKeysResult> {
    if (!existsSync(this.dir)) {
      return { items: [], count: 0, isTruncated: false, nextExclusiveStartKey: undefined };
    }

    const entries = await readdir(this.dir);
    const keyFiles = entries.filter((e) => e !== METADATA_FILE && !e.endsWith('.tmp')).sort();

    // Apply exclusiveStartKey pagination.
    let startIdx = 0;
    if (opts.exclusiveStartKey) {
      const pos = keyFiles.findIndex((e) => {
        const base = path.basename(e, path.extname(e));
        return base === opts.exclusiveStartKey;
      });
      startIdx = pos >= 0 ? pos + 1 : 0;
    }

    const limit = opts.limit ?? keyFiles.length;
    const slice = keyFiles.slice(startIdx, startIdx + limit);
    const isTruncated = startIdx + limit < keyFiles.length;
    const nextExclusiveStartKey = isTruncated
      ? path.basename(
          keyFiles[startIdx + limit - 1] ?? '',
          path.extname(keyFiles[startIdx + limit - 1] ?? ''),
        ) || undefined
      : undefined;

    const statPromises = slice.map(async (entry): Promise<KvsKeyInfo> => {
      const filePath = path.join(this.dir, entry);
      const buf = await readFile(filePath);
      return {
        key: path.basename(entry, path.extname(entry)),
        size: buf.length,
        contentType: extensionToContentType(path.extname(entry)),
      };
    });

    const items = await Promise.all(statPromises);
    return { items, count: items.length, isTruncated, nextExclusiveStartKey };
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
      });
    }
  }

  private async readMetadata(): Promise<KvsMetadataFile> {
    const metaPath = path.join(this.dir, METADATA_FILE);
    if (!existsSync(metaPath)) {
      return {
        name: this.name,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
      };
    }
    const raw = await readFile(metaPath, 'utf8');
    return JSON.parse(raw) as KvsMetadataFile;
  }

  private async writeMetadata(meta: KvsMetadataFile): Promise<void> {
    const metaPath = path.join(this.dir, METADATA_FILE);
    const tmp = `${metaPath}.${randomBytes(8).toString('hex')}.tmp`;
    await writeFile(tmp, JSON.stringify(meta, null, 2), 'utf8');
    await rename(tmp, metaPath);
  }
}
