import { realpathSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRequests,
  createContextractorCrawler,
  type ExtractionResult,
  ProxyConfiguration,
} from '@contextractor/crawler';
import { ContextractorInput, type ContextractorInputType } from '@contextractor/schema';
import { Command, Option } from 'commander';
import { Dataset, KeyValueStore, SitemapRequestList } from 'crawlee';
import {
  buildCrawlConfig,
  type CliOnlyOverrides,
  loadConfigFile,
  type SaveFormat,
  validateSaveFormats,
} from './config.js';
import { createCliSink, createCrawleeStorageSink } from './sinks.js';
import { configureStorage, resolveStorageDir } from './storage/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`Expected integer, got '${value}'`);
  return parsed;
}

function collectValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseCrawlerType(value: string): ContextractorInputType['crawlerType'] {
  switch (value.trim().toLowerCase()) {
    case 'adaptive':
      return 'playwright:adaptive';
    case 'firefox':
      return 'playwright:firefox';
    case 'chromium':
      return 'playwright:chromium';
    case 'cheerio':
      return 'cheerio';
    default:
      throw new Error(
        `Unsupported --crawler-type value: '${value}'. Use adaptive, firefox, chromium, or cheerio.`,
      );
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

function parseJsonArray(raw: string, flagName: string): unknown[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`${flagName} must be a JSON array`);
  return parsed;
}

function parseStringRecord(raw: string, flagName: string): Record<string, string> {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${flagName} must be a JSON object`);
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string')
      throw new Error(`${flagName} must be a JSON object with string values`);
    out[key] = value;
  }
  return out;
}

function toCsv(items: Record<string, unknown>[]): string {
  const [first] = items;
  if (!first) return '';
  const keys = Object.keys(first);
  const csvCell = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = keys.map(csvCell).join(',');
  const rows = items.map((item) => keys.map((k) => csvCell(item[k])).join(','));
  return [header, ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// Shared option applier
// ---------------------------------------------------------------------------

function addExtractionOptions(cmd: Command): Command {
  const s = ContextractorInput.shape;
  return cmd
    .option('-c, --config <path>', 'Path to JSON config file')
    .option('-o, --output-dir <dir>', 'Output directory', './output')
    .addOption(
      new Option('--max-pages <n>', 'Max pages to crawl (0 = unlimited)')
        .argParser(toInt)
        .default(s.maxPagesPerCrawl._def.defaultValue, 'unlimited'),
    )
    .addOption(
      new Option('--crawl-depth <n>', 'Max link depth from start URLs (0 = start only)')
        .argParser(toInt)
        .default(s.maxCrawlingDepth._def.defaultValue, 'unlimited'),
    )
    .option('--headless', 'Run browser in headless mode', s.headless._def.defaultValue)
    .option('--no-headless', 'Run browser with UI')
    .option('--proxy <url>', 'Proxy URL (repeatable)', collectValues, [] as string[])
    .option(
      '--proxy-rotation <strategy>',
      'Proxy rotation: recommended, per_request, until_failure',
    )
    .option('--crawler-type <type>', 'Crawler engine: adaptive, firefox, chromium, cheerio')
    .option(
      '--rendering-detection-pct <n>',
      'Rendering type detection percentage (adaptive only)',
      toInt,
    )
    .option('--wait-until <event>', 'Page load event: networkidle, load, domcontentloaded')
    .addOption(
      new Option('--page-load-timeout <secs>', 'Page load timeout in seconds')
        .argParser(toInt)
        .default(s.pageLoadTimeoutSecs._def.defaultValue),
    )
    .option('--block-media', 'Block images, stylesheets, fonts, PDFs, and ZIPs')
    .option('--no-block-media', 'Do not block media requests (default)')
    .option('--ignore-cors', 'Disable CORS/CSP restrictions')
    .option(
      '--close-cookie-modals',
      'Auto-dismiss cookie banners',
      s.closeCookieModals._def.defaultValue,
    )
    .option('--max-scroll-height <px>', 'Max scroll height in pixels', toInt)
    .option('--ignore-ssl-errors', 'Skip SSL certificate verification')
    .option('--user-agent <ua>', 'Custom User-Agent string')
    .option(
      '--glob <pattern>',
      'Glob pattern to include (repeatable)',
      collectValues,
      [] as string[],
    )
    .option(
      '--exclude <pattern>',
      'Glob pattern to exclude (repeatable)',
      collectValues,
      [] as string[],
    )
    .option('--link-selector <css>', 'CSS selector for links to follow')
    .option('--keep-url-fragments', 'Preserve URL fragments')
    .option(
      '--use-sitemaps',
      'Discover and enqueue URLs from sitemap.xml at each start URL domain root',
    )
    .option('--respect-robots-txt', 'Honor robots.txt')
    .option('--cookies <json>', 'JSON array of cookie objects')
    .option('--headers <json>', 'JSON object of custom HTTP headers')
    .option('--initial-concurrency <n>', 'Initial parallel requests (0 = Crawlee default)', toInt)
    .addOption(
      new Option('--max-concurrency <n>', 'Max parallel requests')
        .argParser(toInt)
        .default(s.maxConcurrency._def.defaultValue),
    )
    .addOption(
      new Option('--max-retries <n>', 'Max request retries')
        .argParser(toInt)
        .default(s.maxRequestRetries._def.defaultValue),
    )
    .addOption(
      new Option('--max-results <n>', 'Max results per crawl (0 = unlimited)')
        .argParser(toInt)
        .default(s.maxResultsPerCrawl._def.defaultValue, 'unlimited'),
    )
    .option(
      '--save <format>',
      'Output format: markdown, txt, json, html, original, all (repeatable)',
      collectValues,
      s.save._def.defaultValue,
    )
    .addOption(
      new Option(
        '--mode <mode>',
        'Extraction mode: precision (less noise), balanced (default), or recall (more content)',
      )
        .choices(['precision', 'balanced', 'recall'])
        .default('balanced'),
    )
    .option('--no-links', 'Exclude links from output')
    .option('--no-comments', 'Exclude comments from output')
    .option('--no-tables', 'Exclude tables from output')
    .option('--images', 'Include image alt text and captions')
    .option('--no-images', 'Exclude image alt text and captions (default)')
    .option('--target-language <lang>', 'Filter by language (e.g. en)')
    .option('--no-metadata', 'Skip metadata extraction')
    .option('-v, --verbose', 'Enable verbose logging')
    .option(
      '--save-destination <dest>',
      'Where to save: key-value-store|dataset (repeatable)',
      collectValues,
      s.saveDestination._def.defaultValue,
    )
    .option('--storage-dir <path>', 'Override Crawlee storage directory')
    .option('--store-skipped-urls', 'Push skipped URL records to the dataset after crawl')
    .option(
      '--dynamic-content-wait <seconds>',
      'Seconds to wait for network idle after navigation (0 = disabled)',
      toInt,
    )
    .option(
      '--wait-for-selector <selector>',
      'CSS selector to wait for before extracting (fails on timeout)',
    )
    .option(
      '--soft-wait-for-selector <selector>',
      'CSS selector to wait for before extracting (continues on timeout)',
    )
    .option(
      '--ignore-canonical-url',
      'Disable canonical URL deduplication — extract every loaded URL even if its canonical was already extracted',
    );
}

// ---------------------------------------------------------------------------
// Schema mapping helpers
// ---------------------------------------------------------------------------

function buildSchemaOverrides(opts: ExtractOpts): Partial<ContextractorInputType> {
  const out: Partial<ContextractorInputType> = {};

  if (opts.maxPages !== undefined) out.maxPagesPerCrawl = opts.maxPages;
  if (opts.crawlDepth !== undefined) out.maxCrawlingDepth = opts.crawlDepth;
  if (opts.headless !== undefined) out.headless = opts.headless;
  if (opts.crawlerType) out.crawlerType = parseCrawlerType(opts.crawlerType);
  if (opts.renderingDetectionPct !== undefined)
    out.renderingTypeDetectionPercentage = opts.renderingDetectionPct;
  if (opts.waitUntil) out.waitUntil = parseWaitUntil(opts.waitUntil);
  if (opts.proxyRotation) out.proxyRotation = parseProxyRotation(opts.proxyRotation);
  if (opts.pageLoadTimeout !== undefined) out.pageLoadTimeoutSecs = opts.pageLoadTimeout;
  if (opts.blockMedia !== undefined) out.blockMedia = opts.blockMedia;
  if (opts.ignoreCors !== undefined) out.ignoreCorsAndCsp = opts.ignoreCors;
  if (opts.closeCookieModals !== undefined) out.closeCookieModals = opts.closeCookieModals;
  if (opts.maxScrollHeight !== undefined) out.maxScrollHeightPixels = opts.maxScrollHeight;
  if (opts.ignoreSslErrors !== undefined) out.ignoreSslErrors = opts.ignoreSslErrors;
  if (opts.userAgent !== undefined) out.userAgent = opts.userAgent;
  if (opts.glob?.length) out.globs = opts.glob.map((s) => ({ glob: s }));
  if (opts.exclude?.length) out.excludes = opts.exclude.map((s) => ({ glob: s }));
  if (opts.linkSelector !== undefined) out.linkSelector = opts.linkSelector;
  if (opts.keepUrlFragments !== undefined) out.keepUrlFragments = opts.keepUrlFragments;
  if (opts.useSitemaps !== undefined) out.useSitemaps = opts.useSitemaps;
  if (opts.respectRobotsTxt !== undefined) out.respectRobotsTxtFile = opts.respectRobotsTxt;
  if (opts.cookies) out.initialCookies = parseJsonArray(opts.cookies, '--cookies');
  if (opts.headers) out.customHttpHeaders = parseStringRecord(opts.headers, '--headers');
  if (opts.initialConcurrency !== undefined) out.initialConcurrency = opts.initialConcurrency;
  if (opts.maxConcurrency !== undefined) out.maxConcurrency = opts.maxConcurrency;
  if (opts.maxRetries !== undefined) out.maxRequestRetries = opts.maxRetries;
  if (opts.maxResults !== undefined) out.maxResultsPerCrawl = opts.maxResults;
  if (opts.dynamicContentWait !== undefined) out.dynamicContentWaitSecs = opts.dynamicContentWait;
  if (opts.waitForSelector !== undefined) out.waitForSelector = opts.waitForSelector;
  if (opts.softWaitForSelector !== undefined) out.softWaitForSelector = opts.softWaitForSelector;
  if (opts.ignoreCanonicalUrl !== undefined) out.ignoreCanonicalUrl = opts.ignoreCanonicalUrl;

  if (opts.mode !== undefined) out.mode = opts.mode as ContextractorInputType['mode'];
  if (opts.tables !== undefined) out.includeTables = opts.tables;
  if (opts.images !== undefined) out.includeImages = opts.images;
  if (opts.links === false) out.includeLinks = false;
  if (opts.comments === false) out.includeComments = false;
  if (opts.targetLanguage !== undefined) out.targetLanguage = opts.targetLanguage;

  return out;
}

function resolveCliOnly(opts: ExtractOpts, input: ContextractorInputType): CliOnlyOverrides {
  const urls = input.startUrls
    .map((u) => u.url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  let save: SaveFormat[] = ['markdown'];
  if (opts.save?.length) save = validateSaveFormats(opts.save);

  const proxyUrls = opts.proxy ?? [];

  return {
    urls,
    outputDir: opts.outputDir ?? './output',
    save,
    proxyUrls,
    proxyRotation: input.proxyRotation,
  };
}

// ---------------------------------------------------------------------------
// Shared extraction action
// ---------------------------------------------------------------------------

async function runExtractAction(
  urls: string[],
  opts: ExtractOpts,
  inputFile?: string,
  datasetName?: string,
): Promise<void> {
  if (opts.verbose) process.env.LOG_LEVEL = 'DEBUG';

  const storageDir = resolveStorageDir(opts.storageDir);
  configureStorage(storageDir);

  const fromFile: Partial<ContextractorInputType> = opts.config
    ? await loadConfigFile(opts.config)
    : {};
  const fromCli = buildSchemaOverrides(opts);

  const collectedUrls = [...urls];

  if (inputFile) {
    const text = await readFile(inputFile, 'utf8');
    const fileUrls = text
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('#'));
    collectedUrls.push(...fileUrls);
  }

  if (collectedUrls.length > 0) fromCli.startUrls = collectedUrls.map((url) => ({ url }));

  const layered: Record<string, unknown> = { ...fromFile, ...fromCli };

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

  const destinations = opts.saveDestination ?? ['key-value-store'];

  const kvs = await KeyValueStore.open('default');
  const ds = await Dataset.open(datasetName ?? 'default');

  const formats = cfg.save.length > 0 ? cfg.save.join(', ') : 'markdown';
  process.stderr.write(`Extracting ${cfg.urls.length} URL(s) → ${cfg.outputDir}/ [${formats}]\n`);

  const fileSinkInstance = createCliSink({ outDir: cfg.outputDir, formats: cfg.save });
  const storageSinkInstance = createCrawleeStorageSink({
    destinations,
    kvs,
    dataset: ds,
    formats: cfg.save,
  });

  const sink = async (result: ExtractionResult): Promise<void> => {
    await fileSinkInstance(result);
    await storageSinkInstance(result);
  };

  let proxyConfiguration: ProxyConfiguration | undefined;
  if (cliOnly.proxyUrls.length > 0) {
    for (const raw of cliOnly.proxyUrls) {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(raw);
      } catch {
        console.error(
          `--proxy: malformed URL "${raw}". ` +
            `Expected http://user:pass@host:port (also accepts https://, socks4://, socks5://).`,
        );
        process.exit(1);
      }
      if (!['http:', 'https:', 'socks4:', 'socks5:'].includes(parsedUrl.protocol)) {
        console.error(
          `--proxy: unsupported scheme "${parsedUrl.protocol}" in "${raw}". ` +
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
        `without --proxy; running without proxy.`,
    );
  }

  let sitemapList: SitemapRequestList | undefined;
  if (parsed.data.useSitemaps) {
    const sitemapUrls = [...new Set(cfg.urls.map((u) => `${new URL(u).origin}/sitemap.xml`))];
    sitemapList = await SitemapRequestList.open({
      sitemapUrls,
      globs: cfg.globs,
      exclude: cfg.excludes,
    });
  }

  const failedRecords: Array<{
    url: string;
    loadedUrl: string | null;
    status: 'failed';
    errorMessages: string[];
    retryCount: number;
  }> = [];

  const crawler = createContextractorCrawler({
    startUrls: cfg.urls,
    sink,
    formats: cfg.save.filter(
      (format): format is Exclude<SaveFormat, 'original'> => format !== 'original',
    ),
    mode: cfg.mode,
    includeComments: cfg.includeComments,
    includeTables: cfg.includeTables,
    includeImages: cfg.includeImages,
    includeLinks: cfg.includeLinks,
    targetLanguage: cfg.targetLanguage,
    cookieStrategy: cfg.closeCookieModals ? 'ghostery' : 'none',
    scroll: cfg.maxScrollHeight > 0 ? { maxScrollHeight: cfg.maxScrollHeight } : undefined,
    headless: cfg.headless,
    crawlerType: cfg.crawlerType,
    renderingTypeDetectionPercentage: cfg.renderingTypeDetectionPercentage,
    ignoreSslErrors: cfg.ignoreSslErrors,
    bypassCSP: cfg.ignoreCors,
    initialCookies: cfg.cookies,
    extraHTTPHeaders: cfg.headers,
    userAgent: cfg.userAgent || undefined,
    maxPages: cfg.maxPages,
    maxRetries: cfg.maxRetries,
    initialConcurrency: cfg.initialConcurrency,
    maxConcurrency: cfg.maxConcurrency,
    blockMedia: cfg.blockMedia,
    pageLoadTimeoutSecs: cfg.pageLoadTimeout,
    waitUntil: cfg.waitUntil,
    maxResults: cfg.maxResults > 0 ? cfg.maxResults : undefined,
    linkSelector: cfg.linkSelector || undefined,
    maxCrawlingDepth: cfg.crawlDepth,
    globs: cfg.globs,
    excludes: cfg.excludes,
    keepUrlFragments: cfg.keepUrlFragments,
    respectRobotsTxt: cfg.respectRobotsTxt,
    dynamicContentWaitSecs: cfg.dynamicContentWaitSecs > 0 ? cfg.dynamicContentWaitSecs : undefined,
    waitForSelector: cfg.waitForSelector || undefined,
    softWaitForSelector: cfg.softWaitForSelector || undefined,
    ignoreCanonicalUrl: cfg.ignoreCanonicalUrl,
    ...(sitemapList !== undefined ? { requestList: sitemapList } : {}),
    proxyConfiguration,
    proxyRotation: cliOnly.proxyRotation,
    onFailedRequest: async (info) => {
      failedRecords.push({
        url: info.url,
        loadedUrl: info.loadedUrl,
        status: 'failed',
        errorMessages: info.errorMessages,
        retryCount: info.retryCount,
      });
      await ds.pushData({
        url: info.url,
        loadedUrl: info.loadedUrl,
        status: 'failed',
        errorMessages: info.errorMessages,
        retryCount: info.retryCount,
        crawledAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      });
    },
    ...(opts.storeSkippedUrls
      ? {
          onSkippedUrl: (url, reason) => {
            void ds.pushData({ url, status: 'skipped', skipReason: reason });
          },
        }
      : {}),
  });

  await crawler.run(buildRequests(cfg.urls, cfg.keepUrlFragments));

  process.stderr.write('Done.\n');
  if (failedRecords.length > 0) process.exit(2);
}

// ---------------------------------------------------------------------------
// Program builder
// ---------------------------------------------------------------------------

export function buildProgram(): Command {
  const program = new Command();

  program
    .name('contextractor')
    .description('Extract web content from URLs using configurable extraction options.')
    .version('0.1.0');

  // ---------------------------------------------------------------------------
  // extract subcommand — explicit named form
  // ---------------------------------------------------------------------------
  const extract = new Command('extract');
  extract.description('Extract content from URLs and save to storage');
  extract.argument('[urls...]', 'URLs to extract content from');
  extract.option('--input-file <file>', 'Read URLs (one per line) from a file');
  extract.option('--dataset <name>', 'Route output to a named dataset (default: default)');
  addExtractionOptions(extract);
  extract.action(
    async (urls: string[], opts: ExtractOpts & { inputFile?: string; dataset?: string }) => {
      await runExtractAction(urls, opts, opts.inputFile, opts.dataset);
    },
  );
  program.addCommand(extract);

  // ---------------------------------------------------------------------------
  // list subcommand
  // ---------------------------------------------------------------------------
  const list = new Command('list');
  list
    .description('List items in a dataset')
    .argument('[dataset]', 'Dataset name (default: default)')
    .option('--limit <n>', 'Max items to return', toInt)
    .option('--offset <n>', 'Number of items to skip', toInt)
    .option('--format <fmt>', 'Output format: json|jsonl|csv (default: jsonl)')
    .option('--desc', 'Return items in descending order')
    .option('--storage-dir <path>', 'Override Crawlee storage directory')
    .action(async (datasetArg: string | undefined, opts: ListOpts) => {
      const storageDir = resolveStorageDir(opts.storageDir);
      configureStorage(storageDir);
      const ds = await Dataset.open(datasetArg ?? 'default');
      const data = await ds.getData({
        offset: opts.offset ?? 0,
        limit: opts.limit ?? 1000,
        desc: opts.desc ?? false,
      });
      const fmt = opts.format ?? 'jsonl';
      if (fmt === 'json') {
        process.stdout.write(`${JSON.stringify(data.items, null, 2)}\n`);
      } else if (fmt === 'csv') {
        process.stdout.write(`${toCsv(data.items)}\n`);
      } else {
        for (const item of data.items) {
          process.stdout.write(`${JSON.stringify(item)}\n`);
        }
      }
    });
  program.addCommand(list);

  // ---------------------------------------------------------------------------
  // get subcommand
  // ---------------------------------------------------------------------------
  const get = new Command('get');
  get
    .description('Get a single item from a dataset by 0-based index')
    .argument('<dataset>', 'Dataset name')
    .argument('<index>', 'Item index (0-based)', toInt)
    .option('--storage-dir <path>', 'Override Crawlee storage directory')
    .action(async (datasetName: string, index: number, opts: { storageDir?: string }) => {
      const storageDir = resolveStorageDir(opts.storageDir);
      configureStorage(storageDir);
      const ds = await Dataset.open(datasetName);
      const data = await ds.getData({ offset: index, limit: 1 });
      if (data.items.length === 0) {
        process.stderr.write(`No item at index ${index} in dataset "${datasetName}"\n`);
        process.exit(1);
      }
      process.stdout.write(`${JSON.stringify(data.items[0], null, 2)}\n`);
    });
  program.addCommand(get);

  // ---------------------------------------------------------------------------
  // kvs subcommand group
  // ---------------------------------------------------------------------------
  const kvs = new Command('kvs').description('Key-value store operations');

  const kvsPut = new Command('put');
  kvsPut
    .description('Write a file or stdin to the key-value store')
    .argument('<key>', 'Key name')
    .argument('<file>', 'File path or - to read from stdin')
    .option('--store <name>', 'KVS store name (default: default)')
    .option('--content-type <mime>', 'MIME content-type override')
    .option('--storage-dir <path>', 'Override Crawlee storage directory')
    .action(async (key: string, fileOrStdin: string, opts: KvsPutOpts) => {
      const storageDir = resolveStorageDir(opts.storageDir);
      configureStorage(storageDir);
      const store = await KeyValueStore.open(opts.store ?? 'default');

      let content: Buffer;
      if (fileOrStdin === '-') {
        const chunks: Buffer[] = [];
        process.stdin.resume();
        for await (const chunk of process.stdin) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        }
        content = Buffer.concat(chunks);
      } else {
        content = await readFile(fileOrStdin);
      }

      let contentType = opts.contentType;
      if (!contentType) {
        const ext = path.extname(fileOrStdin === '-' ? '' : fileOrStdin).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.json': 'application/json',
          '.txt': 'text/plain',
          '.html': 'text/html',
          '.htm': 'text/html',
          '.md': 'text/markdown',
        };
        contentType = mimeMap[ext] ?? 'application/octet-stream';
      }

      await store.setValue(key, content, { contentType });
      process.stderr.write(`Stored key "${key}" in store "${opts.store ?? 'default'}"\n`);
    });
  kvs.addCommand(kvsPut);

  const kvsGet = new Command('get');
  kvsGet
    .description('Read a value from the key-value store and write to stdout')
    .argument('<key>', 'Key name')
    .option('--store <name>', 'KVS store name (default: default)')
    .option('--storage-dir <path>', 'Override Crawlee storage directory')
    .action(async (key: string, opts: { store?: string; storageDir?: string }) => {
      const storageDir = resolveStorageDir(opts.storageDir);
      configureStorage(storageDir);
      const store = await KeyValueStore.open(opts.store ?? 'default');
      const value = await store.getValue(key);
      if (value === null || value === undefined) {
        process.stderr.write(`Key "${key}" not found in store "${opts.store ?? 'default'}"\n`);
        process.exit(1);
      }
      if (Buffer.isBuffer(value)) {
        process.stdout.write(value);
      } else if (typeof value === 'string') {
        process.stdout.write(value);
      } else {
        process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
      }
    });
  kvs.addCommand(kvsGet);

  const kvsLs = new Command('ls');
  kvsLs
    .description('List keys in a key-value store')
    .option('--store <name>', 'KVS store name (default: default)')
    .option('--limit <n>', 'Max keys to list', toInt)
    .option('--exclusive-start-key <key>', 'Start listing after this key')
    .option('--storage-dir <path>', 'Override Crawlee storage directory')
    .action(
      async (opts: {
        store?: string;
        limit?: number;
        exclusiveStartKey?: string;
        storageDir?: string;
      }) => {
        const storageDir = resolveStorageDir(opts.storageDir);
        configureStorage(storageDir);
        const store = await KeyValueStore.open(opts.store ?? 'default');
        let count = 0;
        const limit = opts.limit ?? Number.POSITIVE_INFINITY;
        await store.forEachKey((key) => {
          if (count >= limit) return;
          if (opts.exclusiveStartKey && key <= opts.exclusiveStartKey) return;
          process.stdout.write(`${key}\n`);
          count++;
        });
      },
    );
  kvs.addCommand(kvsLs);

  const kvsRm = new Command('rm');
  kvsRm
    .description('Delete a key from the key-value store')
    .argument('<key>', 'Key name')
    .option('--store <name>', 'KVS store name (default: default)')
    .option('--storage-dir <path>', 'Override Crawlee storage directory')
    .action(async (key: string, opts: { store?: string; storageDir?: string }) => {
      const storageDir = resolveStorageDir(opts.storageDir);
      configureStorage(storageDir);
      const store = await KeyValueStore.open(opts.store ?? 'default');
      await store.setValue(key, null);
      process.stderr.write(`Deleted key "${key}" from store "${opts.store ?? 'default'}"\n`);
    });
  kvs.addCommand(kvsRm);

  program.addCommand(kvs);

  // ---------------------------------------------------------------------------
  // purge subcommand
  // ---------------------------------------------------------------------------
  const purge = new Command('purge');
  purge
    .description('Purge default storage (or all storage with --all)')
    .option('--all', 'Purge all datasets and key-value stores, not just the default')
    .option('--storage-dir <path>', 'Override Crawlee storage directory')
    .action(async (opts: { all?: boolean; storageDir?: string }) => {
      const storageDir = resolveStorageDir(opts.storageDir);
      configureStorage(storageDir);
      if (opts.all) {
        await rm(path.join(storageDir, 'datasets'), { recursive: true, force: true });
        await rm(path.join(storageDir, 'key_value_stores'), { recursive: true, force: true });
        process.stderr.write('Purged all datasets and key-value stores.\n');
      } else {
        const ds = await Dataset.open('default');
        await ds.drop();
        const store = await KeyValueStore.open('default');
        await store.drop();
        process.stderr.write('Purged default dataset and key-value store.\n');
      }
    });
  program.addCommand(purge);

  // ---------------------------------------------------------------------------
  // storage-dir subcommand
  // ---------------------------------------------------------------------------
  const storageDir = new Command('storage-dir');
  storageDir
    .description('Print the resolved Crawlee storage directory and exit')
    .option('--storage-dir <path>', 'Override Crawlee storage directory')
    .action((opts: { storageDir?: string }) => {
      process.stdout.write(`${resolveStorageDir(opts.storageDir)}\n`);
    });
  program.addCommand(storageDir);

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

// ---------------------------------------------------------------------------
// Type interfaces
// ---------------------------------------------------------------------------

interface ExtractOpts {
  config?: string;
  outputDir?: string;
  maxPages?: number;
  crawlDepth?: number;
  headless?: boolean;
  proxy?: string[];
  proxyRotation?: string;
  crawlerType?: string;
  renderingDetectionPct?: number;
  waitUntil?: string;
  pageLoadTimeout?: number;
  blockMedia?: boolean;
  ignoreCors?: boolean;
  closeCookieModals?: boolean;
  maxScrollHeight?: number;
  ignoreSslErrors?: boolean;
  userAgent?: string;
  glob?: string[];
  exclude?: string[];
  linkSelector?: string;
  keepUrlFragments?: boolean;
  useSitemaps?: boolean;
  respectRobotsTxt?: boolean;
  cookies?: string;
  headers?: string;
  initialConcurrency?: number;
  maxConcurrency?: number;
  maxRetries?: number;
  maxResults?: number;
  save?: string[];
  mode?: string;
  links?: boolean;
  comments?: boolean;
  tables?: boolean;
  images?: boolean;
  targetLanguage?: string;
  metadata?: boolean;
  verbose?: boolean;
  saveDestination?: string[];
  storageDir?: string;
  storeSkippedUrls?: boolean;
  dynamicContentWait?: number;
  waitForSelector?: string;
  softWaitForSelector?: string;
  ignoreCanonicalUrl?: boolean;
}

interface ListOpts {
  limit?: number;
  offset?: number;
  format?: string;
  desc?: boolean;
  storageDir?: string;
}

interface KvsPutOpts {
  store?: string;
  contentType?: string;
  storageDir?: string;
}
