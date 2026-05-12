import {
  buildProgram,
  configureStorage,
  Dataset,
  KeyValueStore,
  resolveStorageDir,
} from '@contextractor/standalone';

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
]);

// Read results back via re-exported Dataset API
const ds = await Dataset.open('my-results');
const page = await ds.getData({ limit: 10 });
console.log(`Extracted ${page.count} item(s) of ${page.total} total`);
await ds.forEach((item) => {
  console.log('url:', item.url);
});

// Read a value from the default key-value store
const kvs = await KeyValueStore.open('default');
const keys: string[] = [];
await kvs.forEachKey((key) => {
  keys.push(key);
});
console.log('KVS keys:', keys);
