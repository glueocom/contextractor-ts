import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Configuration, Dataset } from 'crawlee';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

function makeTmpDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'contextractor-dataset-test-'));
}

describe('Dataset (Crawlee storage)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    Configuration.getGlobalConfig().set('storageClientOptions', { localDataDirectory: tmpDir });
    Configuration.getGlobalConfig().set('purgeOnStart', false);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('pushData persists an item; getData returns it with total:1', async () => {
    const ds = await Dataset.open(`test-${Date.now()}`);
    await ds.pushData({ value: 'hello' });
    const result = await ds.getData();
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ value: 'hello' });
    await ds.drop();
  });

  it('two sequential pushData calls; getData returns them in insertion order', async () => {
    const ds = await Dataset.open(`test-${Date.now()}`);
    await ds.pushData({ n: 1 });
    await ds.pushData({ n: 2 });
    const result = await ds.getData();
    expect(result.total).toBe(2);
    expect((result.items[0] as { n: number }).n).toBe(1);
    expect((result.items[1] as { n: number }).n).toBe(2);
    await ds.drop();
  });

  it('getData with offset and limit returns the requested slice', async () => {
    const ds = await Dataset.open(`test-${Date.now()}`);
    await ds.pushData([{ n: 0 }, { n: 1 }, { n: 2 }, { n: 3 }]);
    const result = await ds.getData({ offset: 1, limit: 2 });
    expect(result.items).toHaveLength(2);
    expect((result.items[0] as { n: number }).n).toBe(1);
    expect((result.items[1] as { n: number }).n).toBe(2);
    await ds.drop();
  });

  it('getData with desc:true returns items in reverse insertion order', async () => {
    const ds = await Dataset.open(`test-${Date.now()}`);
    await ds.pushData([{ n: 0 }, { n: 1 }, { n: 2 }]);
    const result = await ds.getData({ desc: true });
    expect((result.items[0] as { n: number }).n).toBe(2);
    expect((result.items[2] as { n: number }).n).toBe(0);
    await ds.drop();
  });

  it('drop removes the dataset; subsequent getData returns empty', async () => {
    const name = `test-${Date.now()}`;
    const ds = await Dataset.open(name);
    await ds.pushData({ foo: 'bar' });
    await ds.drop();
    const fresh = await Dataset.open(name);
    const result = await fresh.getData();
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    await fresh.drop();
  });

  it('purgeOnStart:false preserves data across Dataset.open calls', async () => {
    Configuration.getGlobalConfig().set('purgeOnStart', false);
    const name = `test-${Date.now()}`;
    const ds1 = await Dataset.open(name);
    await ds1.pushData({ persisted: true });
    const ds2 = await Dataset.open(name);
    const result = await ds2.getData();
    expect(result.items).toHaveLength(1);
    await ds2.drop();
  });
});
