#!/usr/bin/env node
import { Command, Option } from 'commander';
import {
    type CrawlConfig,
    defaultCrawlConfig,
    loadConfigFile,
    mergeOverrides,
    validateSaveFormats,
} from './config.js';
import { runCrawl } from './crawler.js';

const program = new Command();

program
    .name('contextractor')
    .description('Extract web content from URLs using configurable extraction options.')
    .version('0.3.12');

program
    .command('extract', { isDefault: true })
    .description('Extract content from web pages.')
    .argument('[urls...]', 'URLs to extract content from')
    .option('-c, --config <path>', 'Path to JSON config file')
    .option('--max-pages <n>', 'Max pages to crawl (0 = unlimited)', parseIntOpt)
    .option('--crawl-depth <n>', 'Max link depth from start URLs', parseIntOpt)
    .option('--headless', 'Run browser in headless mode')
    .option('--no-headless', 'Run browser in headed mode')
    .option('-o, --output-dir <path>', 'Output directory')
    .option('--proxy-urls <csv>', 'Comma-separated proxy URLs')
    .option('--proxy-rotation <mode>', 'Proxy rotation: recommended, per_request, until_failure')
    .addOption(
        new Option('--launcher <browser>', 'Browser engine').choices([
            'chromium',
            'firefox',
            'webkit',
        ]),
    )
    .addOption(
        new Option('--wait-until <event>', 'Page load event').choices([
            'networkidle',
            'load',
            'domcontentloaded',
        ]),
    )
    .option('--page-load-timeout <secs>', 'Page load timeout in seconds', parseIntOpt)
    .option('--ignore-cors', 'Disable CORS/CSP restrictions')
    .option('--close-cookie-modals', 'Auto-dismiss cookie banners')
    .option('--no-close-cookie-modals', 'Do not auto-dismiss cookie banners')
    .option('--max-scroll-height <px>', 'Max scroll height in pixels', parseIntOpt)
    .option('--ignore-ssl-errors', 'Skip SSL certificate verification')
    .option('--user-agent <ua>', 'Custom User-Agent string')
    .option('--globs <csv>', 'Comma-separated glob patterns to include')
    .option('--excludes <csv>', 'Comma-separated glob patterns to exclude')
    .option('--link-selector <selector>', 'CSS selector for links to follow')
    .option('--keep-url-fragments', 'Preserve URL fragments')
    .option('--respect-robots-txt', 'Honor robots.txt')
    .option('--cookies <json>', 'JSON array of cookie objects')
    .option('--headers <json>', 'JSON object of custom HTTP headers')
    .option('--max-concurrency <n>', 'Max parallel requests', parseIntOpt)
    .option('--max-retries <n>', 'Max request retries', parseIntOpt)
    .option('--max-results <n>', 'Max results per crawl (0 = unlimited)', parseIntOpt)
    .option(
        '--save <csv>',
        'Output formats (markdown, html, text, json, jsonl, all). Default: markdown',
    )
    .option('--precision', 'High precision mode')
    .option('--recall', 'High recall mode')
    .option('--fast', 'Fast extraction mode')
    .option('--no-links', 'Exclude links from output')
    .option('--no-comments', 'Exclude comments from output')
    .option('--include-tables', 'Include tables (default)')
    .option('--no-tables', 'Exclude tables')
    .option('--include-images', 'Include image descriptions')
    .option('--include-formatting', 'Preserve text formatting')
    .option('--no-formatting', 'Strip text formatting')
    .option('--deduplicate', 'Deduplicate extracted content')
    .option('--target-language <lang>', "Filter by language (e.g. 'en')")
    .option('--with-metadata', 'Extract metadata (default)')
    .option('--no-metadata', 'Skip metadata extraction')
    .option('-v, --verbose', 'Enable verbose logging', false)
    .action(async (urls: string[], opts: Record<string, unknown>) => {
        let cfg: CrawlConfig = defaultCrawlConfig();
        if (opts.config) {
            cfg = loadConfigFile(opts.config as string);
        }

        const overrides: Record<string, unknown> = {
            maxPages: opts.maxPages,
            crawlDepth: opts.crawlDepth,
            headless: opts.headless,
            outputDir: opts.outputDir,
            proxyUrls: opts.proxyUrls
                ? (opts.proxyUrls as string)
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                : undefined,
            proxyRotation: opts.proxyRotation,
            launcher: opts.launcher ? (opts.launcher as string).toLowerCase() : undefined,
            waitUntil: opts.waitUntil ? (opts.waitUntil as string).toLowerCase() : undefined,
            pageLoadTimeout: opts.pageLoadTimeout,
            ignoreCors: opts.ignoreCors,
            closeCookieModals: opts.closeCookieModals,
            maxScrollHeight: opts.maxScrollHeight,
            ignoreSslErrors: opts.ignoreSslErrors,
            userAgent: opts.userAgent,
            globs: opts.globs
                ? (opts.globs as string)
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                : undefined,
            excludes: opts.excludes
                ? (opts.excludes as string)
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                : undefined,
            linkSelector: opts.linkSelector,
            keepUrlFragments: opts.keepUrlFragments,
            respectRobotsTxt: opts.respectRobotsTxt,
            cookies: opts.cookies ? JSON.parse(opts.cookies as string) : undefined,
            headers: opts.headers ? JSON.parse(opts.headers as string) : undefined,
            maxConcurrency: opts.maxConcurrency,
            maxRetries: opts.maxRetries,
            maxResults: opts.maxResults,
            save: opts.save
                ? validateSaveFormats((opts.save as string).split(',').map((s) => s.trim()))
                : undefined,
            fast: opts.fast,
            favorPrecision: opts.precision,
            favorRecall: opts.recall,
            includeTables: opts.tables,
            includeImages: opts.includeImages,
            includeFormatting: opts.formatting,
            includeLinks: opts.links,
            includeComments: opts.comments,
            deduplicate: opts.deduplicate,
            targetLanguage: opts.targetLanguage,
            withMetadata: opts.metadata,
        };

        mergeOverrides(cfg, overrides);

        if (urls.length > 0) {
            cfg.urls = urls;
        }

        if (cfg.urls.length === 0) {
            console.error('Error: No URLs specified. Provide URLs as arguments or via --config.');
            process.exit(1);
        }

        const formatsStr = cfg.save.length > 0 ? cfg.save.join(', ') : 'markdown';
        console.log(`Extracting ${cfg.urls.length} URL(s) → ${cfg.outputDir}/ (${formatsStr})`);
        await runCrawl(cfg);
    });

function parseIntOpt(value: string): number {
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n)) {
        throw new Error(`Invalid integer: ${value}`);
    }
    return n;
}

program.parseAsync().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
