import type { Sink } from './types.js';

export interface MemorySink<T> extends Sink<T> {
  results: T[];
}

export function memorySink<T>(): MemorySink<T> {
  const results: T[] = [];
  const sink = async (result: T): Promise<void> => {
    results.push(result);
  };
  (sink as MemorySink<T>).results = results;
  return sink as MemorySink<T>;
}
