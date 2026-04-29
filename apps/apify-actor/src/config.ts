import type { ContextractorCrawlerOptions, ExtractionResult, Sink } from '@contextractor/crawler';
import { normalizeConfigKeys, type OutputFormat } from '@contextractor/extraction';
import type { ContextractorInputType } from '@contextractor/schema';
import type { ProxyConfiguration } from 'crawlee';

export function buildCrawlerOpts(
  input: ContextractorInputType,
  sink: Sink<ExtractionResult>,
  proxyConfiguration?: ProxyConfiguration,
): ContextractorCrawlerOptions {
  const formats: OutputFormat[] = [];
  if (input.saveExtractedTextToKeyValueStore) formats.push('txt');
  if (input.saveExtractedJsonToKeyValueStore) formats.push('json');
  if (input.saveExtractedMarkdownToKeyValueStore) formats.push('markdown');
  if (formats.length === 0) formats.push('markdown');

  return {
    startUrls: [],
    sink,
    formats,
    extractionConfig: normalizeConfigKeys(input.trafilaturaConfig),
    cookieStrategy: input.closeCookieModals ? 'ghostery' : 'none',
    scroll:
      input.maxScrollHeightPixels > 0
        ? { maxScrollHeight: input.maxScrollHeightPixels }
        : undefined,
    headless: input.headless,
    launcher: input.launcher.toLowerCase() as 'chromium' | 'firefox',
    ignoreSslErrors: input.ignoreSslErrors,
    bypassCSP: input.ignoreCorsAndCsp,
    initialCookies: input.initialCookies,
    extraHTTPHeaders: input.customHttpHeaders ?? undefined,
    userAgent: input.userAgent || undefined,
    maxPages: input.maxPagesPerCrawl,
    maxRetries: input.maxRequestRetries,
    maxConcurrency: input.maxConcurrency,
    pageLoadTimeoutSecs: input.pageLoadTimeoutSecs,
    maxResults: input.maxResultsPerCrawl > 0 ? input.maxResultsPerCrawl : undefined,
    linkSelector: input.linkSelector,
    maxCrawlingDepth: input.maxCrawlingDepth,
    globs: input.globs.map((g) => g.glob).filter((g): g is string => Boolean(g)),
    excludes: input.excludes.map((g) => g.glob).filter((g): g is string => Boolean(g)),
    keepUrlFragments: input.keepUrlFragments,
    proxyConfiguration,
  };
}
