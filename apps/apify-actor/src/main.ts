import { ContextractorInput } from '@contextractor/schema';
import { buildRequests, createContextractorCrawler } from '@contextractor/crawler';
import { Actor, log } from 'apify';
import { buildCrawlerOpts } from './config.js';
import { createApifySink } from './sinks.js';

await Actor.init();

const raw = (await Actor.getInput()) ?? {};
const parsed = ContextractorInput.safeParse(raw);
if (!parsed.success) {
  log.error('Invalid Actor input', { errors: parsed.error.format() });
  await Actor.exit({ exitCode: 1 });
  process.exit(1);
}
const input = parsed.data;
if (input.debugLog) log.setLevel(log.LEVELS.DEBUG);

const startUrls = input.startUrls
  .map((u) => u?.url)
  .filter((u): u is string => typeof u === 'string' && u.length > 0);
if (startUrls.length === 0) { log.info('No URLs provided.'); await Actor.exit(); process.exit(0); }

const kvs = input.keyValueStoreName
  ? await Actor.openKeyValueStore(input.keyValueStoreName)
  : await Actor.openKeyValueStore();
const dataset = input.datasetName ? await Actor.openDataset(input.datasetName) : null;
const proxyConfig = input.proxyConfiguration
  // biome-ignore lint/suspicious/noExplicitAny: Apify Actor proxy input is loosely typed.
  ? await Actor.createProxyConfiguration(input.proxyConfiguration as any)
  : undefined;

const sink = createApifySink({ kvs, dataset, saveHtml: input.saveRawHtmlToKeyValueStore });
const crawler = createContextractorCrawler(buildCrawlerOpts(input, sink, proxyConfig));
await crawler.run(buildRequests(startUrls, input.keepUrlFragments));
await Actor.exit();
