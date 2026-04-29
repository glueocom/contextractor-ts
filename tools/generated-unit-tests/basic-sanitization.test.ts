import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentExtractor } from '@contextractor/extraction';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'basic-sanitization');

function loadFixture(name: string): string {
  return readFileSync(path.join(FIXTURES_DIR, `${name}.html`), 'utf8');
}

describe('basic-sanitization › Wikipedia Web Scraping', () => {
  const html = loadFixture('wikipedia-web-scraping');
  const url = 'https://en.wikipedia.org/wiki/Web_scraping';
  const extractor = new ContentExtractor();

  it('extracts metadata with title and sitename', () => {
    const meta = extractor.extractMetadata(html, url);
    // rs-trafilatura's title heuristic differs from Python — assert non-empty,
    // not exact equality.
    expect(meta.title ?? '').toMatch(/.+/);
    expect(meta.sitename ?? meta.hostname ?? '').toMatch(/wiki/i);
  });

  it('extracts substantial markdown content', () => {
    const result = extractor.extract(html, { url, format: 'markdown' });
    expect(result?.content.length ?? 0).toBeGreaterThan(2000);
    expect((result?.content ?? '').toLowerCase()).toContain('web scraping');
  });

  it('extracts substantial plain-text content', () => {
    const result = extractor.extract(html, { url, format: 'txt' });
    expect(result?.content.length ?? 0).toBeGreaterThan(2000);
  });
});

describe('basic-sanitization › MDN JavaScript Guide', () => {
  const html = loadFixture('mdn-javascript-guide');
  const url = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide';
  const extractor = new ContentExtractor();

  it('extracts metadata with a JavaScript-related title', () => {
    const meta = extractor.extractMetadata(html, url);
    expect(meta.title ?? '').toMatch(/javascript/i);
  });

  it('extracts non-trivial markdown content', () => {
    const result = extractor.extract(html, { url, format: 'markdown' });
    expect(result?.content.length ?? 0).toBeGreaterThan(200);
  });
});

describe('basic-sanitization › Crawlee Introduction', () => {
  const html = loadFixture('crawlee-intro');
  const url = 'https://crawlee.dev/docs/introduction';
  const extractor = new ContentExtractor();

  it('extracts a title that mentions Crawlee or Introduction', () => {
    const meta = extractor.extractMetadata(html, url);
    expect(meta.title ?? '').toMatch(/crawlee|introduction/i);
  });

  it('extracts non-trivial markdown content', () => {
    const result = extractor.extract(html, { url, format: 'markdown' });
    expect(result?.content.length ?? 0).toBeGreaterThan(200);
  });
});
