import { describe, expect, it } from 'vitest';
import { ContextractorInput, type ContextractorInputType } from './input.js';

const BASE = { startUrls: [{ url: 'https://example.com' }] };

describe('ContextractorInput — save field', () => {
  it('defaults to ["markdown"]', () => {
    const result = ContextractorInput.parse(BASE);
    expect(result.save).toEqual(['markdown']);
  });

  it('accepts all five enum values', () => {
    const result = ContextractorInput.parse({
      ...BASE,
      save: ['txt', 'markdown', 'json', 'html', 'original'],
    });
    expect(result.save).toEqual(['txt', 'markdown', 'json', 'html', 'original']);
  });

  it('rejects unknown string values', () => {
    expect(() => ContextractorInput.parse({ ...BASE, save: ['unknown-format'] })).toThrow();
  });
});

describe('ContextractorInput — saveDestination field', () => {
  it('defaults to ["key-value-store"]', () => {
    const result = ContextractorInput.parse(BASE);
    expect(result.saveDestination).toEqual(['key-value-store']);
  });

  it('accepts "key-value-store" and "dataset"', () => {
    const result = ContextractorInput.parse({
      ...BASE,
      saveDestination: ['key-value-store', 'dataset'],
    });
    expect(result.saveDestination).toEqual(['key-value-store', 'dataset']);
  });

  it('rejects unknown strings', () => {
    expect(() => ContextractorInput.parse({ ...BASE, saveDestination: ['s3'] })).toThrow();
  });
});

describe('ContextractorInput — removed boolean fields', () => {
  it('does not have saveRawHtmlToKeyValueStore on the inferred type', () => {
    const result = ContextractorInput.parse(BASE);
    // TypeScript would fail at compile time; this confirms runtime absence too
    expect('saveRawHtmlToKeyValueStore' in result).toBe(false);
  });

  it('does not have saveExtractedTextToKeyValueStore', () => {
    const result = ContextractorInput.parse(BASE);
    expect('saveExtractedTextToKeyValueStore' in result).toBe(false);
  });

  it('does not have saveExtractedJsonToKeyValueStore', () => {
    const result = ContextractorInput.parse(BASE);
    expect('saveExtractedJsonToKeyValueStore' in result).toBe(false);
  });

  it('does not have saveExtractedMarkdownToKeyValueStore', () => {
    const result = ContextractorInput.parse(BASE);
    expect('saveExtractedMarkdownToKeyValueStore' in result).toBe(false);
  });

  it('does not have saveExtractedHtmlToKeyValueStore', () => {
    const result = ContextractorInput.parse(BASE);
    expect('saveExtractedHtmlToKeyValueStore' in result).toBe(false);
  });

  it('type-level check: the inferred type lacks all five removed fields', () => {
    // This is a compile-time assertion: if any of these keys existed on
    // ContextractorInputType the lines below would produce a TypeScript error.
    type NoRemovedFields = 'saveRawHtmlToKeyValueStore' extends keyof ContextractorInputType
      ? never
      : 'saveExtractedTextToKeyValueStore' extends keyof ContextractorInputType
        ? never
        : 'saveExtractedJsonToKeyValueStore' extends keyof ContextractorInputType
          ? never
          : 'saveExtractedMarkdownToKeyValueStore' extends keyof ContextractorInputType
            ? never
            : 'saveExtractedHtmlToKeyValueStore' extends keyof ContextractorInputType
              ? never
              : 'ok';
    const check: NoRemovedFields = 'ok';
    expect(check).toBe('ok');
  });
});
