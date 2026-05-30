import type { ContentNode, ExtractionResult, KvsLike } from '@contextractor/crawler';
import { describe, expect, it, vi } from 'vitest';
import { createApifySink } from './sinks.js';

const FAKE_RESULT: ExtractionResult = {
  url: 'https://example.com/page',
  loadedUrl: 'https://example.com/page',
  html: '<html><body>raw</body></html>',
  rawHtmlHash: 'abc123',
  rawHtmlLength: 30,
  metadata: {
    title: 'Test Page',
    author: null,
    publishedAt: null,
    description: null,
    siteName: null,
    languageCode: 'en',
  },
  formats: {
    markdown: '# Test Page',
    txt: 'Test Page',
  },
  crawlDepth: 2,
  referrerUrl: 'https://example.com/',
};

function makeKvs(): KvsLike & { calls: Array<{ key: string; value: string }> } {
  const calls: Array<{ key: string; value: string }> = [];
  return {
    calls,
    async setValue(key: string, value: string) {
      calls.push({ key, value });
    },
  };
}

function makeDataset(): { pushData: ReturnType<typeof vi.fn>; items: unknown[] } {
  const items: unknown[] = [];
  return {
    pushData: vi.fn(async (data: unknown) => {
      items.push(data);
    }),
    items,
  };
}

describe('createApifySink — saveDestination: ["key-value-store"]', () => {
  it('calls KVS setValue for each format; dataset item has reference objects not raw strings', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();

    const sink = createApifySink({
      kvs,
      dataset: dataset as never,
      saveOriginal: false,
      saveDestination: ['key-value-store'],
    });

    await sink(FAKE_RESULT);

    // KVS was called for each format present (markdown, txt)
    expect(kvs.calls.length).toBeGreaterThan(0);

    const item = dataset.items[0] as Record<string, unknown>;
    // markdown is a ContentNode object referencing the blob (has `key`, no `content`)
    expect(typeof item.markdown).toBe('object');
    expect((item.markdown as ContentNode).key).toMatch(/^markdown-[0-9a-f]{32}\.md$/);
    expect((item.markdown as ContentNode).content).toBeUndefined();
    expect((item.original as ContentNode).hash).toBe(FAKE_RESULT.rawHtmlHash);
    expect(item.markdownHash).toBeUndefined();
    expect(item.txtHash).toBeUndefined();
    expect(item.status).toBe('success');
    const crawl = item.crawl as Record<string, unknown>;
    expect(crawl.loadedUrl).toBe(FAKE_RESULT.loadedUrl);
    expect(crawl.httpStatusCode).toBe(200);
    expect(crawl.depth).toBe(2);
    expect(crawl.referrerUrl).toBe('https://example.com/');
    expect(item.loadedUrl).toBeUndefined();
  });

  it('dataset item carries url top-level and loadedUrl under crawl', async () => {
    const redirectedResult: ExtractionResult = {
      ...FAKE_RESULT,
      url: 'https://example.com/old',
      loadedUrl: 'https://example.com/new',
    };
    const kvs = makeKvs();
    const dataset = makeDataset();

    const sink = createApifySink({
      kvs,
      dataset: dataset as never,
      saveOriginal: false,
      saveDestination: ['key-value-store'],
    });

    await sink(redirectedResult);

    const item = dataset.items[0] as Record<string, unknown>;
    expect(item.url).toBe('https://example.com/old');
    expect((item.crawl as Record<string, unknown>).loadedUrl).toBe('https://example.com/new');
  });
});

describe('createApifySink — saveDestination: ["dataset"]', () => {
  it('content appears as inline content nodes on the dataset item; KVS setValue not called', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();

    const sink = createApifySink({
      kvs,
      dataset: dataset as never,
      saveOriginal: false,
      saveDestination: ['dataset'],
    });

    await sink(FAKE_RESULT);

    // No KVS writes for content
    expect(kvs.calls).toHaveLength(0);

    const item = dataset.items[0] as Record<string, unknown>;
    expect(item.url).toBe(FAKE_RESULT.url);
    expect((item.crawl as Record<string, unknown>).loadedUrl).toBe(FAKE_RESULT.loadedUrl);
    expect((item.markdown as ContentNode).content).toBe('# Test Page');
    expect((item.txt as ContentNode).content).toBe('Test Page');
    expect(typeof (item.markdown as ContentNode).bytes).toBe('number');
    expect((item.original as ContentNode).hash).toBe(FAKE_RESULT.rawHtmlHash);
    expect(item.markdownHash).toBeUndefined();
    expect(item.txtHash).toBeUndefined();
    expect(item.status).toBe('success');
    expect((item.crawl as Record<string, unknown>).depth).toBe(2);
  });
});

describe('createApifySink — saveOriginal: true, saveDestination: ["key-value-store"]', () => {
  it('KVS key for raw HTML is original-{md5}.html', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();

    const sink = createApifySink({
      kvs,
      dataset: dataset as never,
      saveOriginal: true,
      saveDestination: ['key-value-store'],
    });

    await sink(FAKE_RESULT);

    const originalCall = kvs.calls.find((c) => c.key.startsWith('original-'));
    expect(originalCall).toBeDefined();
    expect(originalCall?.key).toMatch(/^original-[0-9a-f]{32}\.html$/);
    const item = dataset.items[0] as Record<string, unknown>;
    expect((item.original as { hash: string }).hash).toBe(FAKE_RESULT.rawHtmlHash);
    expect(item.status).toBe('success');
  });
});
