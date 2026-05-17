import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ContextractorInputType } from '@contextractor/schema';

export type SaveFormat = 'markdown' | 'html' | 'txt' | 'json' | 'original';

const SORTED_SAVE_FORMATS = ['html', 'json', 'markdown', 'original', 'txt'] as const;

const WAIT_UNTIL_MAP = {
  NETWORKIDLE: 'networkidle',
  LOAD: 'load',
  DOMCONTENTLOADED: 'domcontentloaded',
} as const;

function isSaveFormat(value: string): value is SaveFormat {
  switch (value) {
    case 'markdown':
    case 'html':
    case 'txt':
    case 'json':
    case 'original':
      return true;
    default:
      return false;
  }
}

export function validateSaveFormats(formats: string[]): SaveFormat[] {
  const out: SaveFormat[] = [];
  for (const raw of formats) {
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'all') {
      return [...SORTED_SAVE_FORMATS];
    }
    if (!isSaveFormat(normalized)) {
      throw new Error(
        `Unknown save format: '${normalized}'. Valid: ${SORTED_SAVE_FORMATS.join(', ')}`,
      );
    }
    if (!out.includes(normalized)) out.push(normalized);
  }
  return out;
}

interface CrawlConfig {
  urls: string[];
  maxPages: number;
  outputDir: string;
  crawlDepth: number;
  headless: boolean;
  mode: 'precision' | 'balanced' | 'recall';
  includeComments: boolean;
  includeTables: boolean;
  includeImages: boolean;
  includeLinks: boolean;
  targetLanguage: string;

  // Browser.
  crawlerType: 'playwright:adaptive' | 'playwright:firefox' | 'playwright:chromium' | 'cheerio';
  renderingTypeDetectionPercentage: number;
  waitUntil: 'networkidle' | 'load' | 'domcontentloaded';
  pageLoadTimeout: number;
  ignoreCors: boolean;
  closeCookieModals: boolean;
  maxScrollHeight: number;
  blockMedia: boolean;
  ignoreSslErrors: boolean;
  userAgent: string;

  // Crawl filtering.
  globs: string[];
  excludes: string[];
  linkSelector: string;
  keepUrlFragments: boolean;
  respectRobotsTxt: boolean;

  // Cookies & headers.
  cookies: unknown[];
  headers: Record<string, string>;

  // Concurrency & retries.
  initialConcurrency: number;
  maxConcurrency: number;
  maxRetries: number;
  maxResults: number;

  // Selector waits.
  dynamicContentWaitSecs: number;
  waitForSelector: string;
  softWaitForSelector: string;

  // Canonical deduplication.
  ignoreCanonicalUrl: boolean;

  // Output formats.
  save: SaveFormat[];
}

export interface CliOnlyOverrides {
  urls: string[];
  outputDir: string;
  save: SaveFormat[];
  proxyUrls: string[];
  proxyRotation?: 'RECOMMENDED' | 'PER_REQUEST' | 'UNTIL_FAILURE';
}

// TODO(phase-2): hoist this projection into `@contextractor/schema` so the
// Apify Actor and the standalone CLI share a single buildCrawlConfig.
export function buildCrawlConfig(
  input: ContextractorInputType,
  cli: CliOnlyOverrides,
): CrawlConfig {
  return {
    urls: cli.urls,
    outputDir: cli.outputDir,
    save: cli.save,

    headless: input.headless,
    maxPages: input.maxPagesPerCrawl,
    crawlDepth: input.maxCrawlingDepth,
    crawlerType: input.crawlerType,
    renderingTypeDetectionPercentage: input.renderingTypeDetectionPercentage,
    waitUntil: WAIT_UNTIL_MAP[input.waitUntil],
    pageLoadTimeout: input.pageLoadTimeoutSecs,
    ignoreCors: input.ignoreCorsAndCsp,
    closeCookieModals: input.closeCookieModals,
    maxScrollHeight: input.maxScrollHeightPixels,
    blockMedia: input.blockMedia,
    ignoreSslErrors: input.ignoreSslErrors,
    userAgent: input.userAgent,
    globs: input.globs.map((g) => g.glob).filter((g): g is string => Boolean(g)),
    excludes: input.excludes.map((g) => g.glob).filter((g): g is string => Boolean(g)),
    linkSelector: input.linkSelector,
    keepUrlFragments: input.keepUrlFragments,
    respectRobotsTxt: input.respectRobotsTxtFile,
    cookies: input.initialCookies ?? [],
    headers: input.customHttpHeaders ?? {},
    initialConcurrency: input.initialConcurrency,
    maxConcurrency: input.maxConcurrency,
    maxRetries: input.maxRequestRetries,
    maxResults: input.maxResultsPerCrawl,
    dynamicContentWaitSecs: input.dynamicContentWaitSecs,
    waitForSelector: input.waitForSelector,
    softWaitForSelector: input.softWaitForSelector,
    ignoreCanonicalUrl: input.ignoreCanonicalUrl,
    mode: input.mode,
    includeComments: input.includeComments,
    includeTables: input.includeTables,
    includeImages: input.includeImages,
    includeLinks: input.includeLinks,
    targetLanguage: input.targetLanguage,
  };
}

export async function loadConfigFile(filePath: string): Promise<Partial<ContextractorInputType>> {
  const text = await readFile(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.yaml' || ext === '.yml') {
    throw new Error(`YAML config is not supported. Convert "${filePath}" to JSON format.`);
  }
  const data = JSON.parse(text);

  if (!isRecord(data)) {
    return {};
  }
  return data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
