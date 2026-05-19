import { ContentExtractor } from '@contextractor/extraction';
import type { CheerioCrawlingContext } from 'crawlee';
import { describe, expect, it } from 'vitest';
import { createCheerioHandler } from './handler.js';
import { memorySink } from './sinks/memory.js';
import type { ExtractionResult } from './sinks/types.js';

const HTML_WITH_CANONICAL = (canonical: string): string =>
  `<html><head><link rel="canonical" href="${canonical}"></head><body><article><h1>Test Page</h1><p>This article has substantial content for extraction purposes. It contains enough text to pass Trafilatura minimum length checks. Multiple sentences are included here.</p></article></body></html>`;

const HTML_NO_CANONICAL =
  '<html><body><article><h1>Article</h1><p>This article has no canonical link tag. It contains enough content for extraction. Multiple sentences ensure the extractor has material to work with.</p></article></body></html>';

function makeContext(html: string, url: string, loadedUrl?: string): CheerioCrawlingContext {
  return {
    request: { url, loadedUrl: loadedUrl ?? url, userData: {} },
    log: { info: () => {}, debug: () => {}, warning: () => {}, error: () => {} },
    $: (selector: string) => ({
      prop: (attr: string) => (selector === 'html' && attr === 'outerHTML' ? html : undefined),
    }),
  } as unknown as CheerioCrawlingContext;
}

// Probe at module load time — synchronous; returns null if native binary is unavailable.
let nativeAvailable: boolean;
try {
  const probe = new ContentExtractor().extract(HTML_NO_CANONICAL, { format: 'txt' });
  nativeAvailable = probe !== null && probe.content.length > 0;
} catch {
  nativeAvailable = false;
}

describe("deduplication: 'basic' — canonical dedup across handler calls", () => {
  it('skips second page with same canonical, different URL', async () => {
    const seenCanonicals = new Set<string>();
    const sink = memorySink<ExtractionResult>();
    const handler = createCheerioHandler({
      formats: [],
      sink,
      deduplication: 'basic',
      seenCanonicals,
      seenContentHashes: new Set(),
    });

    const canonical = 'https://example.com/canonical';
    const html = HTML_WITH_CANONICAL(canonical);

    await handler(makeContext(html, 'https://example.com/page1'));
    await handler(makeContext(html, 'https://example.com/page2'));

    expect(sink.results).toHaveLength(1);
    expect(sink.results[0].url).toBe('https://example.com/page1');
  });

  it('does not skip page whose URL equals its canonical (self-referencing canonical)', async () => {
    const seenCanonicals = new Set<string>();
    const sink = memorySink<ExtractionResult>();
    const handler = createCheerioHandler({
      formats: [],
      sink,
      deduplication: 'basic',
      seenCanonicals,
      seenContentHashes: new Set(),
    });

    const url = 'https://example.com/page';
    const html = HTML_WITH_CANONICAL(url);

    await handler(makeContext(html, url));

    expect(sink.results).toHaveLength(1);
  });
});

describe("deduplication: 'minimal' — canonical dedup disabled", () => {
  it('extracts both pages even when they share a canonical', async () => {
    const seenCanonicals = new Set<string>();
    const sink = memorySink<ExtractionResult>();
    const handler = createCheerioHandler({
      formats: [],
      sink,
      deduplication: 'minimal',
      seenCanonicals,
      seenContentHashes: new Set(),
    });

    const canonical = 'https://example.com/canonical';
    const html = HTML_WITH_CANONICAL(canonical);

    await handler(makeContext(html, 'https://example.com/page1'));
    await handler(makeContext(html, 'https://example.com/page2'));

    expect(sink.results).toHaveLength(2);
  });
});

describe("deduplication: 'basic' — no canonical tag → content hash inactive", () => {
  it('extracts both pages with identical content when no canonical is present', async () => {
    const seenCanonicals = new Set<string>();
    const sink = memorySink<ExtractionResult>();
    const handler = createCheerioHandler({
      formats: [],
      sink,
      deduplication: 'basic',
      seenCanonicals,
      seenContentHashes: new Set(),
    });

    await handler(makeContext(HTML_NO_CANONICAL, 'https://example.com/a'));
    await handler(makeContext(HTML_NO_CANONICAL, 'https://example.com/b'));

    expect(sink.results).toHaveLength(2);
  });
});

describe("deduplication: 'full' — content hash dedup", () => {
  it.skipIf(!nativeAvailable)(
    // The native .node binary is required for extraction — skip when not available.
    'skips second page with identical extracted text',
    async () => {
      const seenContentHashes = new Set<string>();
      const sink = memorySink<ExtractionResult>();
      const handler = createCheerioHandler({
        formats: ['txt'],
        sink,
        deduplication: 'full',
        seenCanonicals: new Set(),
        seenContentHashes,
      });

      await handler(makeContext(HTML_NO_CANONICAL, 'https://example.com/a'));
      await handler(makeContext(HTML_NO_CANONICAL, 'https://example.com/b'));

      // Second page has identical extracted text — must be skipped.
      expect(sink.results).toHaveLength(1);
      expect(sink.results[0].url).toBe('https://example.com/a');
    },
  );
});

describe('loadedUrl — final URL after redirects', () => {
  it('result.loadedUrl equals request.loadedUrl when different from request.url', async () => {
    const seenCanonicals = new Set<string>();
    const sink = memorySink<ExtractionResult>();
    const handler = createCheerioHandler({
      formats: [],
      sink,
      deduplication: 'minimal',
      seenCanonicals,
      seenContentHashes: new Set(),
    });

    await handler(
      makeContext(HTML_NO_CANONICAL, 'https://example.com/old', 'https://example.com/new'),
    );

    expect(sink.results[0]?.url).toBe('https://example.com/old');
    expect(sink.results[0]?.loadedUrl).toBe('https://example.com/new');
  });

  it('result.loadedUrl falls back to request.url when loadedUrl is absent', async () => {
    const seenCanonicals = new Set<string>();
    const sink = memorySink<ExtractionResult>();
    const handler = createCheerioHandler({
      formats: [],
      sink,
      deduplication: 'minimal',
      seenCanonicals,
      seenContentHashes: new Set(),
    });

    // makeContext sets loadedUrl === url when no loadedUrl arg is given
    await handler(makeContext(HTML_NO_CANONICAL, 'https://example.com/page'));

    expect(sink.results[0]?.url).toBe('https://example.com/page');
    expect(sink.results[0]?.loadedUrl).toBe('https://example.com/page');
  });
});

describe('shared seenCanonicals — state accumulates across calls', () => {
  it('accumulates seen canonicals across multiple handler invocations', async () => {
    const seenCanonicals = new Set<string>();
    const sink = memorySink<ExtractionResult>();
    const handler = createCheerioHandler({
      formats: [],
      sink,
      deduplication: 'basic',
      seenCanonicals,
      seenContentHashes: new Set(),
    });

    const canonical = 'https://example.com/article';

    await handler(makeContext(HTML_WITH_CANONICAL(canonical), 'https://example.com/p1'));
    expect(seenCanonicals.has(canonical)).toBe(true);

    await handler(makeContext(HTML_WITH_CANONICAL(canonical), 'https://example.com/p2'));
    expect(sink.results).toHaveLength(1);

    // Third invocation with a new canonical — must be extracted.
    const canonical2 = 'https://example.com/article2';
    await handler(makeContext(HTML_WITH_CANONICAL(canonical2), 'https://example.com/p3'));
    expect(sink.results).toHaveLength(2);
    expect(seenCanonicals.size).toBe(2);
  });
});
