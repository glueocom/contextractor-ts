import { createHash } from 'node:crypto';
import { ContentExtractor, type OutputFormat } from '@contextractor/engine';
import { log } from 'apify';
import type { PlaywrightCrawlingContext } from 'crawlee';
import {
    type KvsLike,
    computeContentInfo,
    extractFormat,
    extractMetadata,
    saveContentToKvs,
} from './extraction.js';
import type { CrawlConfig, SaveFormat } from './types.js';

export class ResultsCounter {
    count = 0;
    constructor(public maxResults: number) {}
    increment(): number {
        this.count += 1;
        return this.count;
    }
    isLimitReached(): boolean {
        return this.maxResults > 0 && this.count >= this.maxResults;
    }
}

interface HandlerDeps {
    kvs: KvsLike;
    dataset: { pushData(d: unknown): Promise<void> } | null;
    counter: ResultsCounter;
    config: CrawlConfig;
    browserLog: boolean;
}

const COOKIE_DISMISS_SCRIPT = `() => {
    if (window.Didomi) { try { window.Didomi.setUserAgreeToAll(); return; } catch {} }
    const onetrust = document.querySelector('#onetrust-accept-btn-handler');
    if (onetrust) { onetrust.click(); return; }
    const cookiebot = document.querySelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
    if (cookiebot) { cookiebot.click(); return; }
    const quantcast = document.querySelector('.qc-cmp2-summary-buttons button[mode="primary"]');
    if (quantcast) { quantcast.click(); return; }
    const selectors = [
        '[class*="cookie"] button', '[id*="cookie"] button',
        '[class*="consent"] button', '[id*="consent"] button',
        'button[class*="accept"]', 'button[id*="accept"]',
    ];
    for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn) { btn.click(); return; }
    }
}`;

const FORMAT_TABLE: Array<{
    save: SaveFormat;
    output: OutputFormat;
    dataKey: string;
    contentType: string;
    ext: string;
}> = [
    {
        save: 'text',
        output: 'txt',
        dataKey: 'extractedText',
        contentType: 'text/plain; charset=utf-8',
        ext: 'txt',
    },
    {
        save: 'json',
        output: 'json',
        dataKey: 'extractedJson',
        contentType: 'application/json; charset=utf-8',
        ext: 'json',
    },
    {
        save: 'markdown',
        output: 'markdown',
        dataKey: 'extractedMarkdown',
        contentType: 'text/markdown; charset=utf-8',
        ext: 'md',
    },
];

export function createRequestHandler(deps: HandlerDeps) {
    const { kvs, dataset, counter, config, browserLog } = deps;

    return async function handler(ctx: PlaywrightCrawlingContext): Promise<void> {
        if (counter.isLimitReached()) {
            log.info(`Max results (${counter.maxResults}) reached, stopping`);
            return;
        }

        const url = ctx.request.url;
        log.info(`Processing ${url}`);

        if (browserLog) {
            ctx.page.on('console', (msg) => {
                log.info(`[Browser] ${msg.type()}: ${msg.text()}`);
            });
        }

        if (config.closeCookieModals) {
            try {
                await ctx.page.evaluate(COOKIE_DISMISS_SCRIPT);
                await ctx.page.waitForTimeout(1000);
            } catch {
                // best effort
            }
        }

        const html = await ctx.page.content();
        const keyBase = createHash('md5').update(url).digest('hex').slice(0, 16);

        const extractor = new ContentExtractor(config.trafilaturaConfig);

        const htmlInfo = computeContentInfo(html);
        const data: Record<string, unknown> = {
            loadedUrl: url,
            rawHtml: htmlInfo,
            loadedAt: new Date().toISOString(),
            metadata: extractMetadata(html, url, extractor),
            httpStatus: ctx.response?.status() ?? 200,
        };

        if (config.save.includes('html')) {
            const htmlKey = `${keyBase}-raw.html`;
            await kvs.setValue(htmlKey, html, { contentType: 'text/html; charset=utf-8' });
            (data.rawHtml as Record<string, unknown>).key = htmlKey;
            (data.rawHtml as Record<string, unknown>).url = kvs.getPublicUrl(htmlKey);
        }

        for (const f of FORMAT_TABLE) {
            if (!config.save.includes(f.save)) continue;
            const content = extractFormat(html, f.output, extractor, url);
            if (content) {
                const key = `${keyBase}.${f.ext}`;
                data[f.dataKey] = await saveContentToKvs(kvs, key, content, f.contentType);
            }
        }

        if (dataset) {
            await dataset.pushData(data);
        } else {
            await ctx.pushData(data);
        }

        counter.increment();
        if (counter.isLimitReached()) {
            log.info(`Max results (${counter.maxResults}) reached, stopping crawler`);
            await ctx.crawler.autoscaledPool?.abort();
            return;
        }

        if (config.linkSelector) {
            const currentDepth = (ctx.request.userData?.depth as number | undefined) ?? 0;
            if (config.maxCrawlingDepth === 0 || currentDepth < config.maxCrawlingDepth) {
                await ctx.enqueueLinks({
                    selector: config.linkSelector,
                    globs: config.globs.map((g) => g.glob).filter(Boolean),
                    exclude: config.excludes.map((g) => g.glob).filter(Boolean),
                    userData: { depth: currentDepth + 1 },
                });
            }
        }
    };
}
