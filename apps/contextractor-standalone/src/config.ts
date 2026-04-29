import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeConfigKeys, type TrafilaturaConfig } from '@contextractor/extraction';
import { ContextractorInput, type ContextractorInputType } from '@contextractor/schema';

export type SaveFormat = 'markdown' | 'html' | 'txt' | 'json' | 'jsonl';

export const VALID_SAVE_FORMATS: ReadonlySet<SaveFormat> = new Set([
  'markdown',
  'html',
  'txt',
  'json',
  'jsonl',
]);

export function validateSaveFormats(formats: string[]): SaveFormat[] {
  const out: SaveFormat[] = [];
  for (const raw of formats) {
    let normalized = raw.trim().toLowerCase();
    if (normalized === 'text') normalized = 'txt';
    if (normalized === 'all') {
      return [...VALID_SAVE_FORMATS].sort() as SaveFormat[];
    }
    if (!VALID_SAVE_FORMATS.has(normalized as SaveFormat)) {
      throw new Error(
        `Unknown save format: '${raw}'. Valid: ${[...VALID_SAVE_FORMATS].sort().join(', ')}`,
      );
    }
    if (!out.includes(normalized as SaveFormat)) out.push(normalized as SaveFormat);
  }
  return out;
}

export interface CrawlConfig {
  urls: string[];
  maxPages: number;
  outputDir: string;
  crawlDepth: number;
  headless: boolean;
  trafilaturaConfig: TrafilaturaConfig;

  // Proxy.
  proxyUrls: string[];
  proxyRotation: 'recommended' | 'per_request' | 'until_failure';

  // Browser.
  launcher: 'chromium' | 'firefox';
  waitUntil: 'networkidle' | 'load' | 'domcontentloaded';
  pageLoadTimeout: number;
  ignoreCors: boolean;
  closeCookieModals: boolean;
  maxScrollHeight: number;
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
  maxConcurrency: number;
  maxRetries: number;
  maxResults: number;

  // Output formats.
  save: SaveFormat[];
}

export interface CliOnlyOverrides {
  urls: string[];
  outputDir: string;
  save: SaveFormat[];
  proxyUrls: string[];
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
    proxyUrls: cli.proxyUrls,

    headless: input.headless,
    maxPages: input.maxPagesPerCrawl,
    crawlDepth: input.maxCrawlingDepth,
    proxyRotation: input.proxyRotation.toLowerCase() as CrawlConfig['proxyRotation'],
    launcher: input.launcher.toLowerCase() as CrawlConfig['launcher'],
    waitUntil: input.waitUntil.toLowerCase() as CrawlConfig['waitUntil'],
    pageLoadTimeout: input.pageLoadTimeoutSecs,
    ignoreCors: input.ignoreCorsAndCsp,
    closeCookieModals: input.closeCookieModals,
    maxScrollHeight: input.maxScrollHeightPixels,
    ignoreSslErrors: input.ignoreSslErrors,
    userAgent: input.userAgent,
    globs: input.globs.map((g) => g.glob).filter((g): g is string => Boolean(g)),
    excludes: input.excludes.map((g) => g.glob).filter((g): g is string => Boolean(g)),
    linkSelector: input.linkSelector,
    keepUrlFragments: input.keepUrlFragments,
    respectRobotsTxt: input.respectRobotsTxtFile,
    cookies: input.initialCookies ?? [],
    headers: input.customHttpHeaders ?? {},
    maxConcurrency: input.maxConcurrency,
    maxRetries: input.maxRequestRetries,
    maxResults: input.maxResultsPerCrawl,
    trafilaturaConfig: normalizeConfigKeys(input.trafilaturaConfig),
  };
}

export async function loadConfigFile(filePath: string): Promise<Partial<ContextractorInputType>> {
  const text = await readFile(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  let data: unknown;

  if (ext === '.json') {
    data = JSON.parse(text);
  } else if (ext === '.yaml' || ext === '.yml') {
    data = await loadYaml(text);
  } else {
    try {
      data = JSON.parse(text);
    } catch {
      data = await loadYaml(text);
    }
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  return data as Partial<ContextractorInputType>;
}

async function loadYaml(text: string): Promise<Record<string, unknown>> {
  // Silent YAML support (per `.claude/rules/json-config-only.md`). Lazy-load
  // through dynamic import so the package stays optional. The cast through
  // `unknown` keeps the type strict without statically depending on `yaml`.
  let mod: { parse(text: string): unknown } | null = null;
  try {
    mod = (await import('yaml' as string)) as unknown as { parse(text: string): unknown };
  } catch {
    mod = null;
  }
  if (!mod || typeof mod.parse !== 'function') {
    throw new Error(
      'YAML config requested but the optional `yaml` package is not installed; convert your config to JSON.',
    );
  }
  const out = mod.parse(text) as Record<string, unknown> | null;
  return out ?? {};
}

export { ContextractorInput };
