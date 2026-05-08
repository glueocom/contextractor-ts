import { realpathSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRequests,
  createContextractorCrawler,
  ProxyConfiguration,
} from '@contextractor/crawler';
import { ContextractorInput, type ContextractorInputType } from '@contextractor/schema';
import { Command } from 'commander';
import {
  buildCrawlConfig,
  type CliOnlyOverrides,
  loadConfigFile,
  type SaveFormat,
  validateSaveFormats,
} from './config.js';
import { buildServeApp, validateServeOptions } from './serve/app.js';
import { isRunningInDocker } from './serve/docker.js';
import { createCliSink } from './sinks.js';
import { Dataset } from './storage/dataset.js';
import { KeyValueStore } from './storage/key-value-store.js';
import { resolveStorageDir } from './storage/resolve-storage-dir.js';

export function buildProgram(): Command {
  const program = new Command();

  program
    .name('contextractor')
    .description('Extract web content from URLs using configurable extraction options.')
    .version('0.1.0')
    // Legacy root-command positional URLs — preserved for backward compat.
    .argument('[urls...]', 'URLs to extract content from')
    .option('-c, --config <path>', 'Path to JSON config file')
    .option('--start-url <url>', 'Start URL (alternative to positional URL)')
    .option('-o, --output-dir <dir>', 'Output directory')
    .option('--storage-dir <dir>', 'Storage root directory')
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
    .option('--save <formats>', 'Output formats: markdown,html,txt,json,jsonl,original,all')
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
      await runExtract(urls, opts);
    });

  // ──────────────────────────────────────────
  // extract subcommand
  // ──────────────────────────────────────────
  const extractCmd = new Command('extract');
  extractCmd
    .description('Extract content from one or more URLs and write to storage + stdout')
    .argument('[urls...]', 'URLs to extract content from')
    .option('-c, --config <path>', 'Path to JSON config file')
    .option('--start-url <url>', 'Start URL (alternative to positional URL)')
    .option('-o, --output-dir <dir>', 'Output directory')
    .option('--dataset <name>', 'Dataset name to push records into (default: "default")')
    .option('--storage-dir <dir>', 'Storage root directory')
    .option('--no-stdout', 'Suppress stdout output (write to storage only)')
    .option('--ndjson', 'Force NDJSON output on stdout for single-URL runs')
    .option('--input-file <file>', 'File containing one URL per line')
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
    .option('--save <formats>', 'Output formats: markdown,html,txt,json,jsonl,original,all')
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
      await runExtract(urls, opts);
    });
  program.addCommand(extractCmd);

  // ──────────────────────────────────────────
  // list subcommand
  // ──────────────────────────────────────────
  const listCmd = new Command('list');
  listCmd
    .description('List items in a dataset')
    .argument('[dataset]', 'Dataset name (default: "default")')
    .option('--storage-dir <dir>', 'Storage root directory')
    .option('--limit <n>', 'Max items to return', toInt)
    .option('--offset <n>', 'Skip first N items', toInt)
    .option('--format <fmt>', 'Output format: json|jsonl|csv', 'json')
    .option('--desc', 'Return items in reverse order')
    .action(async (datasetName: string | undefined, opts: ListOptions) => {
      const storageDir = resolveStorageDir({ storageDir: opts.storageDir });
      const name = datasetName ?? 'default';
      const ds = new Dataset(storageDir, name);
      const result = await ds.getItems({
        offset: opts.offset,
        limit: opts.limit,
        desc: opts.desc,
      });

      if (opts.format === 'jsonl') {
        for (const item of result.items) {
          process.stdout.write(`${JSON.stringify(item)}\n`);
        }
      } else if (opts.format === 'csv') {
        process.stdout.write(toCSV(result.items));
      } else {
        process.stdout.write(`${JSON.stringify(result.items, null, 2)}\n`);
      }
    });
  program.addCommand(listCmd);

  // ──────────────────────────────────────────
  // get subcommand
  // ──────────────────────────────────────────
  const getCmd = new Command('get');
  getCmd
    .description('Get a single item from a dataset by index')
    .argument('<dataset>', 'Dataset name')
    .argument('<index>', 'Item index (0-based)', toInt)
    .option('--storage-dir <dir>', 'Storage root directory')
    .action(async (datasetName: string, index: number, opts: { storageDir?: string }) => {
      const storageDir = resolveStorageDir({ storageDir: opts.storageDir });
      const ds = new Dataset(storageDir, datasetName);
      const result = await ds.getItems({ offset: index, limit: 1 });
      if (result.items.length === 0) {
        console.error(`No item at index ${index} in dataset '${datasetName}'`);
        process.exit(1);
      }
      process.stdout.write(`${JSON.stringify(result.items[0], null, 2)}\n`);
    });
  program.addCommand(getCmd);

  // ──────────────────────────────────────────
  // kvs subcommand group
  // ──────────────────────────────────────────
  const kvsCmd = new Command('kvs');
  kvsCmd.description('Manage key-value store records');

  kvsCmd
    .command('put <key> <file-or-stdin>')
    .description('Store a file (or - for stdin) as a KVS record')
    .option('--store <name>', 'KVS name (default: "default")')
    .option('--storage-dir <dir>', 'Storage root directory')
    .option('--content-type <mime>', 'MIME type of the record')
    .action(
      async (
        key: string,
        fileOrStdin: string,
        opts: { store?: string; storageDir?: string; contentType?: string },
      ) => {
        const storageDir = resolveStorageDir({ storageDir: opts.storageDir });
        const kvs = new KeyValueStore(storageDir, opts.store ?? 'default');
        let data: Buffer;
        let contentType = opts.contentType ?? 'application/octet-stream';

        if (fileOrStdin === '-') {
          data = await readStdin();
        } else {
          const { readFile } = await import('node:fs/promises');
          data = await readFile(fileOrStdin);
          if (!opts.contentType) {
            const ext = path.extname(fileOrStdin).slice(1);
            if (ext === 'json') contentType = 'application/json';
            else if (ext === 'txt') contentType = 'text/plain';
            else if (ext === 'html') contentType = 'text/html';
          }
        }

        await kvs.setValue(key, data, contentType);
        console.error(`Stored '${key}' in KVS '${opts.store ?? 'default'}'`);
      },
    );

  kvsCmd
    .command('get <key>')
    .description('Retrieve a KVS record and write raw bytes to stdout')
    .option('--store <name>', 'KVS name (default: "default")')
    .option('--storage-dir <dir>', 'Storage root directory')
    .action(async (key: string, opts: { store?: string; storageDir?: string }) => {
      const storageDir = resolveStorageDir({ storageDir: opts.storageDir });
      const kvs = new KeyValueStore(storageDir, opts.store ?? 'default');
      const record = await kvs.getValue(key);
      if (!record) {
        console.error(`Key '${key}' not found in KVS '${opts.store ?? 'default'}'`);
        process.exit(1);
      }
      process.stdout.write(record.value);
    });

  kvsCmd
    .command('ls')
    .description('List keys in a key-value store')
    .option('--store <name>', 'KVS name (default: "default")')
    .option('--storage-dir <dir>', 'Storage root directory')
    .option('--limit <n>', 'Max keys to return', toInt)
    .option('--exclusive-start-key <key>', 'Pagination: start after this key')
    .action(
      async (opts: {
        store?: string;
        storageDir?: string;
        limit?: number;
        exclusiveStartKey?: string;
      }) => {
        const storageDir = resolveStorageDir({ storageDir: opts.storageDir });
        const kvs = new KeyValueStore(storageDir, opts.store ?? 'default');
        const result = await kvs.listKeys({
          limit: opts.limit,
          exclusiveStartKey: opts.exclusiveStartKey,
        });
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      },
    );

  kvsCmd
    .command('rm <key>')
    .description('Delete a KVS record')
    .option('--store <name>', 'KVS name (default: "default")')
    .option('--storage-dir <dir>', 'Storage root directory')
    .action(async (key: string, opts: { store?: string; storageDir?: string }) => {
      const storageDir = resolveStorageDir({ storageDir: opts.storageDir });
      const kvs = new KeyValueStore(storageDir, opts.store ?? 'default');
      await kvs.deleteValue(key);
      console.error(`Deleted '${key}' from KVS '${opts.store ?? 'default'}'`);
    });

  program.addCommand(kvsCmd);

  // ──────────────────────────────────────────
  // purge subcommand
  // ──────────────────────────────────────────
  const purgeCmd = new Command('purge');
  purgeCmd
    .description('Remove the default dataset and KVS (or all named storages with --all)')
    .option('--all', 'Remove all datasets and key-value stores')
    .option('--storage-dir <dir>', 'Storage root directory')
    .action(async (opts: { all?: boolean; storageDir?: string }) => {
      const storageDir = resolveStorageDir({ storageDir: opts.storageDir });
      if (opts.all) {
        const { rm: rmFs } = await import('node:fs/promises');
        await rmFs(path.join(storageDir, 'datasets'), { recursive: true, force: true });
        await rmFs(path.join(storageDir, 'key_value_stores'), {
          recursive: true,
          force: true,
        });
        console.error('Purged all datasets and key-value stores');
      } else {
        const ds = new Dataset(storageDir, 'default');
        const kvs = new KeyValueStore(storageDir, 'default');
        await ds.drop();
        await kvs.drop();
        console.error('Purged default dataset and key-value store');
      }
    });
  program.addCommand(purgeCmd);

  // ──────────────────────────────────────────
  // storage-dir subcommand
  // ──────────────────────────────────────────
  const storageDirCmd = new Command('storage-dir');
  storageDirCmd
    .description('Print the resolved storage root directory and exit')
    .option('--storage-dir <dir>', 'Override storage root directory')
    .action((opts: { storageDir?: string }) => {
      const resolved = resolveStorageDir({ storageDir: opts.storageDir });
      process.stdout.write(`${resolved}\n`);
    });
  program.addCommand(storageDirCmd);

  // ──────────────────────────────────────────
  // serve subcommand
  // ──────────────────────────────────────────
  const serveCmd = new Command('serve');
  serveCmd
    .description('Start an HTTP server exposing the storage directory via Apify-compatible API')
    .option('--host <host>', 'Bind host (npm: 127.0.0.1 only; Docker: any)', '127.0.0.1')
    .option('--port <n>', 'Port to listen on', toInt, 8080)
    .option('--token <token>', 'Bearer token for authentication (overrides env var)')
    .option('--insecure', 'Skip auth enforcement (Docker only, for development)')
    .option('--storage-dir <dir>', 'Storage root directory')
    .action(async (opts: ServeOptions) => {
      const token = opts.token ?? process.env.CONTEXTRACTOR_API_TOKEN;
      const storageDir = resolveStorageDir({ storageDir: opts.storageDir });

      try {
        validateServeOptions({ host: opts.host, token, insecure: opts.insecure ?? false });
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      if (opts.insecure && isRunningInDocker()) {
        console.error('[WARN] Running with --insecure: no authentication enforced on non-loopback');
      }

      const app = buildServeApp({
        storageDir,
        host: opts.host,
        token,
        insecure: opts.insecure ?? false,
      });

      // Ensure storage dir exists.
      await mkdir(storageDir, { recursive: true });

      const { serve } = await import('@hono/node-server');
      serve(
        {
          fetch: app.fetch,
          hostname: opts.host,
          port: opts.port ?? 8080,
        },
        (info) => {
          console.error(`contextractor serve listening on http://${info.address}:${info.port}`);
          console.error(`Storage: ${storageDir}`);
          console.error(`Docs: http://${info.address}:${info.port}/docs`);
        },
      );
    });
  program.addCommand(serveCmd);

  return program;
}

// ──────────────────────────────────────────────────────────────────────────────
// Shared extract logic (used by both root command and `extract` subcommand)
// ──────────────────────────────────────────────────────────────────────────────

async function runExtract(urls: string[], opts: CliOptions): Promise<void> {
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
  const storageDir = resolveStorageDir({ storageDir: opts.storageDir });
  const datasetName = opts.dataset ?? 'default';

  const formats = cfg.save.length > 0 ? cfg.save.join(', ') : 'markdown';
  console.error(`Extracting ${cfg.urls.length} URL(s) → ${cfg.outputDir}/ (${formats})`);

  const dataset = new Dataset(storageDir, datasetName);
  const noStdout = opts.stdout === false || opts.noStdout === true;
  const forceNdjson = opts.ndjson === true || cfg.urls.length > 1;

  const sink = createCliSink({
    outDir: cfg.outputDir,
    formats: cfg.save,
    dataset,
    noStdout,
    ndjson: forceNdjson,
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
      (format): format is Exclude<SaveFormat, 'jsonl' | 'original'> =>
        format !== 'jsonl' && format !== 'original',
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
  console.error('Done.');
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

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

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

function toCSV(items: unknown[]): string {
  if (items.length === 0) return '';
  const first = items[0];
  if (!first || typeof first !== 'object') {
    return items.map(String).join('\n');
  }
  const keys = Object.keys(first as object);
  const header = keys.map(csvCell).join(',');
  const rows = items.map((item) => {
    const row = item as Record<string, unknown>;
    return keys.map((k) => csvCell(String(row[k] ?? ''))).join(',');
  });
  return `${[header, ...rows].join('\n')}\n`;
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks);
}

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface CliOptions {
  config?: string;
  startUrl?: string;
  outputDir?: string;
  dataset?: string;
  storageDir?: string;
  stdout?: boolean;
  noStdout?: boolean;
  ndjson?: boolean;
  inputFile?: string;
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

interface ListOptions {
  storageDir?: string;
  limit?: number;
  offset?: number;
  format?: string;
  desc?: boolean;
}

interface ServeOptions {
  host: string;
  port?: number;
  token?: string;
  insecure?: boolean;
  storageDir?: string;
}
