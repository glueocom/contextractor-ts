import { realpathSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFailedRecord,
  buildRequests,
  buildSkippedRecord,
  createContextractorCrawler,
  ProxyConfiguration,
} from '@contextractor/crawler';
import { ContextractorInput, type ContextractorInputType } from '@contextractor/schema';
import { Command, Option } from 'commander';
import { Dataset, KeyValueStore, RequestQueue, SitemapRequestList } from 'crawlee';
import {
  buildCrawlConfig,
  type CliOnlyOverrides,
  loadConfigFile,
  type SaveFormat,
  validateSaveFormats,
} from './config.js';
import { runExportAction } from './exportAction.js';
import { createCrawleeStorageSink } from './sinks.js';
import { configureStorage, resolveStorageDir } from './storage/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`Expected integer, got '${value}'`);
  return parsed;
}

function toFloat(value: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) throw new Error(`Expected number, got '${value}'`);
  return parsed;
}

function collectValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseCrawlerType(value: string): ContextractorInputType['crawlerType'] {
  switch (value.trim().toLowerCase()) {
    case 'adaptive':
      return 'playwright-adaptive';
    case 'firefox':
      return 'playwright-firefox';
    case 'chromium':
      return 'playwright-chromium';
    case 'cheerio':
      return 'cheerio';
    default:
      throw new Error(
        `Unsupported --crawler-type value: '${value}'. Use adaptive, firefox, chromium, or cheerio.`,
      );
  }
}

function parseWaitUntil(value: string): ContextractorInputType['waitUntil'] {
  const result = ContextractorInput.shape.waitUntil.safeParse(value.trim().toLowerCase());
  if (!result.success)
    throw new Error(
      `Invalid --wait-until value: '${value}'. Use load, domcontentloaded, networkidle, or commit.`,
    );
  return result.data;
}

function parseProxyRotation(value: string): ContextractorInputType['proxyRotation'] {
  const result = ContextractorInput.shape.proxyRotation.safeParse(value.trim().toLowerCase());
  if (!result.success)
    throw new Error(
      `Invalid --proxy-rotation value: '${value}'. Use recommended, per-request, or until-failure.`,
    );
  return result.data;
}

function parseDeduplication(value: string): ContextractorInputType['deduplication'] {
  const result = ContextractorInput.shape.deduplication.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid --deduplication value: '${value}'. Use minimal, standard, or aggressive.`,
    );
  }
  return result.data;
}

function parseMode(value: string): ContextractorInputType['mode'] {
  const result = ContextractorInput.shape.mode.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid --mode value: '${value}'. Use precision, balanced, or recall.`);
  }
  return result.data;
}

function parseSaveDestination(
  value: string,
  previous: ContextractorInputType['saveDestination'],
): ContextractorInputType['saveDestination'] {
  const result = ContextractorInput.shape.saveDestination.unwrap().element.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid --save-destination value: '${value}'. Use key-value-store or dataset.`,
    );
  }
  return [...(previous ?? []), result.data];
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

// ---------------------------------------------------------------------------
// Shared option applier
// ---------------------------------------------------------------------------

function addExtractionOptions(cmd: Command): Command {
  const s = ContextractorInput.shape;
  return cmd
    .option('-c, --config <path>', 'Path to JSON config file')
    .option('--clean', 'Purge default storage before extracting (datasets, KVS, request queues)')
    .addOption(
      new Option('--max-requests-per-crawl <n>', 'Max requests to handle (0 = unlimited)')
        .argParser(toInt)
        .default(s.maxRequestsPerCrawl._def.defaultValue, 'unlimited'),
    )
    .addOption(
      new Option('--max-crawl-depth <n>', 'Max link depth from start URLs (0 = start only)')
        .argParser(toInt)
        .default(s.maxCrawlDepth._def.defaultValue, 'unlimited'),
    )
    .option('--headless', 'Run browser in headless mode', s.headless._def.defaultValue)
    .option('--no-headless', 'Run browser with UI')
    .option('--proxy <url>', 'Proxy URL (repeatable)', collectValues, [] as string[])
    .option(
      '--proxy-rotation <strategy>',
      'Proxy rotation: recommended, per-request, until-failure',
    )
    .option('--session-pool-name <name>', 'Named session pool for cross-run session sharing')
    .addOption(
      new Option(
        '--max-session-rotations <n>',
        'Max session rotations per request on block detection',
      )
        .argParser(toInt)
        .default(s.maxSessionRotations._def.defaultValue),
    )
    .option('--crawler-type <type>', 'Crawler engine: adaptive, firefox, chromium, cheerio')
    .option(
      '--rendering-type-detection <ratio>',
      'Rendering type detection ratio 0–1 (adaptive only)',
      toFloat,
    )
    .option('--wait-until <event>', 'Page load event: load, domcontentloaded, networkidle, commit')
    .addOption(
      new Option('--navigation-timeout <secs>', 'Navigation timeout in seconds')
        .argParser(toInt)
        .default(s.navigationTimeoutSecs._def.defaultValue),
    )
    .option('--block-media', 'Block images, stylesheets, fonts, PDFs, and ZIPs')
    .option('--no-block-media', 'Do not block media requests (default)')
    .option('--ignore-cors-and-csp', 'Disable CORS/CSP restrictions')
    .option(
      '--close-cookie-modals',
      'Auto-dismiss cookie banners',
      s.closeCookieModals._def.defaultValue,
    )
    .option('--max-scroll-height <px>', 'Max scroll height in pixels', toInt)
    .option('--ignore-https-errors', 'Skip HTTPS certificate verification')
    .option('--user-agent <ua>', 'Custom User-Agent string')
    .option(
      '--globs <pattern>',
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
    .option('--selector <css>', 'CSS selector for links to follow')
    .option('--keep-url-fragment', 'Preserve URL fragments')
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
        .argParser(parseMode)
        .default('balanced'),
    )
    .option('--no-links', 'Exclude links from output')
    .option('--no-comments', 'Exclude comments from output')
    .option('--no-tables', 'Exclude tables from output')
    .option('--images', 'Include image alt text and captions')
    .option('--no-images', 'Exclude image alt text and captions (default)')
    .option('--language <lang>', 'Filter by language (e.g. en)')
    .option('-v, --verbose', 'Enable verbose logging')
    .option(
      '--save-destination <dest>',
      'Where to save: key-value-store|dataset (repeatable)',
      parseSaveDestination,
      s.saveDestination._def.defaultValue,
    )
    .option('--storage-dir <path>', 'Override Crawlee storage directory')
    .option('--store-skipped-urls', 'Push skipped URL records to the dataset after crawl')
    .option(
      '--wait-for-dynamic-content <seconds>',
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
    .addOption(
      new Option(
        '--deduplication <level>',
        'Deduplication level: minimal, standard (default), or aggressive',
      )
        .choices(['minimal', 'standard', 'aggressive'])
        .argParser(parseDeduplication),
    );
}

// ---------------------------------------------------------------------------
// Schema mapping helpers
// ---------------------------------------------------------------------------

function isCliOverride(command: Command | undefined, optionName: string): boolean {
  return command?.getOptionValueSource(optionName) === 'cli';
}

function getExplicitRepeatedValues(command: Command | undefined, longFlag: string): string[] {
  const parent = command?.parent as (Command & { rawArgs?: string[] }) | undefined;
  const current = command as (Command & { rawArgs?: string[] }) | undefined;
  const rawArgs = parent?.rawArgs ?? current?.rawArgs ?? [];
  const values: string[] = [];

  for (let index = 0; index < rawArgs.length; index++) {
    const arg = rawArgs[index];
    if (arg === undefined) continue;
    if (arg === longFlag) {
      const value = rawArgs[index + 1];
      if (value !== undefined) values.push(value);
      index++;
      continue;
    }
    if (arg.startsWith(`${longFlag}=`)) {
      values.push(arg.slice(longFlag.length + 1));
    }
  }

  return values;
}

function buildSchemaOverrides(
  opts: ExtractOpts,
  command?: Command,
): Partial<ContextractorInputType> {
  const out: Partial<ContextractorInputType> = {};

  if (isCliOverride(command, 'maxRequestsPerCrawl'))
    out.maxRequestsPerCrawl = opts.maxRequestsPerCrawl;
  if (isCliOverride(command, 'maxCrawlDepth')) out.maxCrawlDepth = opts.maxCrawlDepth;
  if (isCliOverride(command, 'headless')) out.headless = opts.headless;
  if (isCliOverride(command, 'crawlerType') && opts.crawlerType) {
    out.crawlerType = parseCrawlerType(opts.crawlerType);
  }
  if (isCliOverride(command, 'renderingTypeDetection')) {
    out.renderingTypeDetectionRatio = opts.renderingTypeDetection;
  }
  if (isCliOverride(command, 'waitUntil') && opts.waitUntil) {
    out.waitUntil = parseWaitUntil(opts.waitUntil);
  }
  if (isCliOverride(command, 'proxyRotation') && opts.proxyRotation) {
    out.proxyRotation = parseProxyRotation(opts.proxyRotation);
  }
  if (isCliOverride(command, 'navigationTimeout'))
    out.navigationTimeoutSecs = opts.navigationTimeout;
  if (isCliOverride(command, 'blockMedia')) out.blockMedia = opts.blockMedia;
  if (isCliOverride(command, 'ignoreCorsAndCsp')) out.ignoreCorsAndCsp = opts.ignoreCorsAndCsp;
  if (isCliOverride(command, 'closeCookieModals')) {
    out.closeCookieModals = opts.closeCookieModals;
  }
  if (isCliOverride(command, 'maxScrollHeight')) out.maxScrollHeight = opts.maxScrollHeight;
  if (isCliOverride(command, 'ignoreHttpsErrors')) out.ignoreHttpsErrors = opts.ignoreHttpsErrors;
  if (isCliOverride(command, 'userAgent')) out.userAgent = opts.userAgent;
  if (isCliOverride(command, 'globs') && opts.globs?.length) {
    out.globs = opts.globs.map((s) => ({ glob: s }));
  }
  if (isCliOverride(command, 'exclude') && opts.exclude?.length) {
    out.exclude = opts.exclude.map((s) => ({ glob: s }));
  }
  if (isCliOverride(command, 'selector')) out.selector = opts.selector;
  if (isCliOverride(command, 'keepUrlFragment')) out.keepUrlFragment = opts.keepUrlFragment;
  if (isCliOverride(command, 'useSitemaps')) out.useSitemaps = opts.useSitemaps;
  if (isCliOverride(command, 'respectRobotsTxt')) {
    out.respectRobotsTxtFile = opts.respectRobotsTxt;
  }
  if (isCliOverride(command, 'cookies') && opts.cookies) {
    out.initialCookies = parseJsonArray(opts.cookies, '--cookies');
  }
  if (isCliOverride(command, 'headers') && opts.headers) {
    out.customHttpHeaders = parseStringRecord(opts.headers, '--headers');
  }
  if (isCliOverride(command, 'initialConcurrency'))
    out.initialConcurrency = opts.initialConcurrency;
  if (isCliOverride(command, 'maxConcurrency')) out.maxConcurrency = opts.maxConcurrency;
  if (isCliOverride(command, 'maxRetries')) out.maxRequestRetries = opts.maxRetries;
  if (isCliOverride(command, 'maxResults')) out.maxResultsPerCrawl = opts.maxResults;
  if (isCliOverride(command, 'waitForDynamicContent')) {
    out.waitForDynamicContentSecs = opts.waitForDynamicContent;
  }
  if (isCliOverride(command, 'waitForSelector')) out.waitForSelector = opts.waitForSelector;
  if (isCliOverride(command, 'softWaitForSelector')) {
    out.softWaitForSelector = opts.softWaitForSelector;
  }
  if (isCliOverride(command, 'deduplication') && opts.deduplication !== undefined) {
    out.deduplication = opts.deduplication;
  }

  if (isCliOverride(command, 'mode')) out.mode = opts.mode;
  if (isCliOverride(command, 'tables')) out.includeTables = opts.tables;
  if (isCliOverride(command, 'images')) out.includeImages = opts.images;
  if (isCliOverride(command, 'links')) out.includeLinks = opts.links;
  if (isCliOverride(command, 'comments')) out.includeComments = opts.comments;
  if (isCliOverride(command, 'language')) out.languageCode = opts.language;
  if (isCliOverride(command, 'saveDestination')) {
    // TODO: remove cast when getExplicitRepeatedValues is refactored to return typed values
    out.saveDestination = getExplicitRepeatedValues(
      command,
      '--save-destination',
    ) as ContextractorInputType['saveDestination'];
  }
  if (isCliOverride(command, 'storeSkippedUrls')) out.storeSkippedUrls = opts.storeSkippedUrls;

  if (isCliOverride(command, 'sessionPoolName') && opts.sessionPoolName) {
    out.sessionPoolName = opts.sessionPoolName;
  }
  if (isCliOverride(command, 'maxSessionRotations')) {
    out.maxSessionRotations = opts.maxSessionRotations;
  }

  return out;
}

function resolveCliOnly(
  opts: ExtractOpts,
  input: ContextractorInputType,
  command?: Command,
): CliOnlyOverrides {
  const urls = input.startUrls
    .map((u) => u.url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  let save: SaveFormat[] = input.save;
  if (isCliOverride(command, 'save')) {
    save = validateSaveFormats(getExplicitRepeatedValues(command, '--save'));
  }

  const proxyUrls = isCliOverride(command, 'proxy') ? (opts.proxy ?? []) : [];

  return {
    urls,
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
  command?: Command,
): Promise<void> {
  if (opts.verbose) process.env.LOG_LEVEL = 'DEBUG';

  const storageDir = resolveStorageDir(opts.storageDir);
  configureStorage(storageDir);

  const fromFile: Partial<ContextractorInputType> = opts.config
    ? await loadConfigFile(opts.config)
    : {};
  const fromCli = buildSchemaOverrides(opts, command);

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

  const cliOnly = resolveCliOnly(opts, parsed.data, command);
  const cfg = buildCrawlConfig(parsed.data, cliOnly);

  const destinations = parsed.data.saveDestination;

  const kvs = await KeyValueStore.open(
    opts.keyValueStore ?? parsed.data.keyValueStoreName ?? 'default',
  );
  const ds = await Dataset.open(datasetName ?? parsed.data.datasetName ?? 'default');
  const requestQueueName = opts.requestQueue ?? parsed.data.requestQueueName;
  const requestQueue = requestQueueName ? await RequestQueue.open(requestQueueName) : undefined;

  if (opts.clean) {
    await rm(path.join(storageDir, 'datasets', 'default'), { recursive: true, force: true });
    await rm(path.join(storageDir, 'key_value_stores', 'default'), {
      recursive: true,
      force: true,
    });
    await rm(path.join(storageDir, 'request_queues', 'default'), {
      recursive: true,
      force: true,
    });
  }

  const formats = cfg.save.length > 0 ? cfg.save.join(', ') : 'markdown';
  const destLabel = destinations.join(', ') || 'key-value-store';
  process.stderr.write(
    `Extracting ${cfg.urls.length} URL(s) → storage [${destLabel}] [${formats}]\n`,
  );

  const sink = createCrawleeStorageSink({
    destinations,
    kvs,
    dataset: ds,
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
  } else if (cliOnly.proxyRotation && cliOnly.proxyRotation !== 'recommended') {
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
      exclude: cfg.exclude,
    });
  }

  let failedCount = 0;

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
    languageCode: cfg.languageCode,
    cookieStrategy: cfg.closeCookieModals ? 'ghostery' : 'none',
    scroll: cfg.maxScrollHeight > 0 ? { maxScrollHeight: cfg.maxScrollHeight } : undefined,
    headless: cfg.headless,
    crawlerType: cfg.crawlerType,
    renderingTypeDetectionRatio: cfg.renderingTypeDetectionRatio,
    ignoreHttpsErrors: cfg.ignoreHttpsErrors,
    bypassCSP: cfg.ignoreCors,
    initialCookies: cfg.cookies,
    extraHTTPHeaders: cfg.headers,
    userAgent: cfg.userAgent || undefined,
    maxRequestsPerCrawl: cfg.maxRequestsPerCrawl,
    maxRetries: cfg.maxRetries,
    initialConcurrency: cfg.initialConcurrency,
    maxConcurrency: cfg.maxConcurrency,
    blockMedia: cfg.blockMedia,
    navigationTimeoutSecs: cfg.navigationTimeoutSecs,
    waitUntil: cfg.waitUntil,
    maxResults: cfg.maxResults > 0 ? cfg.maxResults : undefined,
    selector: cfg.selector || undefined,
    maxCrawlDepth: cfg.maxCrawlDepth,
    globs: cfg.globs,
    exclude: cfg.exclude,
    keepUrlFragment: cfg.keepUrlFragment,
    respectRobotsTxt: cfg.respectRobotsTxt,
    waitForDynamicContentSecs:
      cfg.waitForDynamicContentSecs > 0 ? cfg.waitForDynamicContentSecs : undefined,
    waitForSelector: cfg.waitForSelector || undefined,
    softWaitForSelector: cfg.softWaitForSelector || undefined,
    deduplication: cfg.deduplication,
    ...(sitemapList !== undefined ? { requestList: sitemapList } : {}),
    proxyConfiguration,
    proxyRotation: cliOnly.proxyRotation,
    sessionPoolName: cfg.sessionPoolName,
    maxSessionRotations: cfg.maxSessionRotations,
    requestQueue,
    onFailedRequest: async (info) => {
      failedCount++;
      await ds.pushData(buildFailedRecord(info));
    },
    ...(parsed.data.storeSkippedUrls
      ? {
          onSkippedUrl: (url, reason) => {
            void ds.pushData(buildSkippedRecord(url, reason));
          },
        }
      : {}),
  });

  await crawler.run(buildRequests(cfg.urls, cfg.keepUrlFragment));

  process.stderr.write('Done.\n');
  if (failedCount > 0) process.exit(2);
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
  extract.option(
    '--key-value-store <name>',
    'Route content blobs to a named key-value store (default: default)',
  );
  extract.option('--request-queue <name>', 'Route pending URLs to a named request queue');
  addExtractionOptions(extract);
  extract.action(
    async (
      urls: string[],
      opts: ExtractOpts & { inputFile?: string; dataset?: string },
      command: Command,
    ) => {
      await runExtractAction(urls, opts, opts.inputFile, opts.dataset, command);
    },
  );
  program.addCommand(extract);

  // ---------------------------------------------------------------------------
  // export subcommand
  // ---------------------------------------------------------------------------
  const exportCmd = new Command('export');
  exportCmd
    .description('Export stored extraction content to a user-facing output directory')
    .option('--output-dir <path>', 'Output directory (default: ./contextractor-output)')
    .option('--dataset <name>', 'Dataset to read the record index from (default: default)')
    .option('--key-value-store <name>', 'Key-value store holding content blobs (default: default)')
    .option('--storage-dir <path>', 'Override Crawlee storage directory')
    .action(
      async (opts: {
        outputDir?: string;
        dataset?: string;
        keyValueStore?: string;
        storageDir?: string;
      }) => {
        const result = await runExportAction(opts);
        process.stderr.write(
          `Exported ${result.filesWritten} file(s) from ${result.recordsTotal} record(s) → ${result.outputDir}\n`,
        );
      },
    );
  program.addCommand(exportCmd);

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
  clean?: boolean;
  maxRequestsPerCrawl?: number;
  maxCrawlDepth?: number;
  headless?: boolean;
  proxy?: string[];
  proxyRotation?: string;
  crawlerType?: string;
  renderingTypeDetection?: number;
  waitUntil?: string;
  navigationTimeout?: number;
  blockMedia?: boolean;
  ignoreCorsAndCsp?: boolean;
  closeCookieModals?: boolean;
  maxScrollHeight?: number;
  ignoreHttpsErrors?: boolean;
  userAgent?: string;
  globs?: string[];
  exclude?: string[];
  selector?: string;
  keepUrlFragment?: boolean;
  useSitemaps?: boolean;
  respectRobotsTxt?: boolean;
  cookies?: string;
  headers?: string;
  initialConcurrency?: number;
  maxConcurrency?: number;
  maxRetries?: number;
  maxResults?: number;
  save?: string[];
  mode?: ContextractorInputType['mode'];
  links?: boolean;
  comments?: boolean;
  tables?: boolean;
  images?: boolean;
  language?: string;
  verbose?: boolean;
  saveDestination?: ContextractorInputType['saveDestination'];
  storageDir?: string;
  keyValueStore?: string;
  requestQueue?: string;
  storeSkippedUrls?: boolean;
  waitForDynamicContent?: number;
  waitForSelector?: string;
  softWaitForSelector?: string;
  deduplication?: ContextractorInputType['deduplication'];
  sessionPoolName?: string;
  maxSessionRotations?: number;
}
