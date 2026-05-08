import { describe, expect, it } from 'vitest';
import { memorySink } from './memory.js';

describe('memorySink', () => {
  it('starts with an empty results array', () => {
    const sink = memorySink<string>();
    expect(sink.results).toEqual([]);
  });

  it('accumulates items pushed through the sink function', async () => {
    const sink = memorySink<number>();
    await sink(1);
    await sink(2);
    await sink(3);
    expect(sink.results).toEqual([1, 2, 3]);
  });

  it('two separate sinks do not share state', async () => {
    const a = memorySink<string>();
    const b = memorySink<string>();
    await a('alpha');
    await b('beta');
    expect(a.results).toEqual(['alpha']);
    expect(b.results).toEqual(['beta']);
  });

  it('accumulates object results', async () => {
    const sink = memorySink<{ url: string }>();
    await sink({ url: 'https://a.com' });
    await sink({ url: 'https://b.com' });
    expect(sink.results).toHaveLength(2);
    expect(sink.results[0]).toEqual({ url: 'https://a.com' });
  });
});
