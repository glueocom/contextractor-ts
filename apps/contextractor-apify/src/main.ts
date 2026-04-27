import { ContextractorInput } from '@contextractor/schema';
import { Actor, log } from 'apify';
import { PlaywrightCrawler, Request } from 'crawlee';
import {
  buildBrowserContextOptions,
  buildBrowserLaunchOptions,
  buildCrawlConfig,
} from './config.js';
import { createRequestHandler, ResultsCounter } from './handler.js';

await Actor.init();

const raw = (await Actor.getInput()) ?? {};
const parsed = ContextractorInput.safeParse(raw);
if (!parsed.success) {
  log.error('Invalid Actor input', { errors: parsed.error.format() });
  await Actor.exit({ exitCode: 1 });
  process.exit(1);
}
const input = parsed.data;

if (input.debugLog) {
  log.setLevel(log.LEVELS.DEBUG);
}

const startUrls = input.startUrls
  .map((u) => u?.url)
  .filter((u): u is string => typeof u === 'string' && u.length > 0);

if (startUrls.length === 0) {
  log.info('No URLs provided.');
  await Actor.exit();
  process.exit(0);
}

const config = buildCrawlConfig(input);

const kvs = input.keyValueStoreName
  ? await Actor.openKeyValueStore(input.keyValueStoreName)
  : await Actor.openKeyValueStore();

const dataset = input.datasetName ? await Actor.openDataset(input.datasetName) : null;

const proxyConfig = input.proxyConfiguration
  ? // biome-ignore lint/suspicious/noExplicitAny: Apify Actor proxy input is loosely typed.
    await Actor.createProxyConfiguration(input.proxyConfiguration as any)
  : undefined;

const browserLaunchOptions = buildBrowserLaunchOptions(input);
const browserContextOptions = buildBrowserContextOptions(input);

const maxPages = input.maxPagesPerCrawl;
const waitUntil = input.waitUntil.toLowerCase() as 'load' | 'domcontentloaded' | 'networkidle';

const crawler = new PlaywrightCrawler({
  headless: input.headless,
  launchContext: {
    launcher: undefined,
    launchOptions: browserLaunchOptions,
    useChrome: false,
  },
  browserPoolOptions: browserContextOptions
    ? {
        useFingerprints: false,
        // crawlee TS exposes Playwright context options via newPageOptions or browserPlugin context options
      }
    : undefined,
  maxRequestsPerCrawl: maxPages > 0 ? maxPages : undefined,
  maxRequestRetries: input.maxRequestRetries,
  requestHandlerTimeoutSecs: input.pageLoadTimeoutSecs,
  navigationTimeoutSecs: input.pageLoadTimeoutSecs,
  proxyConfiguration: proxyConfig,
  preNavigationHooks: [
    async ({ page }) => {
      if (browserContextOptions?.extraHTTPHeaders) {
        await page.setExtraHTTPHeaders(browserContextOptions.extraHTTPHeaders);
      }
      if (browserContextOptions?.userAgent) {
        await page.context().route('**/*', (route) => route.continue());
      }
    },
  ],
  postNavigationHooks: [],
  ...(waitUntil
    ? {
        // crawlee passes Playwright goto options via preNavigationHooks; explicit option absent in v3 API
      }
    : {}),
});

const resultsCounter = new ResultsCounter(input.maxResultsPerCrawl);
const requestHandler = createRequestHandler({
  kvs,
  dataset,
  resultsCounter,
  browserLogEnabled: input.browserLog,
});

crawler.router.addDefaultHandler(async (context) => {
  // Pass the parsed waitUntil into goto via pre-navigation if needed.
  await requestHandler(context);
});

const requests = startUrls.map(
  (url) =>
    new Request({
      url,
      userData: { config, depth: 0 },
      keepUrlFragment: input.keepUrlFragments,
    }),
);

await crawler.run(requests);

await Actor.exit();
