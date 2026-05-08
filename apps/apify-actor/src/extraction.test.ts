import { describe, expect, it } from 'vitest';
import type { KvsLike } from './extraction.js';
import { saveContentToKvs } from './extraction.js';

function makeKvs(): KvsLike & {
  calls: Array<{ key: string; value: string; contentType?: string }>;
} {
  const calls: Array<{ key: string; value: string; contentType?: string }> = [];
  return {
    calls,
    async setValue(key, value, options) {
      calls.push({ key, value, contentType: options?.contentType });
    },
  };
}

describe('saveContentToKvs', () => {
  it('calls kvs.setValue with the correct key and contentType', async () => {
    const kvs = makeKvs();
    await saveContentToKvs(kvs, 'abc123.txt', 'Hello world', 'text/plain; charset=utf-8');

    expect(kvs.calls).toHaveLength(1);
    expect(kvs.calls[0]?.key).toBe('abc123.txt');
    expect(kvs.calls[0]?.value).toBe('Hello world');
    expect(kvs.calls[0]?.contentType).toBe('text/plain; charset=utf-8');
  });

  it('returns a ContentInfo with hash, length, and key', async () => {
    const kvs = makeKvs();
    const info = await saveContentToKvs(kvs, 'mykey.md', 'hello', 'text/markdown');

    expect(info.key).toBe('mykey.md');
    expect(typeof info.hash).toBe('string');
    expect(info.hash.length).toBe(32); // MD5 hex
    expect(info.length).toBe(5); // 'hello' is 5 bytes UTF-8
  });

  it('hash is stable and matches computeContentInfo output', async () => {
    const kvs = makeKvs();
    // MD5 of 'hello' = 5d41402abc4b2a76b9719d911017c592
    const info = await saveContentToKvs(kvs, 'k', 'hello', 'text/plain');
    expect(info.hash).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('includes url field when kvs.getPublicUrl is defined', async () => {
    const kvs: KvsLike = {
      async setValue() {},
      async getPublicUrl(key) {
        return `https://cdn.example.com/${key}`;
      },
    };

    const info = await saveContentToKvs(kvs, 'file.json', '{}', 'application/json');
    expect(info.url).toBe('https://cdn.example.com/file.json');
  });

  it('does not include url field when kvs.getPublicUrl is absent', async () => {
    const kvs = makeKvs();
    const info = await saveContentToKvs(kvs, 'file.txt', 'content', 'text/plain');
    expect(info.url).toBeUndefined();
  });
});
