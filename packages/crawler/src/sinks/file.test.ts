import { existsSync, realpathSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FORMAT_EXTENSIONS, fileSink, urlToFilename } from './file.js';
import type { ExtractionResult } from './types.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = realpathSync(await mkdtemp(path.join(tmpdir(), 'ctx-file-sink-')));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

const BASE_RESULT: ExtractionResult = {
  url: 'https://example.com/article',
  html: '<html><body>raw</body></html>',
  rawHtmlHash: 'abc',
  rawHtmlLength: 29,
  metadata: {
    title: 'Article Title',
    author: 'Jane Doe',
    publishedAt: '2026-01-01T00:00:00Z',
    description: 'Desc',
    siteName: 'Example',
    lang: 'en',
  },
  formats: {
    txt: 'Article body text.',
    markdown: '# Article Title\n\nArticle body text.',
    html: '<article>Article body text.</article>',
    json: '{"text":"Article body text."}',
  },
};

describe('FORMAT_EXTENSIONS', () => {
  it('maps every supported OutputFormat to its extension', () => {
    expect(FORMAT_EXTENSIONS.txt).toBe('.txt');
    expect(FORMAT_EXTENSIONS.markdown).toBe('.md');
    expect(FORMAT_EXTENSIONS.json).toBe('.json');
    expect(FORMAT_EXTENSIONS.html).toBe('.html');
  });
});

describe('urlToFilename', () => {
  it('strips protocol prefix', () => {
    expect(urlToFilename('https://example.com/foo')).toBe('example-com-foo');
  });

  it('strips http:// prefix', () => {
    expect(urlToFilename('http://example.com/bar')).toBe('example-com-bar');
  });

  it('replaces non-alphanumeric runs with a single hyphen', () => {
    expect(urlToFilename('https://a.b.c/x/y?q=1')).toBe('a-b-c-x-y-q-1');
  });

  it('trims leading and trailing hyphens', () => {
    const result = urlToFilename('https://---a---');
    expect(result).not.toMatch(/^-/);
    expect(result).not.toMatch(/-$/);
  });

  it('truncates URLs over 100 chars and appends an 8-char hex suffix', () => {
    const long = `https://example.com/${'a'.repeat(120)}`;
    const result = urlToFilename(long);
    // Must be ≤ 100-char slug + '-' + 8-char hash = 109 chars max
    expect(result.length).toBeLessThanOrEqual(109);
    expect(result).toMatch(/-[0-9a-f]{8}$/);
  });
});

describe('fileSink', () => {
  it('creates output directory and writes a .txt file for txt format', async () => {
    const outDir = path.join(tmpDir, 'out');
    const sink = fileSink({ outDir, formats: ['txt'] });
    await sink(BASE_RESULT);

    const slug = urlToFilename(BASE_RESULT.url);
    const txtFile = path.join(outDir, `${slug}.txt`);
    expect(existsSync(txtFile)).toBe(true);
    const content = await readFile(txtFile, 'utf8');
    expect(content).toContain('Article body text.');
  });

  it('prepends title/author/date/url header to txt output', async () => {
    const outDir = path.join(tmpDir, 'out');
    const sink = fileSink({ outDir, formats: ['txt'] });
    await sink(BASE_RESULT);

    const slug = urlToFilename(BASE_RESULT.url);
    const content = await readFile(path.join(outDir, `${slug}.txt`), 'utf8');
    expect(content).toContain('Title: Article Title');
    expect(content).toContain('Author: Jane Doe');
    expect(content).toContain('Date: 2026-01-01T00:00:00Z');
    expect(content).toContain(`URL: ${BASE_RESULT.url}`);
    expect(content).toContain('---');
  });

  it('prepends header to markdown but not to json or html', async () => {
    const outDir = path.join(tmpDir, 'out');
    const sink = fileSink({ outDir, formats: ['markdown', 'json', 'html'] });
    await sink(BASE_RESULT);

    const slug = urlToFilename(BASE_RESULT.url);

    const mdContent = await readFile(path.join(outDir, `${slug}.md`), 'utf8');
    expect(mdContent).toContain('Title: Article Title');

    const jsonContent = await readFile(path.join(outDir, `${slug}.json`), 'utf8');
    expect(jsonContent).not.toContain('Title:');

    const htmlContent = await readFile(path.join(outDir, `${slug}.html`), 'utf8');
    expect(htmlContent).not.toContain('Title:');
  });

  it('skips formats where the content is falsy', async () => {
    const outDir = path.join(tmpDir, 'out');
    const result: ExtractionResult = {
      ...BASE_RESULT,
      formats: { txt: '', markdown: 'Some content' },
    };
    const sink = fileSink({ outDir, formats: ['txt', 'markdown'] });
    await sink(result);

    const slug = urlToFilename(result.url);
    expect(existsSync(path.join(outDir, `${slug}.txt`))).toBe(false);
    expect(existsSync(path.join(outDir, `${slug}.md`))).toBe(true);
  });

  it('uses all keys in result.formats when formats option is omitted', async () => {
    const outDir = path.join(tmpDir, 'out');
    const sink = fileSink({ outDir });
    await sink(BASE_RESULT);

    const slug = urlToFilename(BASE_RESULT.url);
    for (const ext of ['.txt', '.md', '.json', '.html']) {
      expect(existsSync(path.join(outDir, `${slug}${ext}`))).toBe(true);
    }
  });

  it('header is omitted when all three metadata fields are null', async () => {
    const outDir = path.join(tmpDir, 'out');
    const result: ExtractionResult = {
      ...BASE_RESULT,
      metadata: {
        title: null,
        author: null,
        publishedAt: null,
        description: null,
        siteName: null,
        lang: null,
      },
      formats: { txt: 'Just text.' },
    };
    const sink = fileSink({ outDir, formats: ['txt'] });
    await sink(result);

    const slug = urlToFilename(result.url);
    const content = await readFile(path.join(outDir, `${slug}.txt`), 'utf8');
    expect(content).toBe('Just text.');
  });
});
