import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { DEFAULT_CONFIG, type TrafilaturaConfig, configFromJson } from '@contextractor/engine';

export type SaveFormat = 'markdown' | 'html' | 'text' | 'json' | 'jsonl';

export const VALID_SAVE_FORMATS: readonly SaveFormat[] = [
    'markdown',
    'html',
    'text',
    'json',
    'jsonl',
];

export function validateSaveFormats(formats: string[]): SaveFormat[] {
    const out: SaveFormat[] = [];
    for (const raw of formats) {
        const fmt = raw.trim().toLowerCase();
        if (fmt === 'all') {
            return [...VALID_SAVE_FORMATS];
        }
        if (!VALID_SAVE_FORMATS.includes(fmt as SaveFormat)) {
            throw new Error(
                `Unknown save format: '${fmt}'. Valid: ${VALID_SAVE_FORMATS.join(', ')}`,
            );
        }
        if (!out.includes(fmt as SaveFormat)) {
            out.push(fmt as SaveFormat);
        }
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
    proxyUrls: string[];
    proxyRotation: string;
    proxyTiered: (string | null)[][];
    launcher: 'chromium' | 'firefox' | 'webkit';
    waitUntil: 'load' | 'domcontentloaded' | 'networkidle';
    pageLoadTimeout: number;
    ignoreCors: boolean;
    closeCookieModals: boolean;
    maxScrollHeight: number;
    ignoreSslErrors: boolean;
    userAgent: string;
    globs: string[];
    excludes: string[];
    linkSelector: string;
    keepUrlFragments: boolean;
    respectRobotsTxt: boolean;
    cookies: Record<string, unknown>[];
    headers: Record<string, string>;
    maxConcurrency: number;
    maxRetries: number;
    maxResults: number;
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
        proxyTiered: [],
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

function snakeToCamel<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        const ck = k.includes('_') ? k.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase()) : k;
        out[ck] = v;
    }
    return out;
}

function loadConfigText(text: string, suffix: string): unknown {
    if (suffix === '.json') {
        return JSON.parse(text);
    }
    // YAML support is silently retained per repo rule json-config-only.md.
    if (suffix === '.yaml' || suffix === '.yml') {
        // Lazy require to avoid a runtime dep when the user only uses JSON.
        // biome-ignore lint/suspicious/noExplicitAny: optional dep
        const yaml = require('node:module').createRequire(import.meta.url)('yaml') as any;
        return yaml.parse(text);
    }
    try {
        return JSON.parse(text);
    } catch {
        return {};
    }
}

export function loadConfigFile(path: string): CrawlConfig {
    const text = readFileSync(path, 'utf8');
    const data = loadConfigText(text, extname(path)) as Record<string, unknown>;
    return crawlConfigFromDict(data);
}

export function crawlConfigFromDict(raw: Record<string, unknown>): CrawlConfig {
    const data = snakeToCamel(raw);
    const cfg = defaultCrawlConfig();

    if (Array.isArray(data.urls)) cfg.urls = data.urls as string[];
    if (typeof data.maxPages === 'number') cfg.maxPages = data.maxPages;
    if (typeof data.outputDir === 'string') cfg.outputDir = data.outputDir;
    if (typeof data.crawlDepth === 'number') cfg.crawlDepth = data.crawlDepth;
    if (typeof data.headless === 'boolean') cfg.headless = data.headless;

    if (data.trafilaturaConfig && typeof data.trafilaturaConfig === 'object') {
        cfg.trafilaturaConfig = configFromJson(data.trafilaturaConfig as Record<string, unknown>);
    }

    const proxy = (data.proxy ?? {}) as Record<string, unknown>;
    if (Array.isArray(proxy.urls)) cfg.proxyUrls = proxy.urls as string[];
    if (typeof proxy.rotation === 'string')
        cfg.proxyRotation = (proxy.rotation as string).toLowerCase();
    if (Array.isArray(proxy.tiered)) cfg.proxyTiered = proxy.tiered as (string | null)[][];

    if (typeof data.launcher === 'string')
        cfg.launcher = data.launcher.toLowerCase() as CrawlConfig['launcher'];
    if (typeof data.waitUntil === 'string')
        cfg.waitUntil = data.waitUntil.toLowerCase() as CrawlConfig['waitUntil'];
    const plt = data.pageLoadTimeoutSecs ?? data.pageLoadTimeout;
    if (typeof plt === 'number') cfg.pageLoadTimeout = plt;
    const ic = data.ignoreCorsAndCsp ?? data.ignoreCors;
    if (typeof ic === 'boolean') cfg.ignoreCors = ic;
    if (typeof data.closeCookieModals === 'boolean') cfg.closeCookieModals = data.closeCookieModals;
    const msh = data.maxScrollHeightPixels ?? data.maxScrollHeight;
    if (typeof msh === 'number') cfg.maxScrollHeight = msh;
    if (typeof data.ignoreSslErrors === 'boolean') cfg.ignoreSslErrors = data.ignoreSslErrors;
    if (typeof data.userAgent === 'string') cfg.userAgent = data.userAgent;

    if (Array.isArray(data.globs)) cfg.globs = data.globs as string[];
    if (Array.isArray(data.excludes)) cfg.excludes = data.excludes as string[];
    if (typeof data.linkSelector === 'string') cfg.linkSelector = data.linkSelector;
    if (typeof data.keepUrlFragments === 'boolean') cfg.keepUrlFragments = data.keepUrlFragments;
    const rrt = data.respectRobotsTxtFile ?? data.respectRobotsTxt;
    if (typeof rrt === 'boolean') cfg.respectRobotsTxt = rrt;

    const cookiesIn = data.initialCookies ?? data.cookies;
    if (Array.isArray(cookiesIn)) cfg.cookies = cookiesIn as Record<string, unknown>[];
    const headersIn = data.customHttpHeaders ?? data.headers;
    if (headersIn && typeof headersIn === 'object')
        cfg.headers = headersIn as Record<string, string>;

    if (typeof data.maxConcurrency === 'number') cfg.maxConcurrency = data.maxConcurrency;
    const mr = data.maxRequestRetries ?? data.maxRetries;
    if (typeof mr === 'number') cfg.maxRetries = mr;
    const mrr = data.maxResultsPerCrawl ?? data.maxResults;
    if (typeof mrr === 'number') cfg.maxResults = mrr;

    if (Array.isArray(data.save)) cfg.save = validateSaveFormats(data.save as string[]);

    return cfg;
}

const TRAFILATURA_FIELDS = new Set<keyof TrafilaturaConfig>([
    'fast',
    'favorPrecision',
    'favorRecall',
    'includeComments',
    'includeTables',
    'includeImages',
    'includeFormatting',
    'includeLinks',
    'deduplicate',
    'targetLanguage',
    'withMetadata',
    'onlyWithMetadata',
    'teiValidation',
    'pruneXpath',
    'urlBlacklist',
    'authorBlacklist',
    'dateExtractionParams',
]);

const CRAWL_FIELDS = new Set<keyof CrawlConfig>([
    'urls',
    'maxPages',
    'outputDir',
    'crawlDepth',
    'headless',
    'proxyUrls',
    'proxyRotation',
    'proxyTiered',
    'launcher',
    'waitUntil',
    'pageLoadTimeout',
    'ignoreCors',
    'closeCookieModals',
    'maxScrollHeight',
    'ignoreSslErrors',
    'userAgent',
    'globs',
    'excludes',
    'linkSelector',
    'keepUrlFragments',
    'respectRobotsTxt',
    'cookies',
    'headers',
    'maxConcurrency',
    'maxRetries',
    'maxResults',
    'save',
]);

export function mergeOverrides(cfg: CrawlConfig, overrides: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(overrides)) {
        if (value === null || value === undefined) continue;
        if (CRAWL_FIELDS.has(key as keyof CrawlConfig)) {
            // biome-ignore lint/suspicious/noExplicitAny: dynamic projection from validated key set
            (cfg as any)[key] = value;
        } else if (TRAFILATURA_FIELDS.has(key as keyof TrafilaturaConfig)) {
            // biome-ignore lint/suspicious/noExplicitAny: dynamic projection from validated key set
            (cfg.trafilaturaConfig as any)[key] = value;
        }
    }
}

const URL_TO_FILENAME_MAX = 100;

export function urlToFilename(url: string): string {
    let slug = url.replace(/^https?:\/\//, '');
    slug = slug.replace(/[^a-zA-Z0-9]+/g, '-');
    slug = slug.replace(/^-+|-+$/g, '');
    if (slug.length > URL_TO_FILENAME_MAX) {
        const { createHash } = require('node:crypto') as typeof import('node:crypto');
        const hash = createHash('md5').update(url).digest('hex').slice(0, 8);
        slug = `${slug.slice(0, URL_TO_FILENAME_MAX)}-${hash}`;
    }
    return slug;
}
