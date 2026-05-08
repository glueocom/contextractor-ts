/**
 * Call the contextractor Apify actor via the Apify Client.
 *
 * The flow:
 *   1. Start a run of glueo/contextractor-test with the target URL.
 *   2. Wait for the run to finish (waitForFinish).
 *   3. Retrieve items from the run's default dataset.
 *
 * Prerequisites:
 *   APIFY_TOKEN environment variable must be set to your Apify API token.
 *
 * Run:
 *   npm install
 *   APIFY_TOKEN=<your-token> npx tsx src/main.ts
 */

import { ApifyClient } from 'apify-client';

const ACTOR_ID = 'glueo/contextractor-test';
const EXAMPLE_URL = 'https://blog.apify.com/what-is-web-scraping/';

const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error('Error: APIFY_TOKEN environment variable is not set.');
  process.exit(1);
}

interface ActorInput {
  startUrls: Array<{ url: string }>;
  save: string[];
  saveDestination: string[];
  maxPagesPerCrawl: number;
}

interface ExtractionItem {
  url?: string;
  loadedUrl?: string;
  markdown?: string;
  txt?: string;
  [key: string]: unknown;
}

async function main(): Promise<void> {
  const client = new ApifyClient({ token });

  const input: ActorInput = {
    startUrls: [{ url: EXAMPLE_URL }],
    // Save as markdown. The actor supports: txt, markdown, json, html, original.
    save: ['markdown'],
    // Route results to the Apify dataset (visible in the Apify Console run page).
    saveDestination: ['dataset'],
    // Crawl only the start URL.
    maxPagesPerCrawl: 1,
  };

  console.log(`Starting actor run: ${ACTOR_ID}`);
  console.log(`URL: ${EXAMPLE_URL}`);

  const run = await client.actor(ACTOR_ID).call(input, {
    // Wait up to 5 minutes for the run to complete.
    waitSecs: 300,
  });

  console.log(`Run finished: id=${run.id} status=${run.status}`);

  if (!run.defaultDatasetId) {
    throw new Error('Run did not produce a dataset.');
  }

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  console.log(`\nDataset items: ${items.length}`);
  for (const item of items as ExtractionItem[]) {
    console.log(JSON.stringify(item, null, 2));
  }
}

await main();
