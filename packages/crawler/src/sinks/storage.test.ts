import { describe, expect, it, vi } from 'vitest';
import {
  buildFailedRecord,
  buildSkippedRecord,
  buildSuccessRecord,
  type ContentRef,
  kvsKey,
} from './storage.js';
import type { ExtractionResult } from './types.js';

const RESULT: ExtractionResult = {
  url: 'https://example.com/page',
  loadedUrl: 'https://example.com/page',
  html: '<html>raw</html>',
  rawHtmlHash: 'rawhash',
  rawHtmlLength: 16,
  metadata: {
    title: 'T',
    author: null,
    publishedAt: null,
    description: null,
    siteName: null,
    lang: 'en',
  },
  formats: { txt: 'plain', markdown: '# md' },
  crawlDepth: 1,
  referrerUrl: 'https://example.com/',
};

function localKvs() {
  const calls: Array<{ key: string; value: string; contentType?: string }> = [];
  return {
    calls,
    setValue: vi.fn(async (key: string, value: string, opts?: { contentType?: string }) => {
      calls.push({ key, value, contentType: opts?.contentType });
    }),
  };
}

function platformKvs() {
  return {
    setValue: vi.fn(async () => {}),
    getPublicUrl: (key: string) => `https://api.apify.com/v2/key-value-stores/x/records/${key}`,
  };
}

describe('kvsKey', () => {
  it('builds {prefix}{md5}.{ext} keys per kind', () => {
    expect(kvsKey('txt', RESULT.url)).toMatch(/^txt-[0-9a-f]{32}\.txt$/);
    expect(kvsKey('markdown', RESULT.url)).toMatch(/^markdown-[0-9a-f]{32}\.md$/);
    expect(kvsKey('json', RESULT.url)).toMatch(/^json-[0-9a-f]{32}\.json$/);
    expect(kvsKey('html', RESULT.url)).toMatch(/^html-[0-9a-f]{32}\.html$/);
    expect(kvsKey('original', RESULT.url)).toMatch(/^original-[0-9a-f]{32}\.html$/);
  });

  it('is deterministic per URL', () => {
    expect(kvsKey('txt', RESULT.url)).toBe(kvsKey('txt', RESULT.url));
  });
});

describe('buildSuccessRecord — key-value-store only', () => {
  it('writes blobs and references them as ContentRefs', async () => {
    const kvs = localKvs();
    const rec = await buildSuccessRecord(RESULT, {
      kvs,
      toKvs: true,
      toDataset: false,
      saveOriginal: true,
    });

    expect(rec.status).toBe('success');
    expect(rec.httpStatus).toBe(200);
    expect(rec.loadedAt).toMatch(/Z$/);
    expect(rec.metadata).toEqual(RESULT.metadata);
    expect(rec.crawl).toEqual({ depth: 1, referrerUrl: 'https://example.com/' });

    const txt = rec.txt as ContentRef;
    expect(txt.key).toMatch(/^txt-[0-9a-f]{32}\.txt$/);
    expect(typeof txt.hash).toBe('string');
    expect(txt.url).toBeUndefined();
    expect(rec.txtHash).toBeUndefined();

    const original = rec.original as ContentRef;
    expect(original.key).toMatch(/^original-[0-9a-f]{32}\.html$/);
    expect(original.hash).toBe('rawhash');
    expect(original.length).toBe(16);

    const keys = kvs.calls.map((c) => c.key);
    expect(keys.some((k) => k.startsWith('txt-'))).toBe(true);
    expect(keys.some((k) => k.startsWith('markdown-'))).toBe(true);
    expect(keys.some((k) => k.startsWith('original-'))).toBe(true);
  });
});

describe('buildSuccessRecord — dataset only', () => {
  it('inlines content with per-format hashes and writes nothing to the KVS', async () => {
    const kvs = localKvs();
    const rec = await buildSuccessRecord(RESULT, {
      kvs,
      toKvs: false,
      toDataset: true,
      saveOriginal: true,
    });

    expect(kvs.calls).toHaveLength(0);
    expect(rec.txt).toBe('plain');
    expect(rec.txtHash as string).toHaveLength(32);
    expect(rec.markdown).toBe('# md');
    expect(rec.original).toBe('<html>raw</html>');
  });
});

describe('buildSuccessRecord — both destinations', () => {
  it('inlines formats (dataset precedence) but routes original to the KVS', async () => {
    const kvs = localKvs();
    const rec = await buildSuccessRecord(RESULT, {
      kvs,
      toKvs: true,
      toDataset: true,
      saveOriginal: true,
    });

    expect(rec.txt).toBe('plain'); // inline (dataset wins)
    expect((rec.original as ContentRef).key).toMatch(/^original-[0-9a-f]{32}\.html$/);
    const keys = kvs.calls.map((c) => c.key);
    expect(keys.every((k) => k.startsWith('original-'))).toBe(true);
  });
});

describe('buildSuccessRecord — public URL', () => {
  it('sets ContentRef.url only when the store exposes a public URL', async () => {
    const platform = await buildSuccessRecord(RESULT, {
      kvs: platformKvs(),
      toKvs: true,
      toDataset: false,
      saveOriginal: false,
    });
    const local = await buildSuccessRecord(RESULT, {
      kvs: localKvs(),
      toKvs: true,
      toDataset: false,
      saveOriginal: false,
    });

    expect((platform.txt as ContentRef).url).toMatch(/^https:\/\//);
    expect((local.txt as ContentRef).url).toBeUndefined();
    // Same key and hash regardless of surface — only the url differs.
    expect((platform.txt as ContentRef).key).toBe((local.txt as ContentRef).key);
    expect((platform.txt as ContentRef).hash).toBe((local.txt as ContentRef).hash);
  });
});

describe('buildFailedRecord / buildSkippedRecord', () => {
  it('assembles a failed record', () => {
    const rec = buildFailedRecord({
      url: 'https://example.com/x',
      loadedUrl: null,
      errorMessages: ['boom'],
      retryCount: 2,
    });
    expect(rec).toMatchObject({
      url: 'https://example.com/x',
      loadedUrl: null,
      status: 'failed',
      errorMessages: ['boom'],
      retryCount: 2,
    });
    expect(rec.crawledAt as string).toMatch(/Z$/);
  });

  it('assembles a skipped record', () => {
    expect(buildSkippedRecord('https://example.com/x', 'robotsTxt')).toEqual({
      url: 'https://example.com/x',
      status: 'skipped',
      skipReason: 'robotsTxt',
    });
  });
});
