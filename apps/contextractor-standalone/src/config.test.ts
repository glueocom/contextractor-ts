import { describe, expect, it } from 'vitest';
import {
    crawlConfigFromDict,
    defaultCrawlConfig,
    mergeOverrides,
    urlToFilename,
    validateSaveFormats,
} from './config.js';

describe('validateSaveFormats', () => {
    it('accepts known formats', () => {
        expect(validateSaveFormats(['markdown', 'json'])).toEqual(['markdown', 'json']);
    });

    it('expands all', () => {
        expect(validateSaveFormats(['all'])).toContain('markdown');
        expect(validateSaveFormats(['all'])).toContain('jsonl');
    });

    it('rejects xml/xmltei', () => {
        expect(() => validateSaveFormats(['xml'])).toThrow();
        expect(() => validateSaveFormats(['xml-tei'])).toThrow();
    });

    it('dedupes', () => {
        expect(validateSaveFormats(['markdown', 'markdown'])).toEqual(['markdown']);
    });
});

describe('urlToFilename', () => {
    it('strips protocol', () => {
        expect(urlToFilename('https://example.com/foo')).toBe('example-com-foo');
    });

    it('truncates and hashes very long URLs', () => {
        const long = `https://example.com/${'a'.repeat(200)}`;
        const slug = urlToFilename(long);
        expect(slug.length).toBeLessThanOrEqual(120);
        expect(slug).toMatch(/-[0-9a-f]{8}$/);
    });
});

describe('crawlConfigFromDict', () => {
    it('produces defaults for empty input', () => {
        const cfg = crawlConfigFromDict({});
        expect(cfg.outputDir).toBe('./output');
        expect(cfg.save).toEqual(['markdown']);
    });

    it('applies trafilatura settings', () => {
        const cfg = crawlConfigFromDict({ trafilaturaConfig: { favorPrecision: true } });
        expect(cfg.trafilaturaConfig.favorPrecision).toBe(true);
    });

    it('parses snake_case keys', () => {
        const cfg = crawlConfigFromDict({ max_pages: 5, output_dir: '/tmp/x' });
        expect(cfg.maxPages).toBe(5);
        expect(cfg.outputDir).toBe('/tmp/x');
    });
});

describe('mergeOverrides', () => {
    it('routes trafilatura fields into the nested config', () => {
        const cfg = defaultCrawlConfig();
        mergeOverrides(cfg, { favorPrecision: true, maxPages: 10 });
        expect(cfg.trafilaturaConfig.favorPrecision).toBe(true);
        expect(cfg.maxPages).toBe(10);
    });

    it('skips null/undefined', () => {
        const cfg = defaultCrawlConfig();
        const before = cfg.maxPages;
        mergeOverrides(cfg, { maxPages: undefined });
        expect(cfg.maxPages).toBe(before);
    });
});
