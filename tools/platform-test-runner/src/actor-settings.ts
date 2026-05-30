/**
 * Actor input settings from a suite's `settings.json` (a subset of the
 * Contextractor input schema; the Actor validates the full input with Zod).
 * `startUrls` is added by the runner from `urls.json`.
 */
export interface ActorSettings {
  save?: Array<'txt' | 'markdown' | 'json' | 'html' | 'original'>;
  saveDestination?: Array<'key-value-store' | 'dataset'>;
  mode?: 'precision' | 'balanced' | 'recall';
  crawlerType?: 'playwright-adaptive' | 'playwright-firefox' | 'playwright-chromium' | 'cheerio';
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  maxCrawlPages?: number;
  maxCrawlDepth?: number;
  maxResultsPerCrawl?: number;
  maxRequestRetries?: number;
  pageLoadTimeoutSecs?: number;
  linkSelector?: string;
  keepUrlFragments?: boolean;
  includeUrlGlobs?: Array<{ glob: string }>;
  excludeUrlGlobs?: Array<{ glob: string }>;

  [key: string]: unknown;
}
