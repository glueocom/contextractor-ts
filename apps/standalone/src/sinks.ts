import {
  buildSuccessRecord,
  type ExtractionResult,
  type KvsLike,
  type Sink,
} from '@contextractor/crawler';
import type { Dataset, KeyValueStore } from 'crawlee';
import type { SaveFormat } from './config.js';

/**
 * Sink that writes each extracted page to a Crawlee dataset (and, per
 * `destinations`, the key-value store). Record assembly and KVS key derivation
 * live in the shared `@contextractor/crawler` sink core, so the standalone
 * CLI/lib and the Apify Actor produce identical output.
 */
export function createCrawleeStorageSink(opts: {
  destinations: string[];
  kvs: KeyValueStore;
  dataset: Dataset;
  formats: SaveFormat[];
}): Sink<ExtractionResult> {
  const { destinations, kvs, dataset, formats } = opts;
  const toKvs = destinations.includes('key-value-store');
  const toDataset = destinations.includes('dataset');
  const saveOriginal = formats.includes('original');

  // Local Crawlee storage has no meaningful public URL, so expose only
  // `setValue` to the shared builder; KVS content nodes then carry {hash, bytes,
  // key} without a misleading url. The Apify Actor passes its KVS with
  // `getPublicUrl`, so its content nodes additionally carry a public url.
  const kvsLike: KvsLike = {
    setValue: (key, value, options) => kvs.setValue(key, value, options),
  };

  return async (result) => {
    try {
      const data = await buildSuccessRecord(result, {
        kvs: kvsLike,
        toKvs,
        toDataset,
        saveOriginal,
      });
      await dataset.pushData(data);
    } catch (err) {
      process.stderr.write(
        `[storage] Warning: storage write failed for ${result.url}: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  };
}
