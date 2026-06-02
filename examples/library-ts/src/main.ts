import {
  buildProgram,
  configureStorage,
  Dataset,
  KeyValueStore,
  resolveStorageDir,
} from 'contextractor';

const storageDir = resolveStorageDir();
configureStorage(storageDir);

const program = buildProgram();

// Extract a page and save to dataset
await program.parseAsync([
  'node',
  'contextractor',
  'extract',
  'https://example.com',
  '--save',
  'txt',
  '--save-destination',
  'dataset',
  '--dataset',
  'my-results',
  '--initial-concurrency',
  '3',
  '--block-media',
  '--wait-for-dynamic-content',
  '5',
  '--wait-for-selector',
  'article',
  '--deduplication',
  'none',
]);

// Read results back via re-exported Dataset API
const ds = await Dataset.open('my-results');
const page = await ds.getData({ limit: 10 });
console.log(`Extracted ${page.count} item(s) of ${page.total} total`);
await ds.forEach((item) => {
  const status = item.status ?? 'success';
  if (status === 'failed') {
    console.log('url:', item.url, '— failed:', item.errors);
  } else if (status === 'skipped') {
    console.log('url:', item.url, '— skipped:', item.skipReason);
  } else {
    const crawl = item.crawl as { depth: number; referrerUrl: string | null } | undefined;
    console.log('url:', item.url, 'depth:', crawl?.depth, 'referrer:', crawl?.referrerUrl);
  }
});

// Read a value from the default key-value store
const kvs = await KeyValueStore.open('default');
const keys: string[] = [];
await kvs.forEachKey((key) => {
  keys.push(key);
});
console.log('KVS keys:', keys);
