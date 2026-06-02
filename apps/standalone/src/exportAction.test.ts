import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Configuration, Dataset, KeyValueStore } from 'crawlee';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runExportAction } from './exportAction.js';

function makeTmpDir(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('runExportAction', () => {
  let storageDir: string;
  let outputDir: string;

  beforeEach(() => {
    storageDir = makeTmpDir('contextractor-export-store-');
    outputDir = makeTmpDir('contextractor-export-out-');
    Configuration.getGlobalConfig().set('storageClientOptions', {
      localDataDirectory: storageDir,
    });
    Configuration.getGlobalConfig().set('purgeOnStart', false);
  });

  afterEach(() => {
    rmSync(storageDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  });

  it('writes inline content, fetches KVS blobs, derives names, handles collisions and the manifest', async () => {
    const ds = await Dataset.open('default');
    const kvs = await KeyValueStore.open('default');

    // Inline-content record (dataset destination).
    await ds.pushData({
      url: 'https://example.com/a',
      status: 'success',
      metadata: { title: 'Alpha Page' },
      markdown: { hash: 'h1', bytes: 7, content: '# Alpha' },
    });

    // KVS-blob record (default destination): json + html + original collide on .html.
    // `markdown` (`.md` vs `text/markdown` → `.markdown`) exercises the local
    // disk-read fallback, since Crawlee's `getValue` cannot round-trip that key.
    await kvs.setValue('markdown-bbb.md', '# Beta MD', { contentType: 'text/markdown' });
    await kvs.setValue('html-bbb.html', '<p>beta</p>', { contentType: 'text/html' });
    await kvs.setValue('original-bbb.html', '<html>raw</html>', { contentType: 'text/html' });
    await kvs.setValue('json-bbb.json', { parsed: true });
    await ds.pushData({
      url: 'https://example.com/b',
      status: 'success',
      metadata: { title: 'Beta' },
      markdown: { hash: 'h1b', bytes: 9, key: 'markdown-bbb.md' },
      json: { hash: 'h2', bytes: 2, key: 'json-bbb.json' },
      html: { hash: 'h3', bytes: 3, key: 'html-bbb.html' },
      original: { hash: 'h4', bytes: 4, key: 'original-bbb.html' },
    });

    // Failed record — no files, manifest only.
    await ds.pushData({
      url: 'https://example.com/c',
      status: 'failed',
      errors: ['boom'],
    });

    const result = await runExportAction({ outputDir, storageDir });

    expect(result.recordsTotal).toBe(3);
    expect(result.filesWritten).toBe(5);

    expect(readFileSync(path.join(outputDir, 'alpha-page.md'), 'utf8')).toBe('# Alpha');
    // markdown KVS blob read via the local disk fallback
    expect(readFileSync(path.join(outputDir, 'beta.md'), 'utf8')).toBe('# Beta MD');
    expect(readFileSync(path.join(outputDir, 'beta.html'), 'utf8')).toBe('<p>beta</p>');
    // original collides with html on `.html` → tagged with its kind.
    expect(readFileSync(path.join(outputDir, 'beta.original.html'), 'utf8')).toBe(
      '<html>raw</html>',
    );
    // JSON blobs come back parsed and must be re-serialized.
    expect(readFileSync(path.join(outputDir, 'beta.json'), 'utf8')).toBe(
      JSON.stringify({ parsed: true }, null, 2),
    );

    const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf8'));
    expect(Array.isArray(manifest)).toBe(true);
    expect(manifest).toHaveLength(3);
    expect(manifest.map((r: { url: string }) => r.url)).toContain('https://example.com/c');

    await ds.drop();
    await kvs.drop();
  });

  it('handles an empty dataset: creates the dir and an empty manifest, writes no files', async () => {
    const result = await runExportAction({ outputDir, storageDir, dataset: 'empty-ds' });
    expect(result.recordsTotal).toBe(0);
    expect(result.filesWritten).toBe(0);
    expect(readFileSync(result.manifestPath, 'utf8')).toBe('[]\n');
  });
});
