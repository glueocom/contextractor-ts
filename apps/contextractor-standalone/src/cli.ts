#!/usr/bin/env node
import { Command } from 'commander';
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
  .version('0.1.0')
  .argument('[urls...]', 'URLs to extract content from')
  .option('-c, --config <path>', 'Path to JSON config file')
  .option('--start-url <url>', 'Start URL (alternative to positional URL)')
  .option('--format <fmt>', 'Output format: txt | markdown | json | html (alias of --save)')
  .option('-o, --output-dir <dir>', 'Output directory')
  .option('--max-pages <n>', 'Max pages to crawl (0 = unlimited)', toInt)
  .option('--crawl-depth <n>', 'Max link depth from start URLs (0 = start only)', toInt)
  .option('--headless', 'Run browser in headless mode')
  .option('--no-headless', 'Run browser with UI')
  .option('--proxy-urls <urls>', 'Comma-separated proxy URLs')
  .option('--proxy-rotation <strategy>', 'Proxy rotation: recommended, per_request, until_failure')
  .option('--launcher <type>', 'Browser engine: chromium, firefox')
  .option('--wait-until <event>', 'Page load event: networkidle, load, domcontentloaded')
  .option('--page-load-timeout <secs>', 'Page load timeout in seconds', toInt)
  .option('--ignore-cors', 'Disable CORS/CSP restrictions')
  .option('--close-cookie-modals', 'Auto-dismiss cookie banners')
  .option('--max-scroll-height <px>', 'Max scroll height in pixels', toInt)
  .option('--ignore-ssl-errors', 'Skip SSL certificate verification')
  .option('--user-agent <ua>', 'Custom User-Agent string')
  .option('--globs <patterns>', 'Comma-separated glob patterns to include')
  .option('--excludes <patterns>', 'Comma-separated glob patterns to exclude')
  .option('--link-selector <css>', 'CSS selector for links to follow')
  .option('--keep-url-fragments', 'Preserve URL fragments')
  .option('--respect-robots-txt', 'Honor robots.txt')
  .option('--cookies <json>', 'JSON array of cookie objects')
  .option('--headers <json>', 'JSON object of custom HTTP headers')
  .option('--max-concurrency <n>', 'Max parallel requests', toInt)
  .option('--max-retries <n>', 'Max request retries', toInt)
  .option('--max-results <n>', 'Max results per crawl (0 = unlimited)', toInt)
  .option('--save <formats>', 'Output formats: markdown,html,txt,json,jsonl,all')
  .option('--precision', 'High precision mode (less noise)')
  .option('--recall', 'High recall mode (more content)')
  .option('--fast', 'Fast extraction mode (less thorough)')
  .option('--no-links', 'Exclude links from output')
  .option('--no-comments', 'Exclude comments from output')
  .option('--include-tables', 'Include tables in output')
  .option('--no-tables', 'Exclude tables from output')
  .option('--include-images', 'Include image descriptions')
  .option('--include-formatting', 'Preserve text formatting')
  .option('--no-formatting', 'Drop text formatting')
  .option('--deduplicate', 'Deduplicate extracted content')
  .option('--target-language <lang>', 'Filter by language (e.g. en)')
  .option('--with-metadata', 'Extract metadata along with content')
  .option('--no-metadata', 'Skip metadata extraction')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (urls: string[], opts: CliOptions) => {
    if (opts.verbose) process.env.LOG_LEVEL = 'DEBUG';

    let cfg: CrawlConfig = defaultCrawlConfig();
    if (opts.config) {
      cfg = await loadConfigFile(opts.config);
    }

    const overrides: Record<string, unknown> = {};
    if (opts.maxPages !== undefined) overrides.maxPages = opts.maxPages;
    if (opts.crawlDepth !== undefined) overrides.crawlDepth = opts.crawlDepth;
    if (opts.headless !== undefined) overrides.headless = opts.headless;
    if (opts.outputDir) overrides.outputDir = opts.outputDir;
    if (opts.proxyUrls) overrides.proxyUrls = opts.proxyUrls.split(',').map((s) => s.trim());
    if (opts.proxyRotation) overrides.proxyRotation = opts.proxyRotation;
    if (opts.launcher) overrides.launcher = opts.launcher.toLowerCase();
    if (opts.waitUntil) overrides.waitUntil = opts.waitUntil.toLowerCase();
    if (opts.pageLoadTimeout !== undefined) overrides.pageLoadTimeout = opts.pageLoadTimeout;
    if (opts.ignoreCors !== undefined) overrides.ignoreCors = opts.ignoreCors;
    if (opts.closeCookieModals !== undefined) overrides.closeCookieModals = opts.closeCookieModals;
    if (opts.maxScrollHeight !== undefined) overrides.maxScrollHeight = opts.maxScrollHeight;
    if (opts.ignoreSslErrors !== undefined) overrides.ignoreSslErrors = opts.ignoreSslErrors;
    if (opts.userAgent !== undefined) overrides.userAgent = opts.userAgent;
    if (opts.globs) overrides.globs = opts.globs.split(',').map((s) => s.trim());
    if (opts.excludes) overrides.excludes = opts.excludes.split(',').map((s) => s.trim());
    if (opts.linkSelector !== undefined) overrides.linkSelector = opts.linkSelector;
    if (opts.keepUrlFragments !== undefined) overrides.keepUrlFragments = opts.keepUrlFragments;
    if (opts.respectRobotsTxt !== undefined) overrides.respectRobotsTxt = opts.respectRobotsTxt;
    if (opts.cookies) overrides.cookies = JSON.parse(opts.cookies);
    if (opts.headers) overrides.headers = JSON.parse(opts.headers);
    if (opts.maxConcurrency !== undefined) overrides.maxConcurrency = opts.maxConcurrency;
    if (opts.maxRetries !== undefined) overrides.maxRetries = opts.maxRetries;
    if (opts.maxResults !== undefined) overrides.maxResults = opts.maxResults;
    if (opts.save) overrides.save = validateSaveFormats(opts.save.split(','));
    if (opts.format && !opts.save) overrides.save = validateSaveFormats([opts.format]);
    if (opts.fast !== undefined) overrides.fast = opts.fast;
    if (opts.precision !== undefined) overrides.favorPrecision = opts.precision;
    if (opts.recall !== undefined) overrides.favorRecall = opts.recall;
    if (opts.includeTables !== undefined) overrides.includeTables = opts.includeTables;
    if (opts.tables !== undefined) overrides.includeTables = opts.tables;
    if (opts.includeImages !== undefined) overrides.includeImages = opts.includeImages;
    if (opts.includeFormatting !== undefined) overrides.includeFormatting = opts.includeFormatting;
    if (opts.formatting !== undefined) overrides.includeFormatting = opts.formatting;
    if (opts.deduplicate !== undefined) overrides.deduplicate = opts.deduplicate;
    if (opts.targetLanguage !== undefined) overrides.targetLanguage = opts.targetLanguage;
    if (opts.metadata !== undefined) overrides.withMetadata = opts.metadata;
    if (opts.withMetadata !== undefined) overrides.withMetadata = opts.withMetadata;
    if (opts.links === false) overrides.includeLinks = false;
    if (opts.comments === false) overrides.includeComments = false;

    mergeOverrides(cfg, overrides);

    const collectedUrls = [...urls];
    if (opts.startUrl) collectedUrls.push(opts.startUrl);
    if (collectedUrls.length > 0) cfg.urls = collectedUrls;
    if (cfg.urls.length === 0) {
      console.error('Error: No URLs specified. Provide URLs as arguments or via --config.');
      process.exit(1);
    }

    const formats = cfg.save.length > 0 ? cfg.save.join(', ') : 'markdown';
    console.log(`Extracting ${cfg.urls.length} URL(s) → ${cfg.outputDir}/ (${formats})`);
    const outcome = await runCrawl(cfg);
    console.log(`Done. Extracted ${outcome.pagesExtracted} pages.`);
  });

await program.parseAsync(process.argv);

function toInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`Expected integer, got '${value}'`);
  return parsed;
}

interface CliOptions {
  config?: string;
  startUrl?: string;
  format?: string;
  outputDir?: string;
  maxPages?: number;
  crawlDepth?: number;
  headless?: boolean;
  proxyUrls?: string;
  proxyRotation?: string;
  launcher?: string;
  waitUntil?: string;
  pageLoadTimeout?: number;
  ignoreCors?: boolean;
  closeCookieModals?: boolean;
  maxScrollHeight?: number;
  ignoreSslErrors?: boolean;
  userAgent?: string;
  globs?: string;
  excludes?: string;
  linkSelector?: string;
  keepUrlFragments?: boolean;
  respectRobotsTxt?: boolean;
  cookies?: string;
  headers?: string;
  maxConcurrency?: number;
  maxRetries?: number;
  maxResults?: number;
  save?: string;
  precision?: boolean;
  recall?: boolean;
  fast?: boolean;
  links?: boolean;
  comments?: boolean;
  includeTables?: boolean;
  tables?: boolean;
  includeImages?: boolean;
  includeFormatting?: boolean;
  formatting?: boolean;
  deduplicate?: boolean;
  targetLanguage?: string;
  metadata?: boolean;
  withMetadata?: boolean;
  verbose?: boolean;
}
