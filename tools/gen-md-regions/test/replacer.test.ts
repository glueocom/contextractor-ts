import { describe, expect, it } from 'vitest';
import { DISCLAIMER, RegionError, rewriteRegions } from '../src/replacer.js';

const emitters = {
  alpha: () => '| col |\n|-----|\n| A   |',
  beta: () => 'BETA-BODY',
};

describe('rewriteRegions', () => {
  it('replaces a single region body in place', () => {
    const input = [
      '# Title',
      '',
      'Prose before.',
      '',
      '<!-- @generated:start name="alpha" -->',
      'old content here',
      '<!-- @generated:end name="alpha" -->',
      '',
      'Prose after.',
      '',
    ].join('\n');

    const out = rewriteRegions(input, { emitters });
    expect(out).toContain('| col |');
    expect(out).not.toContain('old content here');
    expect(out).toContain(DISCLAIMER);
    expect(out).toContain('Prose before.');
    expect(out).toContain('Prose after.');
  });

  it('is idempotent: running twice produces the same output', () => {
    const input = [
      '<!-- @generated:start name="alpha" -->',
      '<!-- @generated:end name="alpha" -->',
    ].join('\n');
    const once = rewriteRegions(input, { emitters });
    const twice = rewriteRegions(once, { emitters });
    expect(twice).toBe(once);
  });

  it('replaces multiple non-overlapping regions independently', () => {
    const input = [
      '<!-- @generated:start name="alpha" -->',
      'old A',
      '<!-- @generated:end name="alpha" -->',
      'middle',
      '<!-- @generated:start name="beta" -->',
      'old B',
      '<!-- @generated:end name="beta" -->',
    ].join('\n');
    const out = rewriteRegions(input, { emitters });
    expect(out).toContain('| col |');
    expect(out).toContain('BETA-BODY');
    expect(out).not.toContain('old A');
    expect(out).not.toContain('old B');
    expect(out).toContain('middle');
  });

  it('throws on mismatched marker counts', () => {
    const input = ['<!-- @generated:start name="alpha" -->', 'no end here'].join('\n');
    expect(() => rewriteRegions(input, { emitters })).toThrow(RegionError);
  });

  it('throws on name mismatch between start and end', () => {
    const input = [
      '<!-- @generated:start name="alpha" -->',
      'body',
      '<!-- @generated:end name="beta" -->',
    ].join('\n');
    expect(() => rewriteRegions(input, { emitters })).toThrow(/marker name mismatch/);
  });

  it('throws on unknown region names', () => {
    const input = [
      '<!-- @generated:start name="ghost" -->',
      'body',
      '<!-- @generated:end name="ghost" -->',
    ].join('\n');
    expect(() => rewriteRegions(input, { emitters })).toThrow(/unknown region name/);
  });

  it('throws on nested regions', () => {
    const input = [
      '<!-- @generated:start name="alpha" -->',
      '<!-- @generated:start name="beta" -->',
      'inner',
      '<!-- @generated:end name="beta" -->',
      '<!-- @generated:end name="alpha" -->',
    ].join('\n');
    expect(() => rewriteRegions(input, { emitters })).toThrow(/nested|overlapping/);
  });

  it('preserves the markers verbatim around the new body', () => {
    const input = [
      '<!-- @generated:start name="alpha" -->',
      '<!-- @generated:end name="alpha" -->',
    ].join('\n');
    const out = rewriteRegions(input, { emitters });
    expect(out).toMatch(/<!-- @generated:start name="alpha" -->/);
    expect(out).toMatch(/<!-- @generated:end name="alpha" -->/);
  });
});
