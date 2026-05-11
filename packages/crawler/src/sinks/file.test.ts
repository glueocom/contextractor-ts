import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FORMAT_EXTENSIONS, fileSink, urlToFilename } from './file.js';
import type { ExtractionResult } from './types.js';

const BASE_RESULT: ExtractionResult = {
  url: 'https://example.com/page',
  html: '<html>raw</html>',
  rawHtmlHash: 'abc',
  rawHtmlLength: 10,
  metadata: {
    title: null,
    author: null,
    publishedAt: null,
    description: null,
    siteName: null,
    lang: null,
  },
  formats: { txt: 'Hello world', markdown: '# Hello world', json: '{"text":"Hello"}' },
};

describe('FORMAT_EXTENSIONS', () => {
  it('has entries for all four OutputFormat values', () => {
    expect(Object.keys(FORMAT_EXTENSIONS).sort()).toEqual(['html', 'json', 'markdown', 'txt']);
  });

  it('maps txt to .txt', () => {
    expect(FORMAT_EXTENSIONS.txt).toBe('.txt');
  });
});

describe('urlToFilename', () => {
  it('strips protocol and replaces separators', () => {
    expect(urlToFilename('https://example.com/a/b')).toBe('example-com-a-b');
  });

  it('strips trailing separators', () => {
    expect(urlToFilename('https://example.com/')).toBe('example-com');
  });

  it('truncates slugs over 100 chars and appends md5 hash', () => {
    const slug = urlToFilename(`https://example.com/${'x'.repeat(120)}`);
    expect(slug.length).toBeLessThanOrEqual(110);
    expect(slug).toMatch(/-[0-9a-f]{8}$/);
  });
});

describe('fileSink', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'crawler-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes txt and markdown files for those formats', async () => {
    const sink = fileSink({ outDir: tmpDir, formats: ['txt', 'markdown'] });
    await sink(BASE_RESULT);

    const slug = urlToFilename(BASE_RESULT.url);
    const txtContent = readFileSync(path.join(tmpDir, `${slug}.txt`), 'utf8');
    const mdContent = readFileSync(path.join(tmpDir, `${slug}.md`), 'utf8');

    expect(txtContent).toContain('Hello world');
    expect(mdContent).toContain('# Hello world');
  });

  it('writes all formats present in result when formats is omitted', async () => {
    const sink = fileSink({ outDir: tmpDir });
    await sink(BASE_RESULT);

    const slug = urlToFilename(BASE_RESULT.url);
    expect(() => readFileSync(path.join(tmpDir, `${slug}.txt`), 'utf8')).not.toThrow();
    expect(() => readFileSync(path.join(tmpDir, `${slug}.md`), 'utf8')).not.toThrow();
    expect(() => readFileSync(path.join(tmpDir, `${slug}.json`), 'utf8')).not.toThrow();
  });

  it('skips formats not present in result.formats', async () => {
    const resultNoHtml: ExtractionResult = { ...BASE_RESULT, formats: { txt: 'text' } };
    const sink = fileSink({ outDir: tmpDir, formats: ['txt', 'html'] });
    await sink(resultNoHtml);

    const slug = urlToFilename(resultNoHtml.url);
    expect(() => readFileSync(path.join(tmpDir, `${slug}.txt`), 'utf8')).not.toThrow();
    expect(() => readFileSync(path.join(tmpDir, `${slug}.html`), 'utf8')).toThrow();
  });

  it('prepends metadata header to txt when title is present', async () => {
    const withMeta: ExtractionResult = {
      ...BASE_RESULT,
      metadata: { ...BASE_RESULT.metadata, title: 'My Page', author: 'Alice' },
    };
    const sink = fileSink({ outDir: tmpDir, formats: ['txt'] });
    await sink(withMeta);

    const slug = urlToFilename(withMeta.url);
    const content = readFileSync(path.join(tmpDir, `${slug}.txt`), 'utf8');
    expect(content).toContain('Title: My Page');
    expect(content).toContain('Author: Alice');
  });

  it('does not prepend header to json', async () => {
    const withMeta: ExtractionResult = {
      ...BASE_RESULT,
      metadata: { ...BASE_RESULT.metadata, title: 'Title' },
    };
    const sink = fileSink({ outDir: tmpDir, formats: ['json'] });
    await sink(withMeta);

    const slug = urlToFilename(withMeta.url);
    const content = readFileSync(path.join(tmpDir, `${slug}.json`), 'utf8');
    expect(content).not.toContain('Title:');
    expect(content).toBe('{"text":"Hello"}');
  });
});
