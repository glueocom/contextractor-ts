import { mkdtempSync, readFileSync as readFile, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2019 from 'ajv/dist/2019.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ContextractorInput, toApifyInputSchema, writeApifyInputSchema } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const apifyMetaSchemaPath = resolve(here, 'fixtures/apify-input.schema.json');
const onDiskInputSchemaPath = resolve(repoRoot, 'apps/apify-actor/.actor/input_schema.json');

const apifyMetaSchema = JSON.parse(readFileSync(apifyMetaSchemaPath, 'utf8'));

function makeAjv(): Ajv2019 {
  // The Apify meta-schema relies on draft 2019-09 keywords (`unevaluatedProperties`,
  // top-level `definitions` referenced via `#/definitions/...`). Use the 2019 build
  // so those validate correctly.
  const ajv = new Ajv2019({ strict: false, allErrors: true });
  addFormats.default(ajv);
  return ajv;
}

describe('toApifyInputSchema', () => {
  it('produces output that validates against the Apify meta-schema', () => {
    const out = toApifyInputSchema(ContextractorInput, { title: 'Contextractor' });
    const ajv = makeAjv();
    const validate = ajv.compile(apifyMetaSchema);
    const ok = validate(out);
    if (!ok) {
      console.error(JSON.stringify(validate.errors, null, 2));
    }
    expect(ok).toBe(true);
  });

  it('matches the on-disk INPUT_SCHEMA.json snapshot', () => {
    const out = toApifyInputSchema(ContextractorInput, { title: 'Contextractor' });
    const onDisk = JSON.parse(readFileSync(onDiskInputSchemaPath, 'utf8'));
    expect(out).toEqual(onDisk);
  });

  it('marks startUrls as required with the right editor and prefill', () => {
    const out = toApifyInputSchema(ContextractorInput, { title: 'Contextractor' });
    expect(out.required).toContain('startUrls');
    const startUrls = out.properties.startUrls;
    expect(startUrls?.editor).toBe('requestListSources');
    expect(startUrls?.prefill).toEqual([{ url: 'https://blog.apify.com/what-is-web-scraping/' }]);
  });

  it('emits launcher as a select with the documented enum and default', () => {
    const out = toApifyInputSchema(ContextractorInput, { title: 'Contextractor' });
    const launcher = out.properties.launcher;
    expect(launcher?.editor).toBe('select');
    expect(launcher?.enum).toEqual(['CHROMIUM', 'FIREFOX']);
    expect(launcher?.enumTitles).toEqual(['Chromium', 'Firefox']);
    expect(launcher?.default).toBe('CHROMIUM');
  });

  it('marks initialCookies as secret', () => {
    const out = toApifyInputSchema(ContextractorInput, { title: 'Contextractor' });
    expect(out.properties.initialCookies?.isSecret).toBe(true);
  });

  it('routes proxyConfiguration through the proxy editor and Proxy section', () => {
    const out = toApifyInputSchema(ContextractorInput, { title: 'Contextractor' });
    const proxy = out.properties.proxyConfiguration;
    expect(proxy?.editor).toBe('proxy');
    expect(proxy?.sectionCaption).toBe('Proxy');
  });

  it('routes trafilaturaConfig through the json editor and Content extraction section', () => {
    const out = toApifyInputSchema(ContextractorInput, { title: 'Contextractor' });
    const tc = out.properties.trafilaturaConfig;
    expect(tc?.editor).toBe('json');
    expect(tc?.sectionCaption).toBe('Content extraction');
  });

  it('preserves boolean defaults (closeCookieModals = true)', () => {
    const out = toApifyInputSchema(ContextractorInput, { title: 'Contextractor' });
    expect(out.properties.closeCookieModals?.default).toBe(true);
  });

  it('preserves integer constraints (maxScrollHeightPixels)', () => {
    const out = toApifyInputSchema(ContextractorInput, { title: 'Contextractor' });
    const m = out.properties.maxScrollHeightPixels;
    expect(m?.unit).toBe('pixels');
    expect(m?.minimum).toBe(0);
  });

  it('throws when the root schema uses oneOf/anyOf/allOf', () => {
    const union = z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('a'), x: z.string() }),
      z.object({ kind: z.literal('b'), y: z.string() }),
    ]);
    expect(() => toApifyInputSchema(union as unknown as z.ZodObject)).toThrow();
  });

  it('drops defaulted fields from required (Zod #4134 workaround)', () => {
    const schema = z.object({
      keep: z.string(),
      drop: z.string().default('x'),
    });
    const out = toApifyInputSchema(schema, { title: 'X' });
    expect(out.required).toContain('keep');
    expect(out.required).not.toContain('drop');
  });

  it('produces deterministic byte-identical output across calls', () => {
    const a = toApifyInputSchema(ContextractorInput, { title: 'Contextractor' });
    const b = toApifyInputSchema(ContextractorInput, { title: 'Contextractor' });
    expect(a).toEqual(b);
    expect(JSON.stringify(a, null, 2)).toBe(JSON.stringify(b, null, 2));
  });

  it('writeApifyInputSchema writes a single trailing newline', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apify-schema-'));
    const out = join(dir, 'input_schema.json');
    writeApifyInputSchema(ContextractorInput, out, { title: 'Contextractor' });
    const text = readFile(out, 'utf8');
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  it('omits top-level description when no opts.description is provided', () => {
    const out = toApifyInputSchema(ContextractorInput, { title: 'Contextractor' });
    expect('description' in out).toBe(false);
  });
});
