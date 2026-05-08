import { existsSync, realpathSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ExtractionResult } from '@contextractor/crawler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCliSink } from './sinks.js';
import type { Dataset } from './storage/dataset.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = realpathSync(await mkdtemp(path.join(tmpdir(), 'ctx-cli-sink-')));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

const BASE_RESULT: ExtractionResult = {
  url: 'https://example.com/article',
  html: '<html><body>raw</body></html>',
  rawHtmlHash: 'deadbeef',
  rawHtmlLength: 30,
  metadata: {
    title: 'Test Article',
    author: 'Author Name',
    publishedAt: '2026-01-01',
    description: null,
    siteName: null,
    lang: 'en',
  },
  formats: {
    markdown: '# Test Article',
    txt: 'Test Article',
  },
};

function makeDataset(): Dataset {
  return {
    pushData: vi.fn(async () => []),
  } as unknown as Dataset;
}

describe('createCliSink — markdown format', () => {
  it('writes a .md file to outDir', async () => {
    const outDir = path.join(tmpDir, 'out');
    const sink = createCliSink({ outDir, formats: ['markdown'], noStdout: true });
    await sink(BASE_RESULT);

    const files = await import('node:fs/promises').then((m) => m.readdir(outDir));
    expect(files.some((f) => f.endsWith('.md'))).toBe(true);
  });

  it('writes a dataset record when dataset is provided', async () => {
    const outDir = path.join(tmpDir, 'out');
    const dataset = makeDataset();
    const sink = createCliSink({ outDir, formats: ['markdown'], dataset, noStdout: true });
    await sink(BASE_RESULT);

    expect(dataset.pushData).toHaveBeenCalledOnce();
    const call = (dataset.pushData as ReturnType<typeof vi.fn>).mock.calls[0];
    const record = call?.[0] as Record<string, unknown>;
    expect(record.url).toBe(BASE_RESULT.url);
    expect(record.markdown).toBe('# Test Article');
  });
});

describe('createCliSink — jsonl format', () => {
  it('writes output.jsonl to outDir', async () => {
    const outDir = path.join(tmpDir, 'out');
    const sink = createCliSink({ outDir, formats: ['jsonl'], noStdout: true });
    await sink(BASE_RESULT);

    const jsonlFile = path.join(outDir, 'output.jsonl');
    expect(existsSync(jsonlFile)).toBe(true);
    const lines = (await readFile(jsonlFile, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(parsed.url).toBe(BASE_RESULT.url);
  });

  it('appends subsequent records to the same jsonl file', async () => {
    const outDir = path.join(tmpDir, 'out');
    const sink = createCliSink({ outDir, formats: ['jsonl'], noStdout: true });
    await sink(BASE_RESULT);
    await sink({ ...BASE_RESULT, url: 'https://example.com/page2' });

    const jsonlFile = path.join(outDir, 'output.jsonl');
    const lines = (await readFile(jsonlFile, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('skips writing when neither markdown nor txt is in formats', async () => {
    const outDir = path.join(tmpDir, 'out');
    const resultNoText: ExtractionResult = { ...BASE_RESULT, formats: { html: '<p>x</p>' } };
    const sink = createCliSink({ outDir, formats: ['jsonl'], noStdout: true });
    await sink(resultNoText);

    // No content → jsonlSink returns early, no file written
    expect(existsSync(path.join(outDir, 'output.jsonl'))).toBe(false);
  });
});

describe('createCliSink — original format', () => {
  it('writes a -raw.html file to outDir', async () => {
    const outDir = path.join(tmpDir, 'out');
    const sink = createCliSink({ outDir, formats: ['original'], noStdout: true });
    await sink(BASE_RESULT);

    const files = await import('node:fs/promises').then((m) => m.readdir(outDir));
    const rawFile = files.find((f) => f.endsWith('-raw.html'));
    expect(rawFile).toBeDefined();

    const content = await readFile(path.join(outDir, rawFile ?? ''), 'utf8');
    expect(content).toBe(BASE_RESULT.html);
  });
});

describe('createCliSink — stdout / ndjson', () => {
  it('noStdout: true suppresses stdout output', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const outDir = path.join(tmpDir, 'out');
    const sink = createCliSink({ outDir, formats: ['markdown'], noStdout: true });
    await sink(BASE_RESULT);
    expect(writeSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it('ndjson: true emits compact single-line JSON', async () => {
    let output = '';
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      output += chunk;
      return true;
    });

    const outDir = path.join(tmpDir, 'out');
    const sink = createCliSink({ outDir, formats: ['markdown'], ndjson: true });
    await sink(BASE_RESULT);

    const lines = output.trim().split('\n');
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(parsed.url).toBe(BASE_RESULT.url);
    writeSpy.mockRestore();
  });

  it('ndjson: false emits pretty-printed JSON', async () => {
    let output = '';
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      output += chunk;
      return true;
    });

    const outDir = path.join(tmpDir, 'out');
    const sink = createCliSink({ outDir, formats: ['markdown'], ndjson: false });
    await sink(BASE_RESULT);

    // Pretty JSON has multiple lines
    expect(output.trim().split('\n').length).toBeGreaterThan(1);
    writeSpy.mockRestore();
  });
});

describe('createCliSink — dataset error is non-fatal', () => {
  it('continues after a dataset pushData failure and does not rethrow', async () => {
    const outDir = path.join(tmpDir, 'out');
    const dataset = {
      pushData: vi.fn(async () => {
        throw new Error('disk full');
      }),
    } as unknown as Dataset;

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sink = createCliSink({ outDir, formats: ['markdown'], dataset, noStdout: true });

    // Should not throw
    await expect(sink(BASE_RESULT)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'), expect.any(String));
    consoleSpy.mockRestore();
  });
});
