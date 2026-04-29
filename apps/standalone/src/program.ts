import { buildRequests, createContextractorCrawler, fileSink } from '@contextractor/crawler';
import { ContextractorInput } from '@contextractor/schema';
import { Command } from 'commander';
import { buildCrawlConfig, loadConfigFile, type SaveFormat } from './config.js';
import { buildSchemaOverrides, type CliOptions, resolveCliOnly, toInt } from './options.js';

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

      const fromFile = opts.config
        ? ((await loadConfigFile(opts.config)) as Record<string, unknown>)
        : {};
      const fromCli = buildSchemaOverrides(opts);

      const collectedUrls = [...urls];
      if (opts.startUrl) collectedUrls.push(opts.startUrl);
      if (collectedUrls.length > 0) fromCli.startUrls = collectedUrls.map((url) => ({ url }));

      const layered: Record<string, unknown> = { ...fromFile, ...fromCli };
      const fileTrafilatura =
        (fromFile.trafilaturaConfig as Record<string, unknown> | undefined) ?? {};
      const cliTrafilatura =
        (fromCli.trafilaturaConfig as Record<string, unknown> | undefined) ?? {};
      if (Object.keys(fileTrafilatura).length || Object.keys(cliTrafilatura).length) {
        layered.trafilaturaConfig = { ...fileTrafilatura, ...cliTrafilatura };
      }

      const startUrlsLayered = layered.startUrls as Array<{ url: string }> | undefined;
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

      const sink = fileSink({
        outDir: cfg.outputDir,
        formats: cfg.save.filter((f): f is Exclude<SaveFormat, 'jsonl'> => f !== 'jsonl'),
      });
      const crawler = createContextractorCrawler({
        startUrls: cfg.urls,
        sink,
        formats: cfg.save.filter((f): f is Exclude<SaveFormat, 'jsonl'> => f !== 'jsonl'),
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
        maxResults: cfg.maxResults > 0 ? cfg.maxResults : undefined,
        linkSelector: cfg.linkSelector || undefined,
        maxCrawlingDepth: cfg.crawlDepth,
        globs: cfg.globs,
        excludes: cfg.excludes,
        keepUrlFragments: cfg.keepUrlFragments,
      });

      await crawler.run(buildRequests(cfg.urls, cfg.keepUrlFragments));
      console.log('Done.');
    });

  return program;
}
