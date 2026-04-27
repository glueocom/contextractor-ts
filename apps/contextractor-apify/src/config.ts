import { normalizeConfigKeys, type TrafilaturaConfig } from '@contextractor/engine';

export type SaveFormat = 'markdown' | 'html' | 'text' | 'json';

export interface CrawlConfig {
  save: SaveFormat[];
  trafilaturaConfig: TrafilaturaConfig;
  globs: Array<{ glob: string }>;
  excludes: Array<{ glob: string }>;
  linkSelector: string;
  pseudoUrls: Array<{ purl?: string }>;
  keepUrlFragments: boolean;
  maxCrawlingDepth: number;
  closeCookieModals: boolean;
  maxScrollHeightPixels: number;
}

export interface ActorInput {
  startUrls?: Array<{ url: string }>;
  trafilaturaConfig?: Record<string, unknown>;
  globs?: Array<{ glob: string }>;
  excludes?: Array<{ glob: string }>;
  pseudoUrls?: Array<{ purl?: string }>;
  linkSelector?: string;
  keepUrlFragments?: boolean;
  respectRobotsTxtFile?: boolean;
  maxPagesPerCrawl?: number;
  maxResultsPerCrawl?: number;
  maxCrawlingDepth?: number;
  maxConcurrency?: number;
  maxRequestRetries?: number;
  pageLoadTimeoutSecs?: number;
  waitUntil?: 'NETWORKIDLE' | 'LOAD' | 'DOMCONTENTLOADED';
  launcher?: 'CHROMIUM' | 'FIREFOX';
  headless?: boolean;
  ignoreCorsAndCsp?: boolean;
  ignoreSslErrors?: boolean;
  closeCookieModals?: boolean;
  maxScrollHeightPixels?: number;
  userAgent?: string;
  initialCookies?: unknown[];
  customHttpHeaders?: Record<string, string>;
  saveRawHtmlToKeyValueStore?: boolean;
  saveExtractedTextToKeyValueStore?: boolean;
  saveExtractedJsonToKeyValueStore?: boolean;
  saveExtractedMarkdownToKeyValueStore?: boolean;
  datasetName?: string;
  keyValueStoreName?: string;
  requestQueueName?: string;
  proxyConfiguration?: unknown;
  proxyRotation?: 'RECOMMENDED' | 'PER_REQUEST' | 'UNTIL_FAILURE';
  debugLog?: boolean;
  browserLog?: boolean;
}

export function buildCrawlConfig(input: ActorInput): CrawlConfig {
  const formatMapping: Array<[keyof ActorInput, SaveFormat]> = [
    ['saveExtractedMarkdownToKeyValueStore', 'markdown'],
    ['saveRawHtmlToKeyValueStore', 'html'],
    ['saveExtractedTextToKeyValueStore', 'text'],
    ['saveExtractedJsonToKeyValueStore', 'json'],
  ];

  const save: SaveFormat[] = [];
  for (const [apifyKey, fmt] of formatMapping) {
    const value = input[apifyKey];
    const fallback = fmt === 'markdown';
    const enabled = typeof value === 'boolean' ? value : fallback;
    if (enabled) save.push(fmt);
  }

  return {
    save: save.length === 0 ? ['markdown'] : save,
    trafilaturaConfig: normalizeConfigKeys(input.trafilaturaConfig),
    globs: input.globs ?? [],
    excludes: input.excludes ?? [],
    pseudoUrls: input.pseudoUrls ?? [],
    linkSelector: input.linkSelector ?? '',
    keepUrlFragments: input.keepUrlFragments ?? false,
    maxCrawlingDepth: input.maxCrawlingDepth ?? 0,
    closeCookieModals: input.closeCookieModals ?? true,
    maxScrollHeightPixels: input.maxScrollHeightPixels ?? 5000,
  };
}

export function buildBrowserLaunchOptions(input: ActorInput): {
  args: string[];
  ignoreHTTPSErrors?: boolean;
} {
  const options: { args: string[]; ignoreHTTPSErrors?: boolean } = {
    args: ['--disable-gpu', '--disable-blink-features=AutomationControlled'],
  };
  if (input.ignoreSslErrors) options.ignoreHTTPSErrors = true;
  return options;
}

export function buildBrowserContextOptions(input: ActorInput):
  | {
      bypassCSP?: boolean;
      storageState?: { cookies: unknown[] };
      extraHTTPHeaders?: Record<string, string>;
      userAgent?: string;
    }
  | undefined {
  const options: {
    bypassCSP?: boolean;
    storageState?: { cookies: unknown[] };
    extraHTTPHeaders?: Record<string, string>;
    userAgent?: string;
  } = {};

  if (input.ignoreCorsAndCsp) options.bypassCSP = true;
  if (input.initialCookies && input.initialCookies.length > 0) {
    options.storageState = { cookies: input.initialCookies };
  }
  if (input.customHttpHeaders && Object.keys(input.customHttpHeaders).length > 0) {
    options.extraHTTPHeaders = input.customHttpHeaders;
  }
  if (input.userAgent) options.userAgent = input.userAgent;

  return Object.keys(options).length > 0 ? options : undefined;
}
