import { describe, expect, it } from 'vitest';
import { defaultCrawlConfig, validateSaveFormats } from './config.js';
import { FORMAT_EXTENSIONS, urlToFilename } from './crawler.js';

describe('config helpers', () => {
  it('defaultCrawlConfig sets balanced defaults', () => {
    const cfg = defaultCrawlConfig();
    expect(cfg.save).toEqual(['markdown']);
    expect(cfg.maxConcurrency).toBe(50);
    expect(cfg.headless).toBe(true);
    expect(cfg.outputDir).toBe('./output');
  });

  it('validateSaveFormats accepts the documented set', () => {
    expect(validateSaveFormats(['markdown', 'html'])).toEqual(['markdown', 'html']);
  });

  it('validateSaveFormats expands `all`', () => {
    const formats = validateSaveFormats(['all']);
    expect(formats.sort()).toEqual(['html', 'json', 'jsonl', 'markdown', 'text']);
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
    expect(Object.keys(FORMAT_EXTENSIONS).sort()).toEqual([
      'html',
      'json',
      'jsonl',
      'markdown',
      'text',
    ]);
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
