import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type ExtractionResult, fileSink, type Sink, urlToFilename } from '@contextractor/crawler';
import { computeContentInfo } from '@contextractor/extraction';
import type { Dataset, KeyValueStore } from 'crawlee';
import type { SaveFormat } from './config.js';

const KVS_FORMAT_INFO: Readonly<Record<string, { ext: string; contentType: string }>> = {
  txt: { ext: 'txt', contentType: 'text/plain; charset=utf-8' },
  markdown: { ext: 'md', contentType: 'text/markdown; charset=utf-8' },
  json: { ext: 'json', contentType: 'application/json; charset=utf-8' },
  html: { ext: 'html', contentType: 'text/html; charset=utf-8' },
  original: { ext: 'html', contentType: 'text/html; charset=utf-8' },
};

export function createCrawleeStorageSink(opts: {
  destinations: string[];
  kvs: KeyValueStore;
  dataset: Dataset;
  formats: SaveFormat[];
}): Sink<ExtractionResult> {
  const { destinations, kvs, dataset, formats } = opts;
  const toKvs = destinations.includes('key-value-store');
  const toDataset = destinations.includes('dataset');

  return async (result) => {
    const slug = urlToFilename(result.url);

    if (toKvs) {
      for (const fmt of formats) {
        const content = fmt === 'original' ? result.html : result.formats[fmt];
        if (!content) continue;
        const info = KVS_FORMAT_INFO[fmt];
        if (!info) continue;
        const key = fmt === 'original' ? `${slug}-original.html` : `${slug}.${info.ext}`;
        try {
          await kvs.setValue(key, content, { contentType: info.contentType });
        } catch (err) {
          process.stderr.write(
            `[storage] Warning: KVS write failed for ${key}: ${err instanceof Error ? err.message : String(err)}\n`,
          );
        }
      }
    }

    if (toDataset) {
      const record: Record<string, unknown> = {
        url: result.url,
        status: 'success',
        ...result.metadata,
        originalHash: result.rawHtmlHash,
        crawl: { depth: result.crawlDepth, referrerUrl: result.referrerUrl },
      };
      for (const fmt of formats) {
        const content = fmt === 'original' ? result.html : result.formats[fmt];
        if (content !== undefined) {
          record[fmt] = content;
          if (fmt !== 'original') record[`${fmt}Hash`] = computeContentInfo(content).hash;
        }
      }
      try {
        await dataset.pushData(record);
      } catch (err) {
        process.stderr.write(
          `[storage] Warning: Dataset push failed for ${result.url}: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }
    }
  };
}

export function createCliSink(opts: {
  outDir: string;
  formats: SaveFormat[];
}): Sink<ExtractionResult> {
  const { outDir, formats } = opts;
  const sinks: Array<Sink<ExtractionResult>> = [];

  const fileFormats = formats.filter(
    (format): format is Exclude<SaveFormat, 'original'> => format !== 'original',
  );
  if (fileFormats.length > 0) {
    sinks.push(fileSink({ outDir, formats: fileFormats }));
  }

  if (formats.includes('original')) {
    sinks.push(originalSink(outDir));
  }

  return async (result) => {
    for (const sink of sinks) {
      await sink(result);
    }
  };
}

function originalSink(outDir: string): Sink<ExtractionResult> {
  return async (result) => {
    const resolvedOutDir = path.resolve(outDir);
    await mkdir(resolvedOutDir, { recursive: true });
    const slug = urlToFilename(result.url);
    await writeFile(path.join(resolvedOutDir, `${slug}-raw.html`), result.html, 'utf8');
  };
}
