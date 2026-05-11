export { Configuration, Dataset, KeyValueStore } from 'crawlee';
export { program } from './cli.js';
export { buildProgram, isMainEntry, runCli } from './cliProgram.js';
export { configureStorage, resolveStorageDir } from './storage/index.js';

/** Mirrors the `DatasetContent<Data>` type from `@crawlee/core`. */
export interface DatasetContent<Data = Record<string, unknown>> {
  items: Data[];
  total: number;
  offset: number;
  count: number;
  limit: number;
  desc: boolean;
}
