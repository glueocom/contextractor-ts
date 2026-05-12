import { FORMAT_EXTENSIONS, urlToFilename } from '@contextractor/crawler';
import { ContextractorInput } from '@contextractor/schema';
import { describe, expect, it } from 'vitest';
import { buildCrawlConfig, validateSaveFormats } from './config.js';

describe('config helpers', () => {
  it('buildCrawlConfig produces balanced defaults from a minimal startUrls payload', () => {
    const input = ContextractorInput.parse({ startUrls: [{ url: 'https://example.com' }] });
    const cfg = buildCrawlConfig(input, {
      urls: ['https://example.com'],
      outputDir: './output',
      save: ['markdown'],
      proxyUrls: [],
    });

    expect(cfg.save).toEqual(['markdown']);
    expect(cfg.maxConcurrency).toBe(50);
    expect(cfg.headless).toBe(true);
    expect(cfg.outputDir).toBe('./output');
    expect(cfg.launcher).toBe('chromium');
    expect(cfg.waitUntil).toBe('load');
    expect(cfg.maxPages).toBe(0);
    expect(cfg.crawlDepth).toBe(0);
    expect(cfg.maxScrollHeight).toBe(5000);
    expect(cfg.closeCookieModals).toBe(true);
    expect(cfg.urls).toEqual(['https://example.com']);
  });

  it('validateSaveFormats accepts the documented set', () => {
    expect(validateSaveFormats(['markdown', 'html'])).toEqual(['markdown', 'html']);
  });

  it('validateSaveFormats expands `all`', () => {
    const formats = validateSaveFormats(['all']);
    expect(formats.sort()).toEqual(['html', 'json', 'markdown', 'original', 'txt']);
  });

  it('validateSaveFormats accepts `txt`', () => {
    expect(validateSaveFormats(['txt'])).toEqual(['txt']);
  });

  it('validateSaveFormats rejects `text` (alias removed)', () => {
    expect(() => validateSaveFormats(['text'])).toThrow(/Unknown save format/);
  });

  it('validateSaveFormats accepts `original`', () => {
    expect(validateSaveFormats(['original'])).toEqual(['original']);
  });

  it('validateSaveFormats rejects unknown values', () => {
    const rejected = ['gibberish', 'pdf', 'rss'];
    for (const r of rejected) {
      expect(() => validateSaveFormats([r])).toThrow(/Unknown save format/);
    }
  });
});

describe('FORMAT_EXTENSIONS', () => {
  it('contains exactly the supported set', () => {
    expect(Object.keys(FORMAT_EXTENSIONS).sort()).toEqual(['html', 'json', 'markdown', 'txt']);
  });
});

describe('urlToFilename', () => {
  it('strips protocol and replaces non-alphanumeric chars', () => {
    expect(urlToFilename('https://example.com/path/to/page')).toBe('example-com-path-to-page');
  });

  it('truncates long URLs and adds a hash', () => {
    const long = `https://example.com/${'a'.repeat(120)}`;
    const result = urlToFilename(long);
    expect(result.length).toBeLessThanOrEqual(120);
    expect(result).toMatch(/-[0-9a-f]{8}$/);
  });
});
