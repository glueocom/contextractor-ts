import type {
  ContextractorCrawlerOptions,
  ExtractionResult,
  ProxyConfiguration,
  RequestProvider,
  Sink,
} from '@contextractor/crawler';
import type { OutputFormat } from '@contextractor/extraction';
import type { ContextractorInputType } from '@contextractor/schema';

export function buildCrawlerOpts(
  input: ContextractorInputType,
  sink: Sink<ExtractionResult>,
  proxyConfiguration?: ProxyConfiguration,
  requestQueue?: RequestProvider,
  proxyRotation?: ContextractorInputType['proxyRotation'],
): ContextractorCrawlerOptions {
  const formats = input.save.filter((f): f is OutputFormat => f !== 'original');
  if (formats.length === 0) formats.push('markdown');

  return {
    startUrls: [],
    sink,
    formats,
    mode: input.mode,
    includeComments: input.includeComments,
    includeTables: input.includeTables,
    includeImages: input.includeImages,
    includeLinks: input.includeLinks,
    targetLanguage: input.targetLanguage,
    cookieStrategy: input.closeCookieModals ? 'ghostery' : 'none',
    scroll:
      input.maxScrollHeightPixels > 0
        ? { maxScrollHeight: input.maxScrollHeightPixels }
        : undefined,
    headless: input.headless,
    crawlerType: input.crawlerType,
    renderingTypeDetectionPercentage: input.renderingTypeDetectionPercentage,
    ignoreSslErrors: input.ignoreSslErrors,
    bypassCSP: input.ignoreCorsAndCsp,
    initialCookies: input.initialCookies,
    extraHTTPHeaders: input.customHttpHeaders ?? undefined,
    userAgent: input.userAgent || undefined,
    maxPages: input.maxPagesPerCrawl,
    maxRetries: input.maxRequestRetries,
    initialConcurrency: input.initialConcurrency,
    maxConcurrency: input.maxConcurrency,
    pageLoadTimeoutSecs: input.pageLoadTimeoutSecs,
    waitUntil: input.waitUntil,
    maxResults: input.maxResultsPerCrawl > 0 ? input.maxResultsPerCrawl : undefined,
    linkSelector: input.linkSelector,
    maxCrawlingDepth: input.maxCrawlingDepth,
    globs: input.globs.map((g) => g.glob).filter((g): g is string => Boolean(g)),
    excludes: input.excludes.map((g) => g.glob).filter((g): g is string => Boolean(g)),
    keepUrlFragments: input.keepUrlFragments,
    proxyConfiguration,
    proxyRotation,
    requestQueue,
    blockMedia: input.blockMedia,
    respectRobotsTxt: input.respectRobotsTxtFile,
    dynamicContentWaitSecs: input.dynamicContentWaitSecs,
    waitForSelector: input.waitForSelector || undefined,
    softWaitForSelector: input.softWaitForSelector || undefined,
    deduplication: input.deduplication,
    sessionPoolName: input.sessionPoolName,
    maxSessionRotations: input.maxSessionRotations,
  };
}
