export { Configuration, Dataset, KeyValueStore } from 'crawlee';
export { buildProgram, isMainEntry, runCli } from './cliProgram.js';
export { program } from './cli.js';

/** Mirrors the `DatasetContent<Data>` type from `@crawlee/core`. */
export interface DatasetContent<Data = Record<string, unknown>> {
  items: Data[];
  total: number;
  offset: number;
  count: number;
  limit: number;
  desc: boolean;
}
