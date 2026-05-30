import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ContextractorOutput,
  toDatasetSchema,
  toKeyValueStoreSchema,
  toOutputSchema,
  writeDatasetSchema,
} from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const actorDir = resolve(repoRoot, 'apps/apify-actor/.actor');

const onDisk = (name: string) => JSON.parse(readFileSync(resolve(actorDir, name), 'utf8'));

describe('toDatasetSchema', () => {
  it('matches the on-disk dataset_schema.json snapshot', () => {
    expect(toDatasetSchema(ContextractorOutput)).toEqual(onDisk('dataset_schema.json'));
  });

  it('merges all three status values into an enum', () => {
    const ds = onDisk('dataset_schema.json');
    expect(ds.fields.status.enum).toEqual(['success', 'failed', 'skipped']);
  });

  it('collapses nullable metadata/crawl fields and nests their properties', () => {
    const ds = onDisk('dataset_schema.json');
    expect(ds.fields.metadata.properties.title.type).toBe('string');
    expect(ds.fields.metadata.properties.lang.type).toBe('string');
    expect(ds.fields.crawl.properties.depth.type).toBe('integer');
    expect(ds.fields.crawl.properties.referrerUrl.type).toBe('string');
  });

  it('represents the content union as the richer ContentRef object', () => {
    const ds = onDisk('dataset_schema.json');
    expect(ds.fields.txt.properties.hash.type).toBe('string');
    expect(ds.fields.txt.properties.key.type).toBe('string');
    expect(ds.fields.txt.properties.url.type).toBe('string');
  });

  it('enumerates failed and skipped fields', () => {
    const ds = onDisk('dataset_schema.json');
    expect(ds.fields.errorMessages.type).toBe('array');
    expect(ds.fields.retryCount.type).toBe('integer');
    expect(ds.fields.crawledAt.type).toBe('string');
    expect(ds.fields.skipReason.type).toBe('string');
  });

  it('preserves the overview view unchanged', () => {
    const ds = onDisk('dataset_schema.json');
    expect(ds.views.overview.transformation.fields).toEqual([
      'loadedUrl',
      'httpStatus',
      'metadata.title',
      'metadata.lang',
    ]);
  });

  it('is deterministic across calls', () => {
    expect(JSON.stringify(toDatasetSchema(ContextractorOutput))).toBe(
      JSON.stringify(toDatasetSchema(ContextractorOutput)),
    );
  });

  it('writeDatasetSchema writes a single trailing newline', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'ds-')), 'dataset_schema.json');
    writeDatasetSchema(ContextractorOutput, out);
    const text = readFileSync(out, 'utf8');
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });
});

describe('toOutputSchema / toKeyValueStoreSchema', () => {
  it('matches the on-disk output_schema.json', () => {
    expect(toOutputSchema()).toEqual(onDisk('output_schema.json'));
  });

  it('matches the on-disk key_value_store_schema.json', () => {
    expect(toKeyValueStoreSchema()).toEqual(onDisk('key_value_store_schema.json'));
  });
});
