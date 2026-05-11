import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Configuration, KeyValueStore } from 'crawlee';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

function makeTmpDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'contextractor-kvs-test-'));
}

describe('KeyValueStore (Crawlee storage)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    Configuration.getGlobalConfig().set('storageClientOptions', { localDataDirectory: tmpDir });
    Configuration.getGlobalConfig().set('purgeOnStart', false);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('setValue with Buffer persists; getValue returns the same bytes', async () => {
    const kvs = await KeyValueStore.open(`test-${Date.now()}`);
    const buf = Buffer.from('hello world');
    await kvs.setValue('my-key', buf, { contentType: 'image/png' });
    const retrieved = await kvs.getValue('my-key');
    expect(Buffer.isBuffer(retrieved) ? retrieved.toString() : String(retrieved)).toBe(
      'hello world',
    );
    await kvs.drop();
  });

  it('setValue with JSON object persists; getValue returns the same object', async () => {
    const kvs = await KeyValueStore.open(`test-${Date.now()}`);
    await kvs.setValue('my-key', { json: true });
    const retrieved = await kvs.getValue('my-key');
    expect(retrieved).toMatchObject({ json: true });
    await kvs.drop();
  });

  it('setValue with null removes the key; subsequent getValue returns null', async () => {
    const kvs = await KeyValueStore.open(`test-${Date.now()}`);
    await kvs.setValue('my-key', { value: 42 });
    await kvs.setValue('my-key', null);
    const retrieved = await kvs.getValue('my-key');
    expect(retrieved).toBeNull();
    await kvs.drop();
  });

  it('forEachKey iterates all stored keys', async () => {
    const kvs = await KeyValueStore.open(`test-${Date.now()}`);
    await kvs.setValue('alpha', 'a');
    await kvs.setValue('beta', 'b');
    await kvs.setValue('gamma', 'c');
    const keys: string[] = [];
    await kvs.forEachKey((key) => {
      keys.push(key);
    });
    expect(keys.sort()).toEqual(['alpha', 'beta', 'gamma'].sort());
    await kvs.drop();
  });
});
