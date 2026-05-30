import type { ContentNode, ExtractionResult } from '@contextractor/crawler';
import { describe, expect, it, vi } from 'vitest';
import { createCrawleeStorageSink } from './sinks.js';

const BASE_RESULT: ExtractionResult = {
  url: 'https://example.com/page',
  loadedUrl: 'https://example.com/page',
  html: '<html>raw</html>',
  rawHtmlHash: 'abc',
  rawHtmlLength: 10,
  metadata: {
    title: 'Test',
    author: null,
    publishedAt: null,
    description: null,
    siteName: null,
    lang: null,
  },
  formats: { txt: 'Hello world', markdown: '# Hello world' },
  crawlDepth: 0,
  referrerUrl: null,
};

function makeKvs() {
  const calls: Array<{ key: string; value: unknown; contentType?: string }> = [];
  return {
    calls,
    setValue: vi.fn(async (key: string, value: unknown, opts?: { contentType?: string }) => {
      calls.push({ key, value, contentType: opts?.contentType });
    }),
  };
}

function makeDataset() {
  const items: unknown[] = [];
  return {
    items,
    pushData: vi.fn(async (data: unknown) => {
      items.push(data);
    }),
  };
}

describe('createCrawleeStorageSink — KVS destination', () => {
  it('writes content to KVS under {fmt}-{md5}.{ext} keys and pushes a record of content nodes', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();
    const sink = createCrawleeStorageSink({
      destinations: ['key-value-store'],
      kvs: kvs as never,
      dataset: dataset as never,
      formats: ['txt', 'markdown'],
    });

    await sink(BASE_RESULT);

    const keys = kvs.calls.map((c) => c.key);
    expect(keys.some((k) => /^txt-[0-9a-f]{32}\.txt$/.test(k))).toBe(true);
    expect(keys.some((k) => /^markdown-[0-9a-f]{32}\.md$/.test(k))).toBe(true);

    // KVS-only still pushes a dataset record, with content as ContentNode objects.
    expect(dataset.items).toHaveLength(1);
    const item = dataset.items[0] as Record<string, unknown>;
    const txt = item.txt as ContentNode;
    expect(typeof txt).toBe('object');
    expect(txt.key).toMatch(/^txt-[0-9a-f]{32}\.txt$/);
    expect(typeof txt.hash).toBe('string');
    expect(typeof txt.bytes).toBe('number');
    expect(txt.content).toBeUndefined(); // referenced, not inlined
    expect(txt.url).toBeUndefined(); // no public URL for local Crawlee storage
    expect(item.txtHash).toBeUndefined(); // no top-level *Hash
  });

  it('writes original HTML to KVS under an original-{md5}.html key', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();
    const sink = createCrawleeStorageSink({
      destinations: ['key-value-store'],
      kvs: kvs as never,
      dataset: dataset as never,
      formats: ['txt', 'original'],
    });

    await sink(BASE_RESULT);

    const originalCall = kvs.calls.find((c) => /^original-[0-9a-f]{32}\.html$/.test(c.key));
    expect(originalCall).toBeDefined();
    expect(originalCall?.value).toBe('<html>raw</html>');
    const item = dataset.items[0] as Record<string, unknown>;
    expect((item.original as Record<string, unknown>).key).toMatch(/^original-[0-9a-f]{32}\.html$/);
  });

  it('sets correct content-type for txt', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();
    const sink = createCrawleeStorageSink({
      destinations: ['key-value-store'],
      kvs: kvs as never,
      dataset: dataset as never,
      formats: ['txt'],
    });

    await sink(BASE_RESULT);

    const call = kvs.calls.find((c) => c.key.endsWith('.txt'));
    expect(call?.contentType).toContain('text/plain');
  });
});

describe('createCrawleeStorageSink — dataset destination', () => {
  it('pushes a record with envelope, nested metadata and inline content nodes', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();
    const sink = createCrawleeStorageSink({
      destinations: ['dataset'],
      kvs: kvs as never,
      dataset: dataset as never,
      formats: ['txt'],
    });

    await sink(BASE_RESULT);

    expect(kvs.setValue).not.toHaveBeenCalled();
    expect(dataset.items).toHaveLength(1);
    const item = dataset.items[0] as Record<string, unknown>;
    expect(item.url).toBe(BASE_RESULT.url);
    expect(item.loadedUrl).toBe(BASE_RESULT.loadedUrl);
    expect(item.status).toBe('success');
    expect(item.loadedAt).toMatch(/Z$/);
    expect(item.httpStatus).toBe(200);
    // original (not in save here) is a {hash, bytes} reference — no content/key.
    expect(item.originalHash).toBeUndefined();
    expect(item.original).toEqual({
      hash: BASE_RESULT.rawHtmlHash,
      bytes: BASE_RESULT.rawHtmlLength,
    });
    expect(item.crawl).toEqual({ depth: 0, referrerUrl: null });
    // Metadata is nested, not spread at the top level.
    expect((item.metadata as Record<string, unknown>).title).toBe('Test');
    expect(item.title).toBeUndefined();
    // Inline content node: { hash, bytes, content }.
    const txt = item.txt as ContentNode;
    expect(txt.content).toBe('Hello world');
    expect(typeof txt.bytes).toBe('number');
    expect(item.txtHash).toBeUndefined();
  });

  it('url and loadedUrl are distinct when redirected', async () => {
    const redirectedResult: ExtractionResult = {
      ...BASE_RESULT,
      url: 'https://example.com/old',
      loadedUrl: 'https://example.com/new',
    };
    const kvs = makeKvs();
    const dataset = makeDataset();
    const sink = createCrawleeStorageSink({
      destinations: ['dataset'],
      kvs: kvs as never,
      dataset: dataset as never,
      formats: ['txt'],
    });

    await sink(redirectedResult);

    const item = dataset.items[0] as Record<string, unknown>;
    expect(item.url).toBe('https://example.com/old');
    expect(item.loadedUrl).toBe('https://example.com/new');
  });
});

describe('createCrawleeStorageSink — both destinations', () => {
  it('inlines extracted formats into the dataset (dataset precedence), skipping KVS', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();
    const sink = createCrawleeStorageSink({
      destinations: ['key-value-store', 'dataset'],
      kvs: kvs as never,
      dataset: dataset as never,
      formats: ['txt'],
    });

    await sink(BASE_RESULT);

    expect(kvs.calls).toHaveLength(0);
    expect(dataset.items).toHaveLength(1);
    const item = dataset.items[0] as Record<string, unknown>;
    expect((item.txt as ContentNode).content).toBe('Hello world');
  });

  it('inlines original too (dataset precedence), skipping KVS', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();
    const sink = createCrawleeStorageSink({
      destinations: ['key-value-store', 'dataset'],
      kvs: kvs as never,
      dataset: dataset as never,
      formats: ['txt', 'original'],
    });

    await sink(BASE_RESULT);

    expect(kvs.calls).toHaveLength(0);
    const item = dataset.items[0] as Record<string, unknown>;
    expect((item.txt as ContentNode).content).toBe('Hello world');
    expect((item.original as ContentNode).content).toBe('<html>raw</html>');
    expect((item.original as ContentNode).key).toBeUndefined();
  });
});

describe('createCrawleeStorageSink — error isolation', () => {
  it('logs stderr and resolves when a KVS write fails', async () => {
    const kvs = {
      setValue: vi.fn().mockRejectedValue(new Error('disk full')),
    };
    const dataset = makeDataset();
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const sink = createCrawleeStorageSink({
      destinations: ['key-value-store'],
      kvs: kvs as never,
      dataset: dataset as never,
      formats: ['txt'],
    });

    await expect(sink(BASE_RESULT)).resolves.toBeUndefined();
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('disk full'));
    // The KVS write failed mid-build, so no record is pushed for this page.
    expect(dataset.items).toHaveLength(0);

    stderrSpy.mockRestore();
  });
});
