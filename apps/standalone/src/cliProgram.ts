import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRequests, createContextractorCrawler } from '@contextractor/crawler';
import { ContextractorInput, type ContextractorInputType } from '@contextractor/schema';
import { Command } from 'commander';
import { ProxyConfiguration } from 'crawlee';
import {
  buildCrawlConfig,
  type CliOnlyOverrides,
  loadConfigFile,
  type SaveFormat,
  validateSaveFormats,
} from './config.js';
import { createCliSink } from './sinks.js';

export function buildProgram(): Command {
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
    .option(
      '--proxy-rotation <strategy>',
      'Proxy rotation: recommended, per_request, until_failure',
    )
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

      const fromFile = opts.config ? await loadConfigFile(opts.config) : {};
      const fromCli = buildSchemaOverrides(opts);

      const collectedUrls = [...urls];
      if (opts.startUrl) collectedUrls.push(opts.startUrl);
      if (collectedUrls.length > 0) fromCli.startUrls = collectedUrls.map((url) => ({ url }));

      const layered: Record<string, unknown> = { ...fromFile, ...fromCli };
      const fileTrafilatura = fromFile.trafilaturaConfig ?? {};
      const cliTrafilatura = fromCli.trafilaturaConfig ?? {};
      if (Object.keys(fileTrafilatura).length || Object.keys(cliTrafilatura).length) {
        layered.trafilaturaConfig = { ...fileTrafilatura, ...cliTrafilatura };
      }

      const startUrlsLayered = Array.isArray(layered.startUrls) ? layered.startUrls : undefined;
      if (!startUrlsLayered || startUrlsLayered.length === 0) {
        console.error('Error: No URLs specified. Provide URLs as arguments or via --config.');
        process.exit(1);
      }

      const parsed = ContextractorInput.safeParse(layered);
      if (!parsed.success) {
        console.error('Invalid configuration:');
        for (const issue of parsed.error.issues) {
          console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
        }
        process.exit(1);
      }

      const cliOnly = resolveCliOnly(opts, parsed.data);
      const cfg = buildCrawlConfig(parsed.data, cliOnly);

      const formats = cfg.save.length > 0 ? cfg.save.join(', ') : 'markdown';
      console.log(`Extracting ${cfg.urls.length} URL(s) → ${cfg.outputDir}/ (${formats})`);

      const sink = createCliSink({
        outDir: cfg.outputDir,
        formats: cfg.save,
      });

      let proxyConfiguration: ProxyConfiguration | undefined;
      if (cliOnly.proxyUrls.length > 0) {
        for (const raw of cliOnly.proxyUrls) {
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(raw);
          } catch {
            console.error(
              `--proxy-urls: malformed URL "${raw}". ` +
                `Expected http://user:pass@host:port (also accepts https://, socks4://, socks5://).`,
            );
            process.exit(1);
          }
          if (!['http:', 'https:', 'socks4:', 'socks5:'].includes(parsedUrl.protocol)) {
            console.error(
              `--proxy-urls: unsupported scheme "${parsedUrl.protocol}" in "${raw}". ` +
                `Use http://, https://, socks4:// or socks5://. ` +
                `Apify Proxy configuration is only supported in the Apify Actor build.`,
            );
            process.exit(1);
          }
        }
        proxyConfiguration = new ProxyConfiguration({ proxyUrls: cliOnly.proxyUrls });
      } else if (cliOnly.proxyRotation && cliOnly.proxyRotation !== 'RECOMMENDED') {
        console.warn(
          `Warning: --proxy-rotation=${cliOnly.proxyRotation} has no effect ` +
            `without --proxy-urls; running without proxy.`,
        );
      }

      const crawler = createContextractorCrawler({
        startUrls: cfg.urls,
        sink,
        formats: cfg.save.filter(
          (format): format is Exclude<SaveFormat, 'jsonl'> => format !== 'jsonl',
        ),
        extractionConfig: cfg.trafilaturaConfig,
        cookieStrategy: cfg.closeCookieModals ? 'ghostery' : 'none',
        scroll: cfg.maxScrollHeight > 0 ? { maxScrollHeight: cfg.maxScrollHeight } : undefined,
        headless: cfg.headless,
        launcher: cfg.launcher,
        ignoreSslErrors: cfg.ignoreSslErrors,
        bypassCSP: cfg.ignoreCors,
        initialCookies: cfg.cookies,
        extraHTTPHeaders: cfg.headers,
        userAgent: cfg.userAgent || undefined,
        maxPages: cfg.maxPages,
        maxRetries: cfg.maxRetries,
        maxConcurrency: cfg.maxConcurrency,
        pageLoadTimeoutSecs: cfg.pageLoadTimeout,
        waitUntil: cfg.waitUntil,
        maxResults: cfg.maxResults > 0 ? cfg.maxResults : undefined,
        linkSelector: cfg.linkSelector || undefined,
        maxCrawlingDepth: cfg.crawlDepth,
        globs: cfg.globs,
        excludes: cfg.excludes,
        keepUrlFragments: cfg.keepUrlFragments,
        respectRobotsTxt: cfg.respectRobotsTxt,
        proxyConfiguration,
        proxyRotation: cliOnly.proxyRotation,
      });

      await crawler.run(buildRequests(cfg.urls, cfg.keepUrlFragments));
      console.log('Done.');
    });

  return program;
}

export async function runCli(program: Command, argv: string[]): Promise<void> {
  try {
    await program.parseAsync(argv);
    process.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function isMainEntry(metaUrl: string, argv1 = process.argv[1]): boolean {
  if (!argv1) return false;
  try {
    return fileURLToPath(metaUrl) === realpathSync(resolve(argv1));
  } catch {
    return false;
  }
}

function toInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`Expected integer, got '${value}'`);
  return parsed;
}

function parseLauncher(value: string): ContextractorInputType['launcher'] {
  switch (value.trim().toLowerCase()) {
    case 'chromium':
      return 'CHROMIUM';
    case 'firefox':
      return 'FIREFOX';
    default:
      throw new Error(`Unsupported --launcher value: '${value}'. Use chromium or firefox.`);
  }
}

function parseWaitUntil(value: string): ContextractorInputType['waitUntil'] {
  switch (value.trim().toLowerCase()) {
    case 'networkidle':
      return 'NETWORKIDLE';
    case 'load':
      return 'LOAD';
    case 'domcontentloaded':
      return 'DOMCONTENTLOADED';
    default:
      throw new Error(
        `Unsupported --wait-until value: '${value}'. Use networkidle, load, or domcontentloaded.`,
      );
  }
}

function parseProxyRotation(value: string): ContextractorInputType['proxyRotation'] {
  switch (value.trim().toLowerCase().replace(/-/g, '_')) {
    case 'recommended':
      return 'RECOMMENDED';
    case 'per_request':
      return 'PER_REQUEST';
    case 'until_failure':
      return 'UNTIL_FAILURE';
    default:
      throw new Error(
        `Unsupported --proxy-rotation value: '${value}'. Use recommended, per_request, or until_failure.`,
      );
  }
}

function buildSchemaOverrides(opts: CliOptions): Partial<ContextractorInputType> {
  const out: Partial<ContextractorInputType> = {};

  if (opts.maxPages !== undefined) out.maxPagesPerCrawl = opts.maxPages;
  if (opts.crawlDepth !== undefined) out.maxCrawlingDepth = opts.crawlDepth;
  if (opts.headless !== undefined) out.headless = opts.headless;
  if (opts.launcher) out.launcher = parseLauncher(opts.launcher);
  if (opts.waitUntil) out.waitUntil = parseWaitUntil(opts.waitUntil);
  if (opts.proxyRotation) out.proxyRotation = parseProxyRotation(opts.proxyRotation);
  if (opts.pageLoadTimeout !== undefined) out.pageLoadTimeoutSecs = opts.pageLoadTimeout;
  if (opts.ignoreCors !== undefined) out.ignoreCorsAndCsp = opts.ignoreCors;
  if (opts.closeCookieModals !== undefined) out.closeCookieModals = opts.closeCookieModals;
  if (opts.maxScrollHeight !== undefined) out.maxScrollHeightPixels = opts.maxScrollHeight;
  if (opts.ignoreSslErrors !== undefined) out.ignoreSslErrors = opts.ignoreSslErrors;
  if (opts.userAgent !== undefined) out.userAgent = opts.userAgent;
  if (opts.globs) out.globs = opts.globs.split(',').map((s) => ({ glob: s.trim() }));
  if (opts.excludes) out.excludes = opts.excludes.split(',').map((s) => ({ glob: s.trim() }));
  if (opts.linkSelector !== undefined) out.linkSelector = opts.linkSelector;
  if (opts.keepUrlFragments !== undefined) out.keepUrlFragments = opts.keepUrlFragments;
  if (opts.respectRobotsTxt !== undefined) out.respectRobotsTxtFile = opts.respectRobotsTxt;
  if (opts.cookies) out.initialCookies = parseJsonArray(opts.cookies, '--cookies');
  if (opts.headers) out.customHttpHeaders = parseStringRecord(opts.headers, '--headers');
  if (opts.maxConcurrency !== undefined) out.maxConcurrency = opts.maxConcurrency;
  if (opts.maxRetries !== undefined) out.maxRequestRetries = opts.maxRetries;
  if (opts.maxResults !== undefined) out.maxResultsPerCrawl = opts.maxResults;

  const tcfg: Record<string, unknown> = {};
  if (opts.fast !== undefined) tcfg.fast = opts.fast;
  if (opts.precision !== undefined) tcfg.favorPrecision = opts.precision;
  if (opts.recall !== undefined) tcfg.favorRecall = opts.recall;
  if (opts.includeTables !== undefined) tcfg.includeTables = opts.includeTables;
  if (opts.tables !== undefined) tcfg.includeTables = opts.tables;
  if (opts.includeImages !== undefined) tcfg.includeImages = opts.includeImages;
  if (opts.includeFormatting !== undefined) tcfg.includeFormatting = opts.includeFormatting;
  if (opts.formatting !== undefined) tcfg.includeFormatting = opts.formatting;
  if (opts.deduplicate !== undefined) tcfg.deduplicate = opts.deduplicate;
  if (opts.targetLanguage !== undefined) tcfg.targetLanguage = opts.targetLanguage;
  if (opts.metadata !== undefined) tcfg.withMetadata = opts.metadata;
  if (opts.withMetadata !== undefined) tcfg.withMetadata = opts.withMetadata;
  if (opts.links === false) tcfg.includeLinks = false;
  if (opts.comments === false) tcfg.includeComments = false;
  if (Object.keys(tcfg).length > 0) out.trafilaturaConfig = tcfg;

  return out;
}

function resolveCliOnly(opts: CliOptions, input: ContextractorInputType): CliOnlyOverrides {
  const urls = input.startUrls
    .map((u) => u.url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  let save: SaveFormat[] = ['markdown'];
  if (opts.save) {
    save = validateSaveFormats(opts.save.split(','));
  } else if (opts.format) {
    save = validateSaveFormats([opts.format]);
  }

  const proxyUrls = opts.proxyUrls
    ? opts.proxyUrls
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  return {
    urls,
    outputDir: opts.outputDir ?? './output',
    save,
    proxyUrls,
    proxyRotation: input.proxyRotation,
  };
}

function parseJsonArray(raw: string, flagName: string): unknown[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${flagName} must be a JSON array`);
  }
  return parsed;
}

function parseStringRecord(raw: string, flagName: string): Record<string, string> {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${flagName} must be a JSON object`);
  }

  const entries = Object.entries(parsed);
  if (entries.some(([, value]) => typeof value !== 'string')) {
    throw new Error(`${flagName} must be a JSON object with string values`);
  }

  const out: Record<string, string> = {};
  for (const [key, value] of entries) {
    out[key] = value;
  }
  return out;
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
