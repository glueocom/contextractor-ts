import { type TrafilaturaConfig, configFromJson } from '@contextractor/engine';
import type { ActorInput, CrawlConfig, SaveFormat } from './types.js';

export function buildCrawlConfig(input: ActorInput): CrawlConfig {
    const formatMap: Array<[keyof ActorInput, SaveFormat, boolean]> = [
        ['saveExtractedMarkdownToKeyValueStore', 'markdown', true],
        ['saveRawHtmlToKeyValueStore', 'html', false],
        ['saveExtractedTextToKeyValueStore', 'text', false],
        ['saveExtractedJsonToKeyValueStore', 'json', false],
    ];
    const save: SaveFormat[] = [];
    for (const [inputKey, format, defaultOn] of formatMap) {
        const enabled = (input[inputKey] as boolean | undefined) ?? defaultOn;
        if (enabled) save.push(format);
    }

    const trafilaturaConfigRaw = input.trafilaturaConfig ?? {};
    const trafilaturaConfig: Partial<TrafilaturaConfig> = configFromJson(trafilaturaConfigRaw);

    return {
        save: save.length > 0 ? save : ['markdown'],
        trafilaturaConfigRaw,
        trafilaturaConfig,
        globs: input.globs ?? [],
        excludes: input.excludes ?? [],
        linkSelector: input.linkSelector ?? '',
        pseudoUrls: input.pseudoUrls ?? [],
        keepUrlFragments: input.keepUrlFragments ?? false,
        maxCrawlingDepth: input.maxCrawlingDepth ?? 0,
        closeCookieModals: input.closeCookieModals ?? true,
    };
}

export function buildBrowserLaunchOptions(input: ActorInput): Record<string, unknown> {
    const opts: Record<string, unknown> = {
        args: ['--disable-gpu', '--disable-blink-features=AutomationControlled'],
    };
    if (input.ignoreSslErrors) {
        opts.ignoreHTTPSErrors = true;
    }
    return opts;
}

export function buildBrowserContextOptions(input: ActorInput): Record<string, unknown> | undefined {
    const opts: Record<string, unknown> = {};
    if (input.ignoreCorsAndCsp) opts.bypassCSP = true;
    if (input.initialCookies && input.initialCookies.length > 0) {
        opts.storageState = { cookies: input.initialCookies };
    }
    if (input.customHttpHeaders && Object.keys(input.customHttpHeaders).length > 0) {
        opts.extraHTTPHeaders = input.customHttpHeaders;
    }
    if (input.userAgent) opts.userAgent = input.userAgent;
    return Object.keys(opts).length > 0 ? opts : undefined;
}
