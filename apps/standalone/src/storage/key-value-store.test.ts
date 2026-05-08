import { realpathSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KeyValueStore } from './key-value-store.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = realpathSync(await mkdtemp(path.join(tmpdir(), 'ctx-kvs-test-')));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('KeyValueStore', () => {
  it('setValue with image/png writes .png file; getValue returns same bytes and contentType', async () => {
    const kvs = new KeyValueStore(tmpDir, 'default');
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    await kvs.setValue('my-key', buf, 'image/png');

    const record = await kvs.getValue('my-key');
    expect(record).not.toBeNull();
    expect(record?.value).toEqual(buf);
    expect(record?.contentType).toBe('image/png');
  });

  it('setValue with application/json writes .json file; getValue returns parsed-equivalent bytes', async () => {
    const kvs = new KeyValueStore(tmpDir, 'default');
    const obj = { json: true };
    await kvs.setValue('my-key', obj, 'application/json');

    const record = await kvs.getValue('my-key');
    if (!record) throw new Error('record should not be null');
    expect(JSON.parse(record.value.toString('utf8'))).toEqual(obj);
    expect(record.contentType).toContain('application/json');
  });

  it('deleteValue removes the file; subsequent getValue returns null', async () => {
    const kvs = new KeyValueStore(tmpDir, 'default');
    await kvs.setValue('my-key', { data: 1 }, 'application/json');
    await kvs.deleteValue('my-key');

    const record = await kvs.getValue('my-key');
    expect(record).toBeNull();
  });

  it('listKeys returns at most limit keys and the correct nextExclusiveStartKey', async () => {
    const kvs = new KeyValueStore(tmpDir, 'default');
    await kvs.setValue('aaa', 'value-a', 'text/plain');
    await kvs.setValue('bbb', 'value-b', 'text/plain');
    await kvs.setValue('ccc', 'value-c', 'text/plain');

    const result = await kvs.listKeys({ limit: 2 });
    expect(result.items.length).toBe(2);
    expect(result.isTruncated).toBe(true);
    expect(result.nextExclusiveStartKey).toBeDefined();
  });
});
