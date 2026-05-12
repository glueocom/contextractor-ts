import type {
  ContextractorCrawlerOptions,
  ExtractionResult,
  ProxyConfiguration,
  RequestProvider,
  Sink,
} from '@contextractor/crawler';
import { normalizeConfigKeys, type OutputFormat } from '@contextractor/extraction';
import type { ContextractorInputType } from '@contextractor/schema';

const WAIT_UNTIL_MAP = {
  LOAD: 'load',
  DOMCONTENTLOADED: 'domcontentloaded',
  NETWORKIDLE: 'networkidle',
} as const;

export function buildCrawlerOpts(
  input: ContextractorInputType,
  sink: Sink<ExtractionResult>,
  proxyConfiguration?: ProxyConfiguration,
  requestQueue?: RequestProvider,
  proxyRotation?: ContextractorInputType['proxyRotation'],
): ContextractorCrawlerOptions {
  const formats: OutputFormat[] = input.save.filter((f) => f !== 'original') as OutputFormat[];
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
    waitUntil: WAIT_UNTIL_MAP[input.waitUntil],
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
    browserLog: input.browserLog,
    respectRobotsTxt: input.respectRobotsTxtFile,
    dynamicContentWaitSecs: input.dynamicContentWaitSecs,
    waitForSelector: input.waitForSelector || undefined,
    softWaitForSelector: input.softWaitForSelector || undefined,
    ignoreCanonicalUrl: input.ignoreCanonicalUrl,
  };
}
