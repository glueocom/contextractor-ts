import type { ContextractorInputType } from '@contextractor/schema';
import { type CliOnlyOverrides, type SaveFormat, validateSaveFormats } from './config.js';

export interface CliOptions {
  config?: string;
  startUrl?: string;
  format?: string;
  outputDir?: string;
  maxPages?: number;
  crawlDepth?: number;
  headless?: boolean;
  proxyUrls?: string;
  proxyRotation?: string;
  launcher?: string;
  waitUntil?: string;
  pageLoadTimeout?: number;
  ignoreCors?: boolean;
  closeCookieModals?: boolean;
  maxScrollHeight?: number;
  ignoreSslErrors?: boolean;
  userAgent?: string;
  globs?: string;
  excludes?: string;
  linkSelector?: string;
  keepUrlFragments?: boolean;
  respectRobotsTxt?: boolean;
  cookies?: string;
  headers?: string;
  maxConcurrency?: number;
  maxRetries?: number;
  maxResults?: number;
  save?: string;
  precision?: boolean;
  recall?: boolean;
  fast?: boolean;
  links?: boolean;
  comments?: boolean;
  includeTables?: boolean;
  tables?: boolean;
  includeImages?: boolean;
  includeFormatting?: boolean;
  formatting?: boolean;
  deduplicate?: boolean;
  targetLanguage?: string;
  metadata?: boolean;
  withMetadata?: boolean;
  verbose?: boolean;
}

export function toInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`Expected integer, got '${value}'`);
  return parsed;
}

export function buildSchemaOverrides(opts: CliOptions): Partial<ContextractorInputType> {
  const out: Partial<ContextractorInputType> = {};

  if (opts.maxPages !== undefined) out.maxPagesPerCrawl = opts.maxPages;
  if (opts.crawlDepth !== undefined) out.maxCrawlingDepth = opts.crawlDepth;
  if (opts.headless !== undefined) out.headless = opts.headless;
  if (opts.launcher)
    out.launcher = opts.launcher.toUpperCase() as ContextractorInputType['launcher'];
  if (opts.waitUntil)
    out.waitUntil = opts.waitUntil.toUpperCase() as ContextractorInputType['waitUntil'];
  if (opts.proxyRotation)
    out.proxyRotation = opts.proxyRotation
      .toUpperCase()
      .replace(/-/g, '_') as ContextractorInputType['proxyRotation'];
  if (opts.pageLoadTimeout !== undefined) out.pageLoadTimeoutSecs = opts.pageLoadTimeout;
  if (opts.ignoreCors !== undefined) out.ignoreCorsAndCsp = opts.ignoreCors;
  if (opts.closeCookieModals !== undefined) out.closeCookieModals = opts.closeCookieModals;
  if (opts.maxScrollHeight !== undefined) out.maxScrollHeightPixels = opts.maxScrollHeight;
  if (opts.ignoreSslErrors !== undefined) out.ignoreSslErrors = opts.ignoreSslErrors;
  if (opts.userAgent !== undefined) out.userAgent = opts.userAgent;
  if (opts.globs) out.globs = opts.globs.split(',').map((s) => ({ glob: s.trim() }));
  if (opts.excludes) out.excludes = opts.excludes.split(',').map((s) => ({ glob: s.trim() }));
  if (opts.linkSelector !== undefined) out.linkSelector = opts.linkSelector;
  if (opts.keepUrlFragments !== undefined) out.keepUrlFragments = opts.keepUrlFragments;
  if (opts.respectRobotsTxt !== undefined) out.respectRobotsTxtFile = opts.respectRobotsTxt;
  if (opts.cookies) out.initialCookies = JSON.parse(opts.cookies) as unknown[];
  if (opts.headers) out.customHttpHeaders = JSON.parse(opts.headers) as Record<string, string>;
  if (opts.maxConcurrency !== undefined) out.maxConcurrency = opts.maxConcurrency;
  if (opts.maxRetries !== undefined) out.maxRequestRetries = opts.maxRetries;
  if (opts.maxResults !== undefined) out.maxResultsPerCrawl = opts.maxResults;

  const tcfg: Record<string, unknown> = {};
  if (opts.fast !== undefined) tcfg.fast = opts.fast;
  if (opts.precision !== undefined) tcfg.favorPrecision = opts.precision;
  if (opts.recall !== undefined) tcfg.favorRecall = opts.recall;
  if (opts.includeTables !== undefined) tcfg.includeTables = opts.includeTables;
  if (opts.tables !== undefined) tcfg.includeTables = opts.tables;
  if (opts.includeImages !== undefined) tcfg.includeImages = opts.includeImages;
  if (opts.includeFormatting !== undefined) tcfg.includeFormatting = opts.includeFormatting;
  if (opts.formatting !== undefined) tcfg.includeFormatting = opts.formatting;
  if (opts.deduplicate !== undefined) tcfg.deduplicate = opts.deduplicate;
  if (opts.targetLanguage !== undefined) tcfg.targetLanguage = opts.targetLanguage;
  if (opts.metadata !== undefined) tcfg.withMetadata = opts.metadata;
  if (opts.withMetadata !== undefined) tcfg.withMetadata = opts.withMetadata;
  if (opts.links === false) tcfg.includeLinks = false;
  if (opts.comments === false) tcfg.includeComments = false;
  if (Object.keys(tcfg).length > 0) out.trafilaturaConfig = tcfg;

  return out;
}

export function resolveCliOnly(opts: CliOptions, input: ContextractorInputType): CliOnlyOverrides {
  const urls = input.startUrls
    .map((u) => u.url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  let save: SaveFormat[] = ['markdown'];
  if (opts.save) {
    save = validateSaveFormats(opts.save.split(','));
  } else if (opts.format) {
    save = validateSaveFormats([opts.format]);
  }

  const proxyUrls = opts.proxyUrls
    ? opts.proxyUrls
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  return { urls, outputDir: opts.outputDir ?? './output', save, proxyUrls };
}
