import {
  buildSuccessRecord,
  type ExtractionResult,
  type KvsLike,
  type Sink,
} from '@contextractor/crawler';
import type { Dataset } from 'apify';

interface ApifySinkOpts {
  kvs: KvsLike;
  dataset: Dataset;
  saveOriginal: boolean;
  saveDestination: string[];
}

/**
 * Sink that writes each extracted page to the Apify dataset (and, per
 * `saveDestination`, the key-value store). Record assembly and KVS key
 * derivation live in the shared `@contextractor/crawler` sink core so the
 * Actor and the standalone CLI/lib produce identical output.
 */
export function createApifySink(opts: ApifySinkOpts): Sink<ExtractionResult> {
  const { kvs, dataset, saveOriginal, saveDestination } = opts;
  const toKvs = saveDestination.includes('key-value-store');
  const toDataset = saveDestination.includes('dataset');

  return async (result: ExtractionResult): Promise<void> => {
    const data = await buildSuccessRecord(result, { kvs, toKvs, toDataset, saveOriginal });
    await dataset.pushData(data);
  };
}
