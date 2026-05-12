import { ApifyClient } from 'apify-client';

// Load token from environment — never hardcode secrets
const APIFY_TOKEN = process.env.APIFY_TOKEN;
if (!APIFY_TOKEN) {
  throw new Error('APIFY_TOKEN environment variable is required');
}

const client = new ApifyClient({ token: APIFY_TOKEN });

// Start the test actor and wait for it to finish
const run = await client.actor('glueo/contextractor-test').call({
  startUrls: [{ url: 'https://example.com' }],
  save: ['txt'],
  saveDestination: ['dataset'],
  initialConcurrency: 3,
  blockMedia: true,
  useSitemaps: true,
  storeSkippedUrls: true,
  dynamicContentWaitSecs: 5,
  waitForSelector: 'article',
  ignoreCanonicalUrl: true,
});

console.log('Run finished:', run.status);

// Retrieve dataset results
const { items } = await client.dataset(run.defaultDatasetId).listItems();
console.log(`Got ${items.length} item(s)`);
for (const item of items) {
  const record = item as Record<string, unknown>;
  const crawl = record.crawl as { depth: number; referrerUrl: string | null } | undefined;
  console.log(
    'url:',
    item.url,
    'status:',
    item.status,
    'depth:',
    crawl?.depth,
    'referrer:',
    crawl?.referrerUrl,
  );
}
