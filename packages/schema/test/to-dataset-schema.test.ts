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

  it('nests crawl provenance + metadata; no top-level loadedUrl/loadedAt/httpStatus/lang', () => {
    const ds = onDisk('dataset_schema.json');
    expect(ds.fields.metadata.properties.title.type).toBe('string');
    expect(ds.fields.metadata.properties.languageCode.type).toBe('string');
    expect(ds.fields.crawl.properties.loadedUrl.type).toBe('string');
    expect(ds.fields.crawl.properties.loadedTime.type).toBe('string');
    expect(ds.fields.crawl.properties.httpStatusCode.type).toBe('integer');
    expect(ds.fields.crawl.properties.depth.type).toBe('integer');
    expect(ds.fields.crawl.properties.referrerUrl.type).toBe('string');
    for (const f of ['loadedUrl', 'loadedAt', 'httpStatus']) {
      expect(f in ds.fields).toBe(false);
    }
    expect('lang' in ds.fields.metadata.properties).toBe(false);
  });

  it('represents each content field as a ContentNode object (no top-level *Hash)', () => {
    const ds = onDisk('dataset_schema.json');
    for (const f of ['txt', 'markdown', 'json', 'html', 'original']) {
      expect(ds.fields[f].type).toBe('object');
      expect(ds.fields[f].properties.hash.type).toBe('string');
      expect(ds.fields[f].properties.bytes.type).toBe('integer');
      expect(ds.fields[f].properties.content.type).toBe('string');
      expect(ds.fields[f].properties.key.type).toBe('string');
      expect(ds.fields[f].properties.url.type).toBe('string');
    }
    for (const h of ['txtHash', 'markdownHash', 'jsonHash', 'htmlHash', 'originalHash']) {
      expect(h in ds.fields).toBe(false);
    }
  });

  it('enumerates failed and skipped fields', () => {
    const ds = onDisk('dataset_schema.json');
    expect(ds.fields.errors.type).toBe('array');
    expect(ds.fields.retryCount.type).toBe('integer');
    expect(ds.fields.crawledTime.type).toBe('string');
    expect(ds.fields.skipReason.type).toBe('string');
  });

  it('preserves the overview view (dot-notation crawl/metadata paths)', () => {
    const ds = onDisk('dataset_schema.json');
    expect(ds.views.overview.transformation.fields).toEqual([
      'crawl.loadedUrl',
      'crawl.httpStatusCode',
      'metadata.title',
      'metadata.languageCode',
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
