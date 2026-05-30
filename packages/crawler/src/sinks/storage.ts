import { createHash } from 'node:crypto';
import { computeContentInfo, type OutputFormat } from '@contextractor/extraction';
import type { ExtractionResult } from './types.js';

/** A content kind written to the key-value store: an output format, or the raw original HTML. */
export type ContentKind = OutputFormat | 'original';

interface KvsSpec {
  ext: string;
  contentType: string;
  keyPrefix: string;
}

/**
 * Per-kind key-value-store metadata. The `keyPrefix` values MUST match the
 * `KvsCollections` keyPrefixes in `@contextractor/schema`; a test asserts this.
 */
const KVS_SPECS: Record<ContentKind, KvsSpec> = {
  txt: { ext: 'txt', contentType: 'text/plain; charset=utf-8', keyPrefix: 'txt-' },
  markdown: { ext: 'md', contentType: 'text/markdown; charset=utf-8', keyPrefix: 'markdown-' },
  json: { ext: 'json', contentType: 'application/json; charset=utf-8', keyPrefix: 'json-' },
  html: { ext: 'html', contentType: 'text/html; charset=utf-8', keyPrefix: 'html-' },
  original: { ext: 'html', contentType: 'text/html; charset=utf-8', keyPrefix: 'original-' },
};

/** Output formats written from `result.formats` (everything except the raw original HTML). */
const CONTENT_FORMATS: readonly OutputFormat[] = ['txt', 'markdown', 'json', 'html'];

/** A reference to a content blob stored in the key-value store. */
export interface ContentRef {
  hash: string;
  length: number;
  key?: string;
  url?: string;
}

/** Minimal key-value-store surface shared by the Apify SDK and Crawlee stores. */
export interface KvsLike {
  setValue(key: string, value: string, options?: { contentType?: string }): Promise<void>;
  getPublicUrl?(key: string): string | Promise<string>;
}

/** Deterministic KVS key for a content blob: `{keyPrefix}{md5(url)}.{ext}`. */
export function kvsKey(kind: ContentKind, url: string): string {
  const spec = KVS_SPECS[kind];
  const hash = createHash('md5').update(url).digest('hex');
  return `${spec.keyPrefix}${hash}.${spec.ext}`;
}

/**
 * Write a content blob to the key-value store and return a `ContentRef`. `url`
 * is set only when the store exposes a public URL (the Apify platform); local
 * Crawlee storage has none, so `url` is omitted there.
 */
async function putBlob(
  kvs: KvsLike,
  kind: ContentKind,
  url: string,
  content: string,
  info: { hash: string; length: number },
): Promise<ContentRef> {
  const spec = KVS_SPECS[kind];
  const key = kvsKey(kind, url);
  await kvs.setValue(key, content, { contentType: spec.contentType });
  const ref: ContentRef = { hash: info.hash, length: info.length, key };
  if (kvs.getPublicUrl) {
    const publicUrl = await kvs.getPublicUrl(key);
    if (publicUrl) ref.url = publicUrl;
  }
  return ref;
}

export interface BuildSuccessRecordOpts {
  kvs: KvsLike;
  toKvs: boolean;
  toDataset: boolean;
  saveOriginal: boolean;
}

/**
 * Assemble the `status: 'success'` dataset record for one extracted page,
 * shared by the Apify Actor and the standalone CLI/lib so their records are
 * identical. When a format goes to the dataset it is inlined as a string plus a
 * `{fmt}Hash`; when it goes only to the key-value store it is a `ContentRef`.
 *
 * Precedence when both destinations are selected is intentionally asymmetric:
 * the extracted formats prefer the dataset (inline), while `original` prefers
 * the key-value store (a reference) to avoid inlining large raw HTML into every
 * dataset record.
 */
export async function buildSuccessRecord(
  result: ExtractionResult,
  opts: BuildSuccessRecordOpts,
): Promise<Record<string, unknown>> {
  const { kvs, toKvs, toDataset, saveOriginal } = opts;

  const data: Record<string, unknown> = {
    url: result.url,
    loadedUrl: result.loadedUrl,
    status: 'success',
    loadedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    metadata: result.metadata,
    httpStatus: 200,
    originalHash: result.rawHtmlHash,
    crawl: { depth: result.crawlDepth, referrerUrl: result.referrerUrl },
  };

  if (saveOriginal) {
    if (toKvs) {
      data.original = await putBlob(kvs, 'original', result.url, result.html, {
        hash: result.rawHtmlHash,
        length: result.rawHtmlLength,
      });
    } else if (toDataset) {
      data.original = result.html;
    }
  }

  for (const fmt of CONTENT_FORMATS) {
    const content = result.formats[fmt];
    if (content === undefined) continue;

    if (toDataset) {
      data[fmt] = content;
      data[`${fmt}Hash`] = computeContentInfo(content).hash;
    } else if (toKvs) {
      data[fmt] = await putBlob(kvs, fmt, result.url, content, computeContentInfo(content));
    }
  }

  return data;
}

export interface FailedRequestInfo {
  url: string;
  loadedUrl: string | null;
  errorMessages: string[];
  retryCount: number;
}

/** Assemble the `status: 'failed'` dataset record. Shared across surfaces. */
export function buildFailedRecord(info: FailedRequestInfo): Record<string, unknown> {
  return {
    url: info.url,
    loadedUrl: info.loadedUrl,
    status: 'failed',
    errorMessages: info.errorMessages,
    retryCount: info.retryCount,
    crawledAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };
}

/** Assemble the `status: 'skipped'` dataset record. Shared across surfaces. */
export function buildSkippedRecord(url: string, skipReason: string): Record<string, unknown> {
  return { url, status: 'skipped', skipReason };
}
