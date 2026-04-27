import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CONFIG, normalizeConfigKeys, type TrafilaturaConfig } from '@contextractor/engine';

export type SaveFormat = 'markdown' | 'html' | 'text' | 'json' | 'jsonl';

export const VALID_SAVE_FORMATS: ReadonlySet<SaveFormat> = new Set([
  'markdown',
  'html',
  'text',
  'json',
  'jsonl',
]);

export function validateSaveFormats(formats: string[]): SaveFormat[] {
  const out: SaveFormat[] = [];
  for (const raw of formats) {
    const normalized = raw.trim().toLowerCase();
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

export function defaultCrawlConfig(): CrawlConfig {
  return {
    urls: [],
    maxPages: 0,
    outputDir: './output',
    crawlDepth: 0,
    headless: true,
    trafilaturaConfig: { ...DEFAULT_CONFIG },
    proxyUrls: [],
    proxyRotation: 'recommended',
    launcher: 'chromium',
    waitUntil: 'load',
    pageLoadTimeout: 60,
    ignoreCors: false,
    closeCookieModals: true,
    maxScrollHeight: 5000,
    ignoreSslErrors: false,
    userAgent: '',
    globs: [],
    excludes: [],
    linkSelector: '',
    keepUrlFragments: false,
    respectRobotsTxt: false,
    cookies: [],
    headers: {},
    maxConcurrency: 50,
    maxRetries: 3,
    maxResults: 0,
    save: ['markdown'],
  };
}

export async function loadConfigFile(filePath: string): Promise<CrawlConfig> {
  const text = await readFile(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  let data: Record<string, unknown> = {};

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

  return fromDict(data);
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

function fromDict(raw: Record<string, unknown>): CrawlConfig {
  const data = normalizeKeys(raw);

  const cfg = defaultCrawlConfig();

  cfg.urls = asStringArray(data.urls) ?? cfg.urls;
  cfg.maxPages = asNumber(data.max_pages) ?? cfg.maxPages;
  cfg.outputDir = asString(data.output_dir) ?? cfg.outputDir;
  cfg.crawlDepth = asNumber(data.crawl_depth) ?? cfg.crawlDepth;
  cfg.headless = asBoolean(data.headless) ?? cfg.headless;
  cfg.trafilaturaConfig = normalizeConfigKeys(asRecord(data.trafilatura_config));

  // Proxy section (nested).
  const proxy = asRecord(data.proxy);
  if (proxy) {
    const proxyData = normalizeKeys(proxy);
    cfg.proxyUrls = asStringArray(proxyData.urls) ?? cfg.proxyUrls;
    const rotation = asString(proxyData.rotation);
    if (rotation) {
      cfg.proxyRotation = rotation.replace(/-/g, '_').toLowerCase() as CrawlConfig['proxyRotation'];
    }
  }

  // Browser.
  const launcher = asString(data.launcher);
  if (launcher) cfg.launcher = launcher.toLowerCase() as CrawlConfig['launcher'];
  const waitUntil = asString(data.wait_until);
  if (waitUntil) cfg.waitUntil = waitUntil.toLowerCase() as CrawlConfig['waitUntil'];
  cfg.pageLoadTimeout =
    asNumber(data.page_load_timeout_secs) ??
    asNumber(data.page_load_timeout) ??
    cfg.pageLoadTimeout;
  cfg.ignoreCors =
    asBoolean(data.ignore_cors_and_csp) ?? asBoolean(data.ignore_cors) ?? cfg.ignoreCors;
  cfg.closeCookieModals = asBoolean(data.close_cookie_modals) ?? cfg.closeCookieModals;
  cfg.maxScrollHeight =
    asNumber(data.max_scroll_height_pixels) ??
    asNumber(data.max_scroll_height) ??
    cfg.maxScrollHeight;
  cfg.ignoreSslErrors = asBoolean(data.ignore_ssl_errors) ?? cfg.ignoreSslErrors;
  cfg.userAgent = asString(data.user_agent) ?? cfg.userAgent;

  // Filtering.
  cfg.globs = asStringArray(data.globs) ?? cfg.globs;
  cfg.excludes = asStringArray(data.excludes) ?? cfg.excludes;
  cfg.linkSelector = asString(data.link_selector) ?? cfg.linkSelector;
  cfg.keepUrlFragments = asBoolean(data.keep_url_fragments) ?? cfg.keepUrlFragments;
  cfg.respectRobotsTxt =
    asBoolean(data.respect_robots_txt_file) ??
    asBoolean(data.respect_robots_txt) ??
    cfg.respectRobotsTxt;

  // Cookies & headers.
  cfg.cookies = ((data.initial_cookies ?? data.cookies) as unknown[] | undefined) ?? cfg.cookies;
  cfg.headers =
    ((asRecord(data.custom_http_headers) ?? asRecord(data.headers)) as Record<string, string>) ??
    cfg.headers;

  // Concurrency.
  cfg.maxConcurrency = asNumber(data.max_concurrency) ?? cfg.maxConcurrency;
  cfg.maxRetries =
    asNumber(data.max_request_retries) ?? asNumber(data.max_retries) ?? cfg.maxRetries;
  cfg.maxResults =
    asNumber(data.max_results_per_crawl) ?? asNumber(data.max_results) ?? cfg.maxResults;

  // Save formats.
  const save = data.save;
  if (Array.isArray(save)) {
    cfg.save = validateSaveFormats(save.map(String));
  }

  return cfg;
}

function normalizeKeys(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[toSnakeCase(key)] = value;
  }
  return out;
}

function toSnakeCase(key: string): string {
  if (key.includes('_')) return key;
  return key.replace(/([A-Z])/g, (_, c: string) => `_${c.toLowerCase()}`);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((v): v is string => typeof v === 'string');
  return out.length === value.length ? out : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function mergeOverrides(
  cfg: CrawlConfig,
  overrides: Partial<Record<string, unknown>>,
): void {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null) continue;
    if (key in cfg) {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic projection.
      (cfg as any)[key] = value;
      continue;
    }
    if (key in cfg.trafilaturaConfig) {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic projection.
      (cfg.trafilaturaConfig as any)[key] = value;
    }
  }
}
