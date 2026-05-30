import {
  buildFailedRecord,
  buildRequests,
  buildSkippedRecord,
  createContextractorCrawler,
  SitemapRequestList,
} from '@contextractor/crawler';
import { ContextractorInput } from '@contextractor/schema';
import type { ProxyConfigurationOptions } from 'apify';
import { Actor, log } from 'apify';
import { buildCrawlerOpts } from './config.js';
import { createApifySink } from './sinks.js';

export async function runActor(): Promise<void> {
  await Actor.init();

  const raw = (await Actor.getInput()) ?? {};
  const parsed = ContextractorInput.safeParse(raw);
  if (!parsed.success) {
    log.error('Invalid Actor input', { errors: parsed.error.format() });
    await Actor.exit({ exitCode: 1 });
    process.exit(1);
  }

  const input = parsed.data;

  const startUrls = input.startUrls
    .map((u) => u?.url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
  if (startUrls.length === 0) {
    log.info('No URLs provided.');
    await Actor.exit();
    process.exit(0);
  }

  const kvs = input.keyValueStoreName
    ? await Actor.openKeyValueStore(input.keyValueStoreName)
    : await Actor.openKeyValueStore();
  const dataset = await Actor.openDataset(input.datasetName);
  const requestQueue = input.requestQueueName
    ? await Actor.openRequestQueue(input.requestQueueName)
    : undefined;
  let proxyConfig: Awaited<ReturnType<typeof Actor.createProxyConfiguration>> | undefined;
  if (input.proxyConfiguration) {
    proxyConfig = await Actor.createProxyConfiguration(
      input.proxyConfiguration as ProxyConfigurationOptions,
    );
  }

  const sink = createApifySink({
    kvs,
    dataset,
    saveOriginal: input.save.includes('original'),
    saveDestination: input.saveDestination,
  });
  let sitemapList: SitemapRequestList | undefined;
  if (input.useSitemaps) {
    const sitemapUrls = [...new Set(startUrls.map((u) => `${new URL(u).origin}/sitemap.xml`))];
    sitemapList = await SitemapRequestList.open({
      sitemapUrls,
      globs: input.globs.map((g) => g.glob).filter((g): g is string => Boolean(g)),
      exclude: input.excludes.map((g) => g.glob).filter((g): g is string => Boolean(g)),
    });
  }

  const crawler = createContextractorCrawler({
    ...buildCrawlerOpts(input, sink, proxyConfig, requestQueue, input.proxyRotation),
    ...(sitemapList !== undefined ? { requestList: sitemapList } : {}),
    onFailedRequest: async (info) => {
      await dataset.pushData(buildFailedRecord(info));
    },
    ...(input.storeSkippedUrls
      ? {
          onSkippedUrl: (url, reason) => {
            void dataset.pushData(buildSkippedRecord(url, reason));
          },
        }
      : {}),
  });
  await crawler.run(buildRequests(startUrls, input.keepUrlFragments));
  await Actor.exit();
}
