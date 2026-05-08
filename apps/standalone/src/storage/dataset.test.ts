import { existsSync, realpathSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Dataset } from './dataset.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = realpathSync(await mkdtemp(path.join(tmpdir(), 'ctx-ds-test-')));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('Dataset', () => {
  it('pushData creates 000000000.json and sets itemCount: 1 in __metadata__.json', async () => {
    const ds = new Dataset(tmpDir, 'default');
    await ds.pushData({ url: 'https://example.com', title: 'Example' });

    const itemFile = path.join(tmpDir, 'datasets', 'default', '000000000.json');
    expect(existsSync(itemFile)).toBe(true);

    const metaFile = path.join(tmpDir, 'datasets', 'default', '__metadata__.json');
    const meta = JSON.parse(await readFile(metaFile, 'utf8')) as { itemCount: number };
    expect(meta.itemCount).toBe(1);
  });

  it('pushData called twice sequentially creates 000000000.json and 000000001.json', async () => {
    const ds = new Dataset(tmpDir, 'default');
    await ds.pushData({ a: 1 });
    await ds.pushData({ a: 2 });

    const dsDir = path.join(tmpDir, 'datasets', 'default');
    expect(existsSync(path.join(dsDir, '000000000.json'))).toBe(true);
    expect(existsSync(path.join(dsDir, '000000001.json'))).toBe(true);
  });

  it('getItems returns the first two items in insertion order', async () => {
    const ds = new Dataset(tmpDir, 'default');
    await ds.pushData({ n: 0 });
    await ds.pushData({ n: 1 });
    await ds.pushData({ n: 2 });

    const result = await ds.getItems({ offset: 0, limit: 2 });
    expect(result.items).toEqual([{ n: 0 }, { n: 1 }]);
    expect(result.total).toBe(3);
    expect(result.count).toBe(2);
  });

  it('getItems with desc: true returns items in reverse insertion order', async () => {
    const ds = new Dataset(tmpDir, 'default');
    await ds.pushData({ n: 0 });
    await ds.pushData({ n: 1 });
    await ds.pushData({ n: 2 });

    const result = await ds.getItems({ desc: true });
    expect(result.items).toEqual([{ n: 2 }, { n: 1 }, { n: 0 }]);
  });

  it('two parallel pushData calls from separate Dataset instances both persist records', async () => {
    const ds1 = new Dataset(tmpDir, 'default');
    const ds2 = new Dataset(tmpDir, 'default');

    await Promise.all([ds1.pushData({ from: 1 }), ds2.pushData({ from: 2 })]);

    const result = await ds1.getItems();
    expect(result.total).toBe(2);
    const froms = result.items.map((i) => (i as { from: number }).from).sort();
    expect(froms).toEqual([1, 2]);
  });

  it('drop removes the dataset directory; subsequent getItems returns empty array', async () => {
    const ds = new Dataset(tmpDir, 'default');
    await ds.pushData({ x: 1 });
    await ds.drop();

    const result = await ds.getItems();
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});
