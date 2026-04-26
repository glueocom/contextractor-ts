import { ContentExtractor } from '@contextractor/engine';
import { describe, expect, it } from 'vitest';
import { loadHtmlFixture } from './fixtures.js';

const extractor = new ContentExtractor();

describe('Wikipedia Web Scraping', () => {
    const html = loadHtmlFixture('basic-sanitization', 'wikipedia-web-scraping');
    const url = 'https://en.wikipedia.org/wiki/Web_scraping';

    it('extracts metadata', () => {
        const meta = extractor.extractMetadata(html, url);
        expect(meta.title ?? '').not.toBe('');
        expect(meta.sitename ?? '').not.toBe('');
    });

    it('extracts substantial markdown content', () => {
        const r = extractor.extract(html, { url, format: 'markdown' });
        expect(r).not.toBeNull();
        expect(r?.content.length).toBeGreaterThan(5000);
        expect(r?.content.toLowerCase()).toContain('web scraping');
    });

    it('extracts substantial plain text', () => {
        const r = extractor.extract(html, { url, format: 'txt' });
        expect(r).not.toBeNull();
        expect(r?.content.length).toBeGreaterThan(5000);
    });
});

describe('MDN JavaScript Guide', () => {
    const html = loadHtmlFixture('basic-sanitization', 'mdn-javascript-guide');
    const url = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide';

    it('extracts metadata', () => {
        const meta = extractor.extractMetadata(html, url);
        expect(meta.title).toBeTruthy();
        expect((meta.description ?? '').length).toBeGreaterThan(0);
    });

    it('extracts markdown content', () => {
        const r = extractor.extract(html, { url, format: 'markdown' });
        expect(r).not.toBeNull();
        expect(r?.content.length).toBeGreaterThan(500);
    });
});

describe('Crawlee intro', () => {
    const html = loadHtmlFixture('basic-sanitization', 'crawlee-intro');
    const url = 'https://crawlee.dev/docs/introduction';

    it('extracts metadata', () => {
        const meta = extractor.extractMetadata(html, url);
        const title = meta.title ?? '';
        expect(/Crawlee|Introduction/i.test(title)).toBe(true);
    });

    it('extracts markdown content', () => {
        const r = extractor.extract(html, { url, format: 'markdown' });
        expect(r).not.toBeNull();
        expect(r?.content.length).toBeGreaterThan(500);
    });
});

describe('xml/xmltei output (deferred)', () => {
    it.skip('xml output pending rs-trafilatura support', () => {
        // No-op: rs-trafilatura 0.2.x does not produce XML / XML-TEI.
    });
});
