import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ExtractionResult } from '@contextractor/crawler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCliSink, createCrawleeStorageSink } from './sinks.js';

const BASE_RESULT: ExtractionResult = {
  url: 'https://example.com/page',
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
};

// --- createCrawleeStorageSink ---

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
  it('writes txt and markdown to KVS with correct keys', async () => {
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
    expect(keys).toContain('example-com-page.txt');
    expect(keys).toContain('example-com-page.md');
    expect(dataset.pushData).not.toHaveBeenCalled();
  });

  it('writes original HTML to KVS with -original.html key', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();
    const resultWithOriginal: ExtractionResult = { ...BASE_RESULT };
    const sink = createCrawleeStorageSink({
      destinations: ['key-value-store'],
      kvs: kvs as never,
      dataset: dataset as never,
      formats: ['original'],
    });

    await sink(resultWithOriginal);

    const keys = kvs.calls.map((c) => c.key);
    expect(keys).toContain('example-com-page-original.html');
    expect(kvs.calls[0]?.value).toBe('<html>raw</html>');
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
  it('pushes a record with url and format content', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();
    const sink = createCrawleeStorageSink({
      destinations: ['dataset'],
      kvs: kvs as never,
      dataset: dataset as never,
      formats: ['txt'],
    });

    await sink(BASE_RESULT);

    expect(dataset.items).toHaveLength(1);
    const item = dataset.items[0] as Record<string, unknown>;
    expect(item.url).toBe(BASE_RESULT.url);
    expect(item.txt).toBe('Hello world');
    expect(kvs.setValue).not.toHaveBeenCalled();
    expect(item.originalHash).toBe(BASE_RESULT.rawHtmlHash);
    expect(typeof item.txtHash).toBe('string');
    expect(item.txtHash as string).toHaveLength(32);
  });

  it('includes metadata fields in dataset record', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();
    const sink = createCrawleeStorageSink({
      destinations: ['dataset'],
      kvs: kvs as never,
      dataset: dataset as never,
      formats: ['txt'],
    });

    await sink(BASE_RESULT);

    const item = dataset.items[0] as Record<string, unknown>;
    expect(item.title).toBe('Test');
    expect(item.originalHash).toBe(BASE_RESULT.rawHtmlHash);
  });

  it('saves per-format hashes alongside content, no hash for absent formats', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();
    const sink = createCrawleeStorageSink({
      destinations: ['dataset'],
      kvs: kvs as never,
      dataset: dataset as never,
      formats: ['txt', 'markdown'],
    });

    await sink(BASE_RESULT);

    const item = dataset.items[0] as Record<string, unknown>;
    expect(typeof item.txtHash).toBe('string');
    expect(item.txtHash as string).toHaveLength(32);
    expect(typeof item.markdownHash).toBe('string');
    expect(item.markdownHash as string).toHaveLength(32);
    expect(item.jsonHash).toBeUndefined();
    expect(item.htmlHash).toBeUndefined();
  });
});

describe('createCrawleeStorageSink — both destinations', () => {
  it('writes to both KVS and dataset', async () => {
    const kvs = makeKvs();
    const dataset = makeDataset();
    const sink = createCrawleeStorageSink({
      destinations: ['key-value-store', 'dataset'],
      kvs: kvs as never,
      dataset: dataset as never,
      formats: ['txt'],
    });

    await sink(BASE_RESULT);

    expect(kvs.calls.length).toBeGreaterThan(0);
    expect(dataset.items.length).toBeGreaterThan(0);
  });
});

describe('createCrawleeStorageSink — error isolation', () => {
  it('logs stderr and continues when KVS write fails', async () => {
    const kvs = {
      setValue: vi.fn().mockRejectedValue(new Error('disk full')),
    };
    const dataset = makeDataset();
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const sink = createCrawleeStorageSink({
      destinations: ['key-value-store', 'dataset'],
      kvs: kvs as never,
      dataset: dataset as never,
      formats: ['txt'],
    });

    await expect(sink(BASE_RESULT)).resolves.toBeUndefined();
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('disk full'));
    expect(dataset.items).toHaveLength(1);

    stderrSpy.mockRestore();
  });
});

// --- createCliSink ---

describe('createCliSink', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'standalone-sinks-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes txt file when format is txt', async () => {
    const sink = createCliSink({ outDir: tmpDir, formats: ['txt'] });
    await sink(BASE_RESULT);
    const slug = 'example-com-page';
    const content = readFileSync(path.join(tmpDir, `${slug}.txt`), 'utf8');
    expect(content).toContain('Hello world');
  });

  it('writes raw HTML file for original format', async () => {
    const sink = createCliSink({ outDir: tmpDir, formats: ['original'] });
    await sink(BASE_RESULT);
    const slug = 'example-com-page';
    const content = readFileSync(path.join(tmpDir, `${slug}-raw.html`), 'utf8');
    expect(content).toBe('<html>raw</html>');
  });
});
