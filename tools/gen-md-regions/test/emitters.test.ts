import { describe, expect, it } from 'vitest';
import { emitters } from '../src/emitters/index.js';

describe('emitters', () => {
  it('apify-input-schema produces a GFM table including startUrls', () => {
    const out = emitters['apify-input-schema']?.();
    expect(out).toBeDefined();
    expect(out).toContain('| Field | Type | Default | Description |');
    expect(out).toContain('| `startUrls` |');
    expect(out).toContain('_required_');
  });

  it('cli-flags lists Commander flags including --max-pages', () => {
    const out = emitters['cli-flags']?.();
    expect(out).toBeDefined();
    expect(out).toContain('| Option | Description |');
    expect(out).toContain('`--max-pages`');
    expect(out).toContain('`--config`');
  });

  it('input-type renders a TS interface block', () => {
    const out = emitters['input-type']?.();
    expect(out).toBeDefined();
    expect(out).toContain('```ts');
    expect(out).toContain('interface ContextractorInputType {');
    expect(out).toContain('startUrls: Array<{ url: string }>');
  });

  it('enum-values lists enum fields with their titles', () => {
    const out = emitters['enum-values']?.();
    expect(out).toBeDefined();
    expect(out).toContain('### `launcher`');
    expect(out).toContain('| `CHROMIUM` | Chromium |');
    expect(out).toContain('### `waitUntil`');
    expect(out).toContain('### `proxyRotation`');
  });

  it('emitters are deterministic — calling each twice yields the same output', () => {
    for (const [name, emit] of Object.entries(emitters)) {
      const a = emit();
      const b = emit();
      expect(a, `emitter "${name}" must be deterministic`).toBe(b);
    }
  });
});
