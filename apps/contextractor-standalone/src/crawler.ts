import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContentExtractor, type OutputFormat } from '@contextractor/engine';
import { PlaywrightCrawler, ProxyConfiguration, log } from 'crawlee';
import type { CrawlConfig, SaveFormat } from './config.js';
import { urlToFilename } from './config.js';

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

interface MetaHeader {
    title: string | null;
    author: string | null;
    date: string | null;
}

function buildTextWithHeader(
    raw: string,
    fmt: 'markdown' | 'txt',
    meta: MetaHeader,
    url: string,
): string {
    if (!(meta.title || meta.author || meta.date)) return raw;
    const lines: string[] = [];
    if (meta.title) lines.push(`Title: ${meta.title}`);
    if (meta.author) lines.push(`Author: ${meta.author}`);
    if (meta.date) lines.push(`Date: ${meta.date}`);
    lines.push(`URL: ${url}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(raw);
    return lines.join('\n');
}

const FORMAT_EXTENSIONS: Record<SaveFormat, string> = {
    markdown: '.md',
    text: '.txt',
    json: '.json',
    jsonl: '.jsonl',
    html: '.html',
};

export async function runCrawl(config: CrawlConfig): Promise<void> {
    mkdirSync(config.outputDir, { recursive: true });

    const extractor = new ContentExtractor(config.trafilaturaConfig);
    let pagesExtracted = 0;

    let proxyConfiguration: ProxyConfiguration | undefined;
    if (config.proxyTiered.length > 0) {
        proxyConfiguration = new ProxyConfiguration({ tieredProxyUrls: config.proxyTiered });
        log.info(`Using tiered proxy with ${config.proxyTiered.length} tier(s)`);
    } else if (config.proxyUrls.length > 0) {
        proxyConfiguration = new ProxyConfiguration({ proxyUrls: config.proxyUrls });
        log.info(
            `Using ${config.proxyUrls.length} proxy URL(s), rotation: ${config.proxyRotation}`,
        );
    }

    const crawler = new PlaywrightCrawler({
        headless: config.headless,
        navigationTimeoutSecs: config.pageLoadTimeout,
        maxRequestsPerCrawl: config.maxPages > 0 ? config.maxPages : undefined,
        maxRequestRetries: config.maxRetries,
        maxConcurrency: config.maxConcurrency,
        respectRobotsTxtFile: config.respectRobotsTxt,
        proxyConfiguration,
        launchContext: {
            launchOptions: {
                args: [
                    ...(config.launcher === 'chromium'
                        ? ['--disable-blink-features=AutomationControlled']
                        : []),
                    ...(process.env.CONTEXTRACTOR_NO_SANDBOX ? ['--no-sandbox'] : []),
                ],
                ...(config.ignoreSslErrors ? { ignoreHTTPSErrors: true } : {}),
            },
        },
        async requestHandler(ctx) {
            const url = ctx.request.url;
            log.info(`Processing ${url}`);

            if (config.maxResults > 0 && pagesExtracted >= config.maxResults) {
                log.info(`Reached max results limit (${config.maxResults}), skipping ${url}`);
                return;
            }

            if (config.closeCookieModals) {
                try {
                    await ctx.page.evaluate(COOKIE_DISMISS_SCRIPT);
                    await ctx.page.waitForTimeout(1000);
                } catch {
                    // best effort
                }
            }

            if (config.maxScrollHeight > 0) {
                try {
                    await ctx.page.evaluate(async (max: number) => {
                        let scrolled = 0;
                        while (scrolled < max) {
                            window.scrollBy(0, 500);
                            scrolled += 500;
                            await new Promise((r) => setTimeout(r, 100));
                        }
                        window.scrollTo(0, 0);
                    }, config.maxScrollHeight);
                } catch {
                    // best effort
                }
            }

            const html = await ctx.page.content();
            const slug = urlToFilename(url);
            const meta = extractor.extractMetadata(html, url);
            const headerMeta: MetaHeader = {
                title: meta.title,
                author: meta.author,
                date: meta.date,
            };

            let anySaved = false;

            const writeFmt = (fmt: OutputFormat, ext: string, header?: 'markdown' | 'txt') => {
                const r = extractor.extract(html, { url, format: fmt });
                if (!r) return;
                const content = header
                    ? buildTextWithHeader(r.content, header, headerMeta, url)
                    : r.content;
                const fp = join(config.outputDir, `${slug}${ext}`);
                writeFileSync(fp, content, 'utf8');
                log.info(`Saved ${fp}`);
                anySaved = true;
            };

            if (config.save.includes('markdown'))
                writeFmt('markdown', FORMAT_EXTENSIONS.markdown, 'markdown');
            if (config.save.includes('text')) writeFmt('txt', FORMAT_EXTENSIONS.text, 'txt');
            if (config.save.includes('json')) writeFmt('json', FORMAT_EXTENSIONS.json);
            if (config.save.includes('jsonl')) {
                const r = extractor.extract(html, { url, format: 'markdown' });
                if (r) {
                    const entry = {
                        url,
                        title: meta.title ?? '',
                        author: meta.author ?? '',
                        date: meta.date ?? '',
                        content: r.content,
                    };
                    const fp = join(config.outputDir, 'output.jsonl');
                    appendFileSync(fp, `${JSON.stringify(entry)}\n`, 'utf8');
                    log.info(`Appended to ${fp}`);
                    anySaved = true;
                }
            }
            if (config.save.includes('html')) {
                const fp = join(config.outputDir, `${slug}${FORMAT_EXTENSIONS.html}`);
                writeFileSync(fp, html, 'utf8');
                log.info(`Saved ${fp}`);
                anySaved = true;
            }

            if (!anySaved) {
                log.warning(`No content extracted from ${url}`);
                return;
            }

            pagesExtracted += 1;

            if (config.crawlDepth > 0) {
                await ctx.enqueueLinks({
                    selector: config.linkSelector || undefined,
                    globs: config.globs.length > 0 ? config.globs : undefined,
                    exclude: config.excludes.length > 0 ? config.excludes : undefined,
                });
            }
        },
    });

    await crawler.run(
        config.urls.map((url) => ({ url, keepUrlFragment: config.keepUrlFragments })),
    );
    log.info(`Done. Extracted ${pagesExtracted} pages to ${config.outputDir}`);
}
