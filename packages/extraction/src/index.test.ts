import { describe, expect, it } from 'vitest';
import {
  ContentExtractor,
  DEFAULT_CONFIG,
  getDefaultConfig,
  normalizeConfigKeys,
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

  it('normalizeConfigKeys accepts snake_case and camelCase', () => {
    const out = normalizeConfigKeys({ favor_precision: true, includeImages: true });
    expect(out.favorPrecision).toBe(true);
    expect(out.includeImages).toBe(true);
    expect(out.fast).toBe(DEFAULT_CONFIG.fast);
  });

  it('normalizeConfigKeys ignores unknown and null values', () => {
    const out = normalizeConfigKeys({ unknownField: 'ignored', includeLinks: null });
    expect(out.includeLinks).toBe(DEFAULT_CONFIG.includeLinks);
  });
});
