import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ContextractorInputType } from '@contextractor/schema';

export type SaveFormat = 'markdown' | 'html' | 'txt' | 'json' | 'original';

const SORTED_SAVE_FORMATS = ['html', 'json', 'markdown', 'original', 'txt'] as const;

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
  maxRequestsPerCrawl: number;
  maxCrawlDepth: number;
  headless: boolean;
  mode: 'precision' | 'balanced' | 'recall';
  includeComments: boolean;
  includeTables: boolean;
  includeImages: boolean;
  includeLinks: boolean;
  languageCode: string;

  // Browser.
  crawlerType: 'playwright-adaptive' | 'playwright-firefox' | 'playwright-chromium' | 'cheerio';
  renderingTypeDetectionRatio: number;
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  navigationTimeoutSecs: number;
  ignoreCors: boolean;
  closeCookieModals: boolean;
  maxScrollHeight: number;
  blockMedia: boolean;
  ignoreHttpsErrors: boolean;
  userAgent: string;

  // Crawl filtering.
  globs: string[];
  exclude: string[];
  selector: string;
  keepUrlFragment: boolean;
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
  waitForDynamicContentSecs: number;
  waitForSelector: string;
  softWaitForSelector: string;

  // Deduplication.
  deduplication: 'minimal' | 'standard' | 'aggressive';

  // Output formats.
  save: SaveFormat[];

  // Session pool.
  sessionPoolName: string | undefined;
  maxSessionRotations: number;
}

export interface CliOnlyOverrides {
  urls: string[];
  save: SaveFormat[];
  proxyUrls: string[];
  proxyRotation?: 'recommended' | 'per-request' | 'until-failure';
}

// TODO(phase-2): hoist this projection into `@contextractor/schema` so the
// Apify Actor and the standalone CLI share a single buildCrawlConfig.
export function buildCrawlConfig(
  input: ContextractorInputType,
  cli: CliOnlyOverrides,
): CrawlConfig {
  return {
    urls: cli.urls,
    save: cli.save,

    headless: input.headless,
    maxRequestsPerCrawl: input.maxRequestsPerCrawl,
    maxCrawlDepth: input.maxCrawlDepth,
    crawlerType: input.crawlerType,
    renderingTypeDetectionRatio: input.renderingTypeDetectionRatio,
    waitUntil: input.waitUntil,
    navigationTimeoutSecs: input.navigationTimeoutSecs,
    ignoreCors: input.ignoreCorsAndCsp,
    closeCookieModals: input.closeCookieModals,
    maxScrollHeight: input.maxScrollHeight,
    blockMedia: input.blockMedia,
    ignoreHttpsErrors: input.ignoreHttpsErrors,
    userAgent: input.userAgent,
    globs: input.globs.map((g) => g.glob).filter((g): g is string => Boolean(g)),
    exclude: input.exclude.map((g) => g.glob).filter((g): g is string => Boolean(g)),
    selector: input.selector,
    keepUrlFragment: input.keepUrlFragment,
    respectRobotsTxt: input.respectRobotsTxtFile,
    cookies: input.initialCookies ?? [],
    headers: input.customHttpHeaders ?? {},
    initialConcurrency: input.initialConcurrency,
    maxConcurrency: input.maxConcurrency,
    maxRetries: input.maxRequestRetries,
    maxResults: input.maxResultsPerCrawl,
    waitForDynamicContentSecs: input.waitForDynamicContentSecs,
    waitForSelector: input.waitForSelector,
    softWaitForSelector: input.softWaitForSelector,
    deduplication: input.deduplication,
    mode: input.mode,
    includeComments: input.includeComments,
    includeTables: input.includeTables,
    includeImages: input.includeImages,
    includeLinks: input.includeLinks,
    languageCode: input.languageCode,
    sessionPoolName: input.sessionPoolName,
    maxSessionRotations: input.maxSessionRotations,
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
