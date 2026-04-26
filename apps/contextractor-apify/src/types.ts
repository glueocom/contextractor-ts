import type { TrafilaturaConfig } from '@contextractor/engine';

export type SaveFormat = 'html' | 'text' | 'json' | 'markdown';

export interface ActorInput {
    startUrls: { url: string }[];
    globs?: { glob: string }[];
    excludes?: { glob: string }[];
    pseudoUrls?: { purl?: string }[];
    linkSelector?: string;
    keepUrlFragments?: boolean;
    respectRobotsTxtFile?: boolean;
    initialCookies?: unknown[];
    customHttpHeaders?: Record<string, string>;
    maxPagesPerCrawl?: number;
    maxResultsPerCrawl?: number;
    maxCrawlingDepth?: number;
    maxConcurrency?: number;
    maxRequestRetries?: number;
    trafilaturaConfig?: Record<string, unknown>;
    saveRawHtmlToKeyValueStore?: boolean;
    saveExtractedTextToKeyValueStore?: boolean;
    saveExtractedJsonToKeyValueStore?: boolean;
    saveExtractedMarkdownToKeyValueStore?: boolean;
    datasetName?: string;
    keyValueStoreName?: string;
    requestQueueName?: string;
    proxyConfiguration?: Parameters<typeof import('apify').Actor.createProxyConfiguration>[0];
    proxyRotation?: 'RECOMMENDED' | 'PER_REQUEST' | 'UNTIL_FAILURE';
    pageLoadTimeoutSecs?: number;
    waitUntil?: 'networkidle' | 'load' | 'domcontentloaded';
    launcher?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    ignoreCorsAndCsp?: boolean;
    closeCookieModals?: boolean;
    maxScrollHeightPixels?: number;
    userAgent?: string;
    ignoreSslErrors?: boolean;
    debugLog?: boolean;
    browserLog?: boolean;
}

export interface CrawlConfig {
    save: SaveFormat[];
    trafilaturaConfigRaw: Record<string, unknown>;
    trafilaturaConfig: Partial<TrafilaturaConfig>;
    globs: { glob: string }[];
    excludes: { glob: string }[];
    linkSelector: string;
    pseudoUrls: { purl?: string }[];
    keepUrlFragments: boolean;
    maxCrawlingDepth: number;
    closeCookieModals: boolean;
}
