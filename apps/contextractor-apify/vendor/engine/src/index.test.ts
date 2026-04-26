import { describe, expect, it } from 'vitest';
import {
    ContentExtractor,
    DEFAULT_CONFIG,
    DEFAULT_FORMATS,
    SUPPORTED_FORMATS,
    configFromJson,
    getDefaultConfig,
    normalizeConfigKeys,
} from './index.js';

const SAMPLE_HTML = `<html><head><title>Hello</title><meta name="author" content="Ada Lovelace"></head>
<body><article>
<h1>Hello</h1>
<p>This is sufficient long content to satisfy minimum extraction thresholds for rs-trafilatura. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
<p>A second paragraph adds more content so the scoring threshold is met.</p>
</article></body></html>`;

describe('ContentExtractor', () => {
    it('extracts plain text by default', () => {
        const extractor = new ContentExtractor();
        const res = extractor.extract(SAMPLE_HTML);
        expect(res).not.toBeNull();
        expect(res?.format).toBe('txt');
        expect(res?.content).toMatch(/sufficient long content/);
    });

    it('extracts markdown when requested', () => {
        const extractor = new ContentExtractor();
        const res = extractor.extract(SAMPLE_HTML, { format: 'markdown' });
        expect(res?.format).toBe('markdown');
        expect(res?.content.length).toBeGreaterThan(0);
    });

    it('extracts json envelope', () => {
        const extractor = new ContentExtractor();
        const res = extractor.extract(SAMPLE_HTML, { format: 'json' });
        expect(res?.format).toBe('json');
        const parsed = JSON.parse(res?.content ?? '{}') as Record<string, unknown>;
        expect(parsed).toHaveProperty('content');
        expect(parsed).toHaveProperty('metadata');
    });

    it('rejects unsupported formats', () => {
        const extractor = new ContentExtractor();
        // biome-ignore lint/suspicious/noExplicitAny: deliberate negative test
        expect(() => extractor.extract(SAMPLE_HTML, { format: 'xml' as any })).toThrow();
        // biome-ignore lint/suspicious/noExplicitAny: deliberate negative test
        expect(() => extractor.extract(SAMPLE_HTML, { format: 'xmltei' as any })).toThrow();
    });

    it('extracts metadata', () => {
        const extractor = new ContentExtractor();
        const meta = extractor.extractMetadata(SAMPLE_HTML);
        expect(meta.title).toBe('Hello');
    });

    it('extractAllFormats returns the default set', () => {
        const extractor = new ContentExtractor();
        const out = extractor.extractAllFormats(SAMPLE_HTML);
        for (const fmt of DEFAULT_FORMATS) {
            expect(out[fmt]).toBeDefined();
        }
    });
});

describe('config helpers', () => {
    it('SUPPORTED_FORMATS does not include xml/xmltei', () => {
        expect(SUPPORTED_FORMATS).not.toContain('xml');
        expect(SUPPORTED_FORMATS).not.toContain('xmltei');
    });

    it('getDefaultConfig matches DEFAULT_CONFIG', () => {
        expect(getDefaultConfig()).toEqual(DEFAULT_CONFIG);
    });

    it('normalizeConfigKeys converts snake_case to camelCase', () => {
        expect(normalizeConfigKeys({ favor_precision: true, fast: false })).toEqual({
            favorPrecision: true,
            fast: false,
        });
    });

    it('configFromJson respects defaults and known fields', () => {
        const cfg = configFromJson({ favorPrecision: true, unknownField: 'ignored' });
        expect(cfg.favorPrecision).toBe(true);
        expect(cfg.includeTables).toBe(DEFAULT_CONFIG.includeTables);
        expect(cfg).not.toHaveProperty('unknownField');
    });
});
