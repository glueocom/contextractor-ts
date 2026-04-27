import { normalizeConfigKeys, type TrafilaturaConfig } from '@contextractor/engine';
import type { ContextractorInputType } from '@contextractor/schema';

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

export function buildCrawlConfig(input: ContextractorInputType): CrawlConfig {
  const formatMapping: Array<[keyof ContextractorInputType, SaveFormat]> = [
    ['saveExtractedMarkdownToKeyValueStore', 'markdown'],
    ['saveRawHtmlToKeyValueStore', 'html'],
    ['saveExtractedTextToKeyValueStore', 'text'],
    ['saveExtractedJsonToKeyValueStore', 'json'],
  ];

  const save: SaveFormat[] = [];
  for (const [apifyKey, fmt] of formatMapping) {
    if (input[apifyKey]) save.push(fmt);
  }

  return {
    save: save.length === 0 ? ['markdown'] : save,
    trafilaturaConfig: normalizeConfigKeys(input.trafilaturaConfig),
    globs: input.globs,
    excludes: input.excludes,
    pseudoUrls: input.pseudoUrls,
    linkSelector: input.linkSelector,
    keepUrlFragments: input.keepUrlFragments,
    maxCrawlingDepth: input.maxCrawlingDepth,
    closeCookieModals: input.closeCookieModals,
    maxScrollHeightPixels: input.maxScrollHeightPixels,
  };
}

export function buildBrowserLaunchOptions(input: ContextractorInputType): {
  args: string[];
  ignoreHTTPSErrors?: boolean;
} {
  const options: { args: string[]; ignoreHTTPSErrors?: boolean } = {
    args: ['--disable-gpu', '--disable-blink-features=AutomationControlled'],
  };
  if (input.ignoreSslErrors) options.ignoreHTTPSErrors = true;
  return options;
}

export function buildBrowserContextOptions(input: ContextractorInputType):
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
