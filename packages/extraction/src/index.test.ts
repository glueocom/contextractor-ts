import { describe, expect, it } from 'vitest';
import {
  ContentExtractor,
  computeContentInfo,
  DEFAULT_CONFIG,
  getDefaultConfig,
  projectMetadata,
} from './index.js';

const SAMPLE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>Sample article title</title>
    <meta name="author" content="Jane Doe">
    <meta name="description" content="Sample description">
  </head>
  <body>
    <article>
      <h1>Sample article title</h1>
      <p>This is a sample article body with enough words for rs-trafilatura
      to consider the page worth extracting. The library has minimum-length
      thresholds, so we pad with two paragraphs.</p>
      <p>The second paragraph keeps the cluster size healthy.</p>
    </article>
    <!-- inline comment -->
  </body>
</html>`;

describe('ContentExtractor', () => {
  it('extracts non-empty content for every supported format', () => {
    const extractor = new ContentExtractor();
    const formats = ['txt', 'markdown', 'json', 'html'] as const;
    for (const format of formats) {
      const result = extractor.extract(SAMPLE_HTML, { format });
      expect(result, `format=${format}`).not.toBeNull();
      expect(result?.content.length, `format=${format}`).toBeGreaterThan(0);
      expect(result?.format).toBe(format);
    }
  });

  it('returns at least a non-empty title via extractMetadata', () => {
    const meta = new ContentExtractor().extractMetadata(SAMPLE_HTML);
    expect(meta.title ?? '').toMatch(/.+/);
  });

  it('extractAllFormats returns exactly txt | markdown | json | html keys', () => {
    const result = new ContentExtractor().extractAllFormats(SAMPLE_HTML);
    expect(Object.keys(result).sort()).toEqual(['html', 'json', 'markdown', 'txt']);
    for (const value of Object.values(result)) {
      expect(value.content.length).toBeGreaterThan(0);
    }
  });

  it('honors a partial config via the constructor', () => {
    const extractor = new ContentExtractor({ favorPrecision: true });
    expect(extractor.getConfig().favorPrecision).toBe(true);
    expect(extractor.getConfig().favorRecall).toBe(false);
  });
});

describe('config helpers', () => {
  it('getDefaultConfig returns a fresh copy of DEFAULT_CONFIG', () => {
    const a = getDefaultConfig();
    const b = getDefaultConfig();
    expect(a).toEqual(DEFAULT_CONFIG);
    expect(a).not.toBe(b);
  });

  it('computeContentInfo returns a stable hash and byte length', () => {
    expect(computeContentInfo('hello')).toEqual({
      hash: '5d41402abc4b2a76b9719d911017c592',
      length: 5,
    });
  });

  it('projectMetadata flattens extraction metadata for sinks', () => {
    expect(
      projectMetadata({
        title: 'Title',
        author: 'Author',
        date: '2026-01-01T00:00:00Z',
        description: 'Desc',
        sitename: 'Site',
        language: 'en',
        hostname: null,
        url: null,
        categories: null,
        tags: null,
        license: null,
        image: null,
        pageType: null,
      }),
    ).toEqual({
      title: 'Title',
      author: 'Author',
      publishedAt: '2026-01-01T00:00:00Z',
      description: 'Desc',
      siteName: 'Site',
      lang: 'en',
    });
  });
});
