import type { ExtractionResult } from '@contextractor/crawler';
import { describe, expect, it, vi } from 'vitest';
import type { KvsLike } from './extraction.js';
import { createApifySink } from './sinks.js';

const FAKE_RESULT: ExtractionResult = {
  url: 'https://example.com/page',
  html: '<html><body>raw</body></html>',
  rawHtmlHash: 'abc123',
  rawHtmlLength: 30,
  metadata: {
    title: 'Test Page',
    author: null,
    publishedAt: null,
    description: null,
    siteName: null,
    lang: 'en',
  },
  formats: {
    markdown: '# Test Page',
    txt: 'Test Page',
  },
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
    // The data key for markdown should be a ContentInfo object (has `hash`), not a raw string
    expect(typeof item.markdown).toBe('object');
    expect(item.markdown).not.toBe('# Test Page');
  });
});

describe('createApifySink — saveDestination: ["dataset"]', () => {
  it('content appears as inline strings on the dataset item; KVS setValue not called for content', async () => {
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
    expect(item.markdown).toBe('# Test Page');
    expect(item.txt).toBe('Test Page');
  });
});

describe('createApifySink — saveOriginal: true, saveDestination: ["key-value-store"]', () => {
  it('KVS key for raw HTML is ${keyBase}-original.html', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();

    const sink = createApifySink({
      kvs,
      dataset: dataset as never,
      saveOriginal: true,
      saveDestination: ['key-value-store'],
    });

    await sink(FAKE_RESULT);

    const originalCall = kvs.calls.find((c) => c.key.endsWith('-original.html'));
    expect(originalCall).toBeDefined();
    expect(originalCall?.key).toMatch(/-original\.html$/);
    // Confirm the old key pattern is not used
    const oldKeyCall = kvs.calls.find((c) => c.key.endsWith('-raw.html'));
    expect(oldKeyCall).toBeUndefined();
  });
});
