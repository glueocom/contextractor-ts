import type { OutputFormat, TrafilaturaConfig } from '@contextractor/extraction';
import type { ProxyConfiguration, SessionPoolOptions } from 'crawlee';
import { PlaywrightCrawler, Request } from 'crawlee';
import { installCookieDefences, rejectViaAutoconsent } from './browser/cookies.js';
import { buildBrowserLaunchOptions } from './browser/launchOptions.js';
import type { ScrollConfig } from './browser/scroll.js';
import { createHandler } from './handler.js';
import type { ExtractionResult, Sink } from './sinks/types.js';

export interface ContextractorCrawlerOptions {
  startUrls: string[];
  sink: Sink<ExtractionResult>;
  extractionConfig?: TrafilaturaConfig;
  formats?: OutputFormat[];
  scroll?: ScrollConfig;
  cookieStrategy?: 'ghostery' | 'autoconsent' | 'none';
  sessionPool?: boolean | SessionPoolOptions;
  maxPages?: number;
  maxRetries?: number;
  maxConcurrency?: number;
  pageLoadTimeoutSecs?: number;
  headless?: boolean;
  launcher?: 'chromium' | 'firefox';
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
  browserLog?: boolean;
}

export function createContextractorCrawler(opts: ContextractorCrawlerOptions): PlaywrightCrawler {
  const launcher = opts.launcher ?? 'chromium';
  const cookieStrategy = opts.cookieStrategy ?? 'ghostery';
  const formats = opts.formats ?? ['markdown'];

  const launchOptions = buildBrowserLaunchOptions({
    launcher,
    ignoreSslErrors: opts.ignoreSslErrors,
  });

  const useSessionPool = opts.sessionPool !== false;
  const sessionPoolOptions = typeof opts.sessionPool === 'object' ? opts.sessionPool : undefined;

  const contextOptions: Record<string, unknown> = {};
  if (opts.bypassCSP) contextOptions.bypassCSP = true;
  if (opts.initialCookies && opts.initialCookies.length > 0) {
    contextOptions.storageState = { cookies: opts.initialCookies };
  }
  if (opts.extraHTTPHeaders) contextOptions.extraHTTPHeaders = opts.extraHTTPHeaders;
  if (opts.userAgent) contextOptions.userAgent = opts.userAgent;

  const handler = createHandler({
    extractionConfig: opts.extractionConfig,
    sink: opts.sink,
    scroll: opts.scroll,
    formats,
    maxResults: opts.maxResults,
    linkSelector: opts.linkSelector,
    maxCrawlingDepth: opts.maxCrawlingDepth,
    globs: opts.globs,
    excludes: opts.excludes,
    keepUrlFragments: opts.keepUrlFragments,
  });

  const crawler = new PlaywrightCrawler({
    headless: opts.headless ?? true,
    launchContext: {
      launchOptions,
      ...(Object.keys(contextOptions).length > 0 ? { contextOptions } : {}),
    },
    useSessionPool,
    persistCookiesPerSession: useSessionPool,
    ...(sessionPoolOptions ? { sessionPoolOptions } : {}),
    maxRequestsPerCrawl: opts.maxPages && opts.maxPages > 0 ? opts.maxPages : undefined,
    maxRequestRetries: opts.maxRetries ?? 3,
    ...(opts.maxConcurrency !== undefined ? { maxConcurrency: opts.maxConcurrency } : {}),
    ...(opts.pageLoadTimeoutSecs !== undefined
      ? {
          requestHandlerTimeoutSecs: opts.pageLoadTimeoutSecs,
          navigationTimeoutSecs: opts.pageLoadTimeoutSecs,
        }
      : {}),
    proxyConfiguration: opts.proxyConfiguration,
    ...(cookieStrategy === 'ghostery'
      ? {
          preNavigationHooks: [async ({ page }) => installCookieDefences(page)],
        }
      : {}),
    ...(cookieStrategy === 'autoconsent'
      ? {
          postNavigationHooks: [
            async ({ page, log }) => {
              const result = await rejectViaAutoconsent(page);
              log.info(
                result.success
                  ? `autoconsent: rejected via ${result.cmp ?? 'unknown CMP'}`
                  : 'autoconsent: no CMP detected or timed out',
              );
            },
          ],
        }
      : {}),
  });

  crawler.router.addDefaultHandler(handler);

  return crawler;
}

export function buildRequests(startUrls: string[], keepUrlFragments = false): Request[] {
  return startUrls.map((url) => new Request({ url, keepUrlFragment: keepUrlFragments }));
}
