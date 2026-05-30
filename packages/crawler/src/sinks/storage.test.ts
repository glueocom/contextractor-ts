import { describe, expect, it, vi } from 'vitest';
import {
  buildFailedRecord,
  buildSkippedRecord,
  buildSuccessRecord,
  type ContentNode,
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
  it('writes blobs and references them as ContentNodes ({hash, bytes, key})', async () => {
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

    const txt = rec.txt as ContentNode;
    expect(txt.key).toMatch(/^txt-[0-9a-f]{32}\.txt$/);
    expect(typeof txt.hash).toBe('string');
    expect(typeof txt.bytes).toBe('number');
    expect(txt.content).toBeUndefined(); // referenced, not inlined
    expect(txt.url).toBeUndefined();
    expect(rec.txtHash).toBeUndefined(); // no top-level *Hash any more

    const original = rec.original as ContentNode;
    expect(original.key).toMatch(/^original-[0-9a-f]{32}\.html$/);
    expect(original.hash).toBe('rawhash');
    expect(original.bytes).toBe(16);
    expect(rec.originalHash).toBeUndefined();

    const keys = kvs.calls.map((c) => c.key);
    expect(keys.some((k) => k.startsWith('txt-'))).toBe(true);
    expect(keys.some((k) => k.startsWith('markdown-'))).toBe(true);
    expect(keys.some((k) => k.startsWith('original-'))).toBe(true);
  });
});

describe('buildSuccessRecord — dataset only', () => {
  it('inlines content as {hash, bytes, content} and writes nothing to the KVS', async () => {
    const kvs = localKvs();
    const rec = await buildSuccessRecord(RESULT, {
      kvs,
      toKvs: false,
      toDataset: true,
      saveOriginal: true,
    });

    expect(kvs.calls).toHaveLength(0);

    const txt = rec.txt as ContentNode;
    expect(txt.content).toBe('plain');
    expect(typeof txt.hash).toBe('string');
    expect(typeof txt.bytes).toBe('number');
    expect(txt.key).toBeUndefined();
    expect(rec.txtHash).toBeUndefined();

    expect((rec.markdown as ContentNode).content).toBe('# md');
    // original is inlined too (its raw HTML goes into `content`)
    expect(rec.original).toEqual({ hash: 'rawhash', bytes: 16, content: '<html>raw</html>' });
    expect(rec.originalHash).toBeUndefined();
  });
});

describe('buildSuccessRecord — original always present', () => {
  it('emits original as {hash, bytes} even when "original" is not in save', async () => {
    const kvs = localKvs();
    const rec = await buildSuccessRecord(RESULT, {
      kvs,
      toKvs: true,
      toDataset: false,
      saveOriginal: false,
    });

    expect(rec.originalHash).toBeUndefined();
    expect(rec.original).toEqual({ hash: 'rawhash', bytes: 16 });
    expect(kvs.calls.some((c) => c.key.startsWith('original-'))).toBe(false);
  });
});

describe('buildSuccessRecord — both destinations', () => {
  it('inlines all content (dataset precedence), writing nothing to the KVS', async () => {
    const kvs = localKvs();
    const rec = await buildSuccessRecord(RESULT, {
      kvs,
      toKvs: true,
      toDataset: true,
      saveOriginal: true,
    });

    expect(kvs.calls).toHaveLength(0);
    expect((rec.txt as ContentNode).content).toBe('plain');
    expect((rec.original as ContentNode).content).toBe('<html>raw</html>');
    expect((rec.original as ContentNode).key).toBeUndefined();
  });
});

describe('buildSuccessRecord — public URL', () => {
  it('sets ContentNode.url only when the store exposes a public URL', async () => {
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

    expect((platform.txt as ContentNode).url).toMatch(/^https:\/\//);
    expect((local.txt as ContentNode).url).toBeUndefined();
    // Same key and hash regardless of surface — only the url differs.
    expect((platform.txt as ContentNode).key).toBe((local.txt as ContentNode).key);
    expect((platform.txt as ContentNode).hash).toBe((local.txt as ContentNode).hash);
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
