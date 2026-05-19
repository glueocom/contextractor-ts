import {
  DEFAULT_CONFIG,
  type OutputFormat,
  type TrafilaturaConfig,
} from '@contextractor/extraction';
import type {
  AdaptivePlaywrightCrawlerOptions,
  PlaywrightHook,
  ProxyConfiguration,
  RequestProvider,
  SessionPoolOptions,
} from 'crawlee';
import {
  AdaptivePlaywrightCrawler,
  CheerioCrawler,
  PlaywrightCrawler,
  playwrightUtils,
  Request,
  type SitemapRequestList,
} from 'crawlee';
import { installCookieDefences, rejectViaAutoconsent } from './browser/cookies.js';
import { buildBrowserLaunchOptions } from './browser/launchOptions.js';
import type { ScrollConfig } from './browser/scroll.js';
import { createAdaptiveHandler, createCheerioHandler, createHandler } from './handler.js';
import type { ExtractionResult, Sink } from './sinks/types.js';

export interface ContextractorCrawlerOptions {
  startUrls: string[];
  sink: Sink<ExtractionResult>;
  formats?: OutputFormat[];
  mode?: 'precision' | 'balanced' | 'recall';
  includeComments?: boolean;
  includeTables?: boolean;
  includeImages?: boolean;
  includeLinks?: boolean;
  targetLanguage?: string;
  scroll?: ScrollConfig;
  cookieStrategy?: 'ghostery' | 'autoconsent' | 'none';
  sessionPool?: boolean | SessionPoolOptions;
  maxPages?: number;
  maxRetries?: number;
  initialConcurrency?: number;
  maxConcurrency?: number;
  pageLoadTimeoutSecs?: number;
  /**
   * Navigation lifecycle event to wait for in `page.goto`.
   * Forwarded to Crawlee via `preNavigationHooks` → `gotoOptions.waitUntil`.
   * If undefined, Playwright's default of `'load'` applies.
   */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  headless?: boolean;
  crawlerType?: 'playwright:adaptive' | 'playwright:firefox' | 'playwright:chromium' | 'cheerio';
  renderingTypeDetectionPercentage?: number;
  ignoreSslErrors?: boolean;
  bypassCSP?: boolean;
  initialCookies?: unknown[];
  extraHTTPHeaders?: Record<string, string>;
  userAgent?: string;
  linkSelector?: string;
  maxCrawlingDepth?: number;
  maxResults?: number;
  globs?: string[];
  excludes?: string[];
  keepUrlFragments?: boolean;
  proxyConfiguration?: ProxyConfiguration;
  /**
   * Proxy rotation strategy. Maps to Crawlee `sessionPoolOptions`.
   * Mirrors Apify scraper-tools semantics: RECOMMENDED uses the default
   * session reuse count; PER_REQUEST retires the session after one request
   * (new browser context per request); UNTIL_FAILURE forces a single-session
   * pool that stays on one proxy URL until the session retires from errors.
   * Has no effect when `proxyConfiguration` is undefined.
   */
  proxyRotation?: 'RECOMMENDED' | 'PER_REQUEST' | 'UNTIL_FAILURE';
  sessionPoolName?: string;
  maxSessionRotations?: number;
  requestQueue?: RequestProvider;
  requestList?: SitemapRequestList;
  blockMedia?: boolean;
  respectRobotsTxt?: boolean;
  dynamicContentWaitSecs?: number;
  waitForSelector?: string;
  softWaitForSelector?: string;
  onFailedRequest?: (info: {
    url: string;
    loadedUrl: string | null;
    errorMessages: string[];
    retryCount: number;
  }) => Promise<void>;
  onSkippedUrl?: (url: string, reason: string) => void;
  deduplication?: 'minimal' | 'basic' | 'full';
}

function toTrafilaturaConfig(opts: ContextractorCrawlerOptions): TrafilaturaConfig {
  return {
    ...DEFAULT_CONFIG,
    favorPrecision: opts.mode === 'precision',
    favorRecall: opts.mode === 'recall',
    includeComments: opts.includeComments ?? DEFAULT_CONFIG.includeComments,
    includeTables: opts.includeTables ?? DEFAULT_CONFIG.includeTables,
    includeImages: opts.includeImages ?? DEFAULT_CONFIG.includeImages,
    includeFormatting: true,
    includeLinks: opts.includeLinks ?? DEFAULT_CONFIG.includeLinks,
    deduplicate: false,
    targetLanguage:
      opts.targetLanguage !== undefined && opts.targetLanguage !== ''
        ? opts.targetLanguage
        : DEFAULT_CONFIG.targetLanguage,
    withMetadata: true,
    onlyWithMetadata: false,
    fast: false,
    teiValidation: false,
  };
}

// From @apify/scraper-tools SESSION_MAX_USAGE_COUNTS (apify/actor-scraper).
const SESSION_MAX_USAGE_COUNTS = Object.freeze({
  RECOMMENDED: undefined,
  PER_REQUEST: 1,
  UNTIL_FAILURE: 1000,
} as const);

export function createContextractorCrawler(
  opts: ContextractorCrawlerOptions,
): CheerioCrawler | AdaptivePlaywrightCrawler | PlaywrightCrawler {
  const crawlerType = opts.crawlerType ?? 'playwright:adaptive';
  const cookieStrategy = opts.cookieStrategy ?? 'ghostery';
  const formats = opts.formats ?? ['markdown'];
  const deduplication: 'minimal' | 'basic' | 'full' = opts.deduplication ?? 'basic';
  const seenCanonicals = new Set<string>();
  const seenContentHashes = new Set<string>();

  if (crawlerType === 'cheerio') {
    const handler = createCheerioHandler({
      extractionConfig: toTrafilaturaConfig(opts),
      sink: opts.sink,
      formats,
      maxResults: opts.maxResults,
      linkSelector: opts.linkSelector,
      maxCrawlingDepth: opts.maxCrawlingDepth,
      globs: opts.globs,
      excludes: opts.excludes,
      keepUrlFragments: opts.keepUrlFragments,
      onSkippedUrl: opts.onSkippedUrl,
      deduplication,
      seenCanonicals,
      seenContentHashes,
    });

    const cheerioSessionPoolOpts = {
      ...(typeof opts.sessionPool === 'object' ? opts.sessionPool : {}),
      ...(opts.sessionPoolName ? { persistStateKey: opts.sessionPoolName } : {}),
    };
    const crawler = new CheerioCrawler({
      useSessionPool: opts.sessionPool !== false,
      ...(Object.keys(cheerioSessionPoolOpts).length > 0
        ? { sessionPoolOptions: cheerioSessionPoolOpts }
        : {}),
      maxRequestsPerCrawl: opts.maxPages && opts.maxPages > 0 ? opts.maxPages : undefined,
      maxRequestRetries: opts.maxRetries ?? 3,
      maxSessionRotations: opts.maxSessionRotations ?? 10,
      ...(opts.initialConcurrency ? { minConcurrency: opts.initialConcurrency } : {}),
      ...(opts.maxConcurrency !== undefined ? { maxConcurrency: opts.maxConcurrency } : {}),
      ...(opts.pageLoadTimeoutSecs !== undefined
        ? { requestHandlerTimeoutSecs: opts.pageLoadTimeoutSecs }
        : {}),
      ...(opts.respectRobotsTxt !== undefined
        ? { respectRobotsTxtFile: opts.respectRobotsTxt }
        : {}),
      proxyConfiguration: opts.proxyConfiguration,
      requestQueue: opts.requestQueue,
      ...(opts.requestList !== undefined ? { requestList: opts.requestList } : {}),
      additionalMimeTypes: ['text/html', 'application/xhtml+xml'],
      ...(opts.onFailedRequest
        ? {
            failedRequestHandler: async ({ request }, error) => {
              await opts.onFailedRequest?.({
                url: request.url,
                loadedUrl: request.loadedUrl ?? null,
                errorMessages: [...(request.errorMessages ?? []), error.message],
                retryCount: request.retryCount,
              });
            },
          }
        : {}),
    });
    crawler.router.addDefaultHandler(handler);
    return crawler;
  }

  const launcher = crawlerType === 'playwright:firefox' ? 'firefox' : 'chromium';

  const launchOptions = buildBrowserLaunchOptions({
    launcher,
    ignoreSslErrors: opts.ignoreSslErrors,
  });

  const useSessionPool = opts.sessionPool !== false;
  const userSessionPoolOptions =
    typeof opts.sessionPool === 'object' ? opts.sessionPool : undefined;

  const rotation = opts.proxyRotation ?? 'RECOMMENDED';
  const maxUsageCount = SESSION_MAX_USAGE_COUNTS[rotation];
  const rotationSessionPoolOptions = {
    sessionOptions: {
      ...(userSessionPoolOptions?.sessionOptions ?? {}),
      ...(maxUsageCount !== undefined ? { maxUsageCount } : {}),
    },
    ...(rotation === 'UNTIL_FAILURE' ? { maxPoolSize: 1 } : {}),
  };

  const sessionPoolOptions = {
    ...(userSessionPoolOptions ? { ...userSessionPoolOptions } : {}),
    ...rotationSessionPoolOptions,
    ...(opts.sessionPoolName ? { persistStateKey: opts.sessionPoolName } : {}),
  };

  const contextOptions: {
    bypassCSP?: boolean;
    storageState?: { cookies: unknown[] };
    extraHTTPHeaders?: Record<string, string>;
    userAgent?: string;
  } = {};
  if (opts.bypassCSP) contextOptions.bypassCSP = true;
  if (opts.initialCookies && opts.initialCookies.length > 0) {
    contextOptions.storageState = { cookies: opts.initialCookies };
  }
  if (opts.extraHTTPHeaders && Object.keys(opts.extraHTTPHeaders).length > 0) {
    contextOptions.extraHTTPHeaders = opts.extraHTTPHeaders;
  }
  if (opts.userAgent) contextOptions.userAgent = opts.userAgent;

  const baseOptions = {
    headless: opts.headless ?? true,
    launchContext: {
      launchOptions,
      ...(Object.keys(contextOptions).length > 0 ? { contextOptions } : {}),
    },
    useSessionPool,
    persistCookiesPerSession: useSessionPool,
    sessionPoolOptions,
    maxRequestsPerCrawl: opts.maxPages && opts.maxPages > 0 ? opts.maxPages : undefined,
    maxRequestRetries: opts.maxRetries ?? 3,
    maxSessionRotations: opts.maxSessionRotations ?? 10,
    ...(opts.initialConcurrency ? { minConcurrency: opts.initialConcurrency } : {}),
    ...(opts.maxConcurrency !== undefined ? { maxConcurrency: opts.maxConcurrency } : {}),
    ...(opts.pageLoadTimeoutSecs !== undefined
      ? {
          requestHandlerTimeoutSecs: opts.pageLoadTimeoutSecs,
          navigationTimeoutSecs: opts.pageLoadTimeoutSecs,
        }
      : {}),
    ...(opts.respectRobotsTxt !== undefined ? { respectRobotsTxtFile: opts.respectRobotsTxt } : {}),
    proxyConfiguration: opts.proxyConfiguration,
    requestQueue: opts.requestQueue,
    ...(opts.requestList !== undefined ? { requestList: opts.requestList } : {}),
  };

  if (crawlerType === 'playwright:adaptive') {
    const adaptivePreHooks: AdaptivePlaywrightCrawlerOptions['preNavigationHooks'] = [];
    const waitUntil = opts.waitUntil;
    if (waitUntil !== undefined) {
      adaptivePreHooks.push(async (_ctx, gotoOptions) => {
        if (gotoOptions) gotoOptions.waitUntil = waitUntil;
      });
    }
    if (opts.blockMedia) {
      adaptivePreHooks.push(async ({ page }) => {
        if (page) await playwrightUtils.blockRequests(page);
      });
    }
    if (cookieStrategy === 'ghostery') {
      adaptivePreHooks.push(async ({ page }) => {
        if (page) await installCookieDefences(page);
      });
    }

    const adaptivePostHooks: AdaptivePlaywrightCrawlerOptions['postNavigationHooks'] =
      cookieStrategy === 'autoconsent'
        ? [
            async ({ page, log }) => {
              if (!page) return;
              const result = await rejectViaAutoconsent(page);
              log.info(
                result.success
                  ? `autoconsent: rejected via ${result.cmp ?? 'unknown CMP'}`
                  : 'autoconsent: no CMP detected or timed out',
              );
            },
          ]
        : [];

    const adaptiveHandler = createAdaptiveHandler({
      extractionConfig: toTrafilaturaConfig(opts),
      sink: opts.sink,
      formats,
      maxResults: opts.maxResults,
      linkSelector: opts.linkSelector,
      maxCrawlingDepth: opts.maxCrawlingDepth,
      globs: opts.globs,
      excludes: opts.excludes,
      keepUrlFragments: opts.keepUrlFragments,
      onSkippedUrl: opts.onSkippedUrl,
      deduplication,
      seenCanonicals,
      seenContentHashes,
    });
    const adaptiveCrawler = new AdaptivePlaywrightCrawler({
      ...baseOptions,
      preventDirectStorageAccess: false,
      renderingTypeDetectionRatio: (opts.renderingTypeDetectionPercentage ?? 10) / 100,
      ...(adaptivePreHooks.length > 0 ? { preNavigationHooks: adaptivePreHooks } : {}),
      ...(adaptivePostHooks.length > 0 ? { postNavigationHooks: adaptivePostHooks } : {}),
      ...(opts.onFailedRequest
        ? {
            failedRequestHandler: async ({ request }, error) => {
              await opts.onFailedRequest?.({
                url: request.url,
                loadedUrl: request.loadedUrl ?? null,
                errorMessages: [...(request.errorMessages ?? []), error.message],
                retryCount: request.retryCount,
              });
            },
          }
        : {}),
    });
    adaptiveCrawler.router.addDefaultHandler(adaptiveHandler);
    return adaptiveCrawler;
  }

  const preNavigationHooks: PlaywrightHook[] = [];
  const waitUntil = opts.waitUntil;
  if (waitUntil !== undefined) {
    preNavigationHooks.push(async (_ctx, gotoOptions) => {
      if (gotoOptions) gotoOptions.waitUntil = waitUntil;
    });
  }
  if (opts.blockMedia) {
    preNavigationHooks.push(async ({ page }) => playwrightUtils.blockRequests(page));
  }
  if (cookieStrategy === 'ghostery') {
    preNavigationHooks.push(async ({ page }) => installCookieDefences(page));
  }

  const postNavigationHooks: PlaywrightHook[] =
    cookieStrategy === 'autoconsent'
      ? [
          async ({ page, log }) => {
            const result = await rejectViaAutoconsent(page);
            log.info(
              result.success
                ? `autoconsent: rejected via ${result.cmp ?? 'unknown CMP'}`
                : 'autoconsent: no CMP detected or timed out',
            );
          },
        ]
      : [];

  const handler = createHandler({
    extractionConfig: toTrafilaturaConfig(opts),
    sink: opts.sink,
    scroll: opts.scroll,
    formats,
    maxResults: opts.maxResults,
    linkSelector: opts.linkSelector,
    maxCrawlingDepth: opts.maxCrawlingDepth,
    globs: opts.globs,
    excludes: opts.excludes,
    keepUrlFragments: opts.keepUrlFragments,
    onSkippedUrl: opts.onSkippedUrl,
    dynamicContentWaitSecs: opts.dynamicContentWaitSecs,
    waitForSelector: opts.waitForSelector,
    softWaitForSelector: opts.softWaitForSelector,
    deduplication,
    seenCanonicals,
    seenContentHashes,
  });

  const crawler = new PlaywrightCrawler({
    ...baseOptions,
    ...(preNavigationHooks.length > 0 ? { preNavigationHooks } : {}),
    ...(postNavigationHooks.length > 0 ? { postNavigationHooks } : {}),
    ...(opts.onFailedRequest
      ? {
          failedRequestHandler: async ({ request }, error) => {
            await opts.onFailedRequest?.({
              url: request.url,
              loadedUrl: request.loadedUrl ?? null,
              errorMessages: [...(request.errorMessages ?? []), error.message],
              retryCount: request.retryCount,
            });
          },
        }
      : {}),
  });
  crawler.router.addDefaultHandler(handler);
  return crawler;
}

export function buildRequests(startUrls: string[], keepUrlFragments = false): Request[] {
  return startUrls.map((url) => new Request({ url, keepUrlFragment: keepUrlFragments }));
}
