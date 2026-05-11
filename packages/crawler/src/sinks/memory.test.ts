import { describe, expect, it } from 'vitest';
import { memorySink } from './memory.js';

describe('memorySink', () => {
  it('accumulates results in order', async () => {
    const sink = memorySink<{ n: number }>();
    await sink({ n: 1 });
    await sink({ n: 2 });
    expect(sink.results).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('starts empty', () => {
    const sink = memorySink();
    expect(sink.results).toHaveLength(0);
  });

  it('each instance has its own results array', async () => {
    const a = memorySink<number>();
    const b = memorySink<number>();
    await a(1);
    expect(b.results).toHaveLength(0);
  });
});
