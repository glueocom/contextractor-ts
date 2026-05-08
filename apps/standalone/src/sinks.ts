import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type ExtractionResult, fileSink, type Sink, urlToFilename } from '@contextractor/crawler';
import type { SaveFormat } from './config.js';
import type { Dataset } from './storage/dataset.js';

export function createCliSink(opts: {
  outDir: string;
  formats: SaveFormat[];
  dataset?: Dataset;
  noStdout?: boolean;
  ndjson?: boolean;
}): Sink<ExtractionResult> {
  const { outDir, formats, dataset, noStdout, ndjson } = opts;
  const sinks: Array<Sink<ExtractionResult>> = [];

  const fileFormats = formats.filter(
    (format): format is Exclude<SaveFormat, 'jsonl' | 'original'> =>
      format !== 'jsonl' && format !== 'original',
  );
  if (fileFormats.length > 0) {
    sinks.push(fileSink({ outDir, formats: fileFormats }));
  }

  if (formats.includes('jsonl')) {
    sinks.push(jsonlSink(outDir));
  }

  if (formats.includes('original')) {
    sinks.push(originalSink(outDir));
  }

  return async (result) => {
    // Write to all file-based sinks.
    const errors: Error[] = [];
    for (const sink of sinks) {
      await sink(result);
    }

    // Build the dataset record.
    const record: Record<string, unknown> = {
      url: result.url,
      title: result.metadata.title ?? null,
      author: result.metadata.author ?? null,
      date: result.metadata.publishedAt ?? null,
    };
    for (const [fmt, content] of Object.entries(result.formats)) {
      record[fmt] = content;
    }

    // Write to dataset storage (non-fatal: log warning and continue on error).
    if (dataset) {
      try {
        await dataset.pushData(record);
      } catch (err) {
        console.error(
          '[WARN] Failed to write to storage dataset:',
          err instanceof Error ? err.message : String(err),
        );
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }

    // Echo to stdout unless suppressed.
    if (!noStdout) {
      if (ndjson) {
        process.stdout.write(`${JSON.stringify(record)}\n`);
      } else {
        process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
      }
    }

    // Non-fatal: partial failure logged but not rethrown.
    if (errors.length > 0) {
      // Already logged above.
    }
  };
}

function jsonlSink(outDir: string): Sink<ExtractionResult> {
  const outputPath = path.join(path.resolve(outDir), 'output.jsonl');

  return async (result) => {
    await mkdir(path.dirname(outputPath), { recursive: true });

    const content = result.formats.markdown ?? result.formats.txt;
    if (!content) return;

    const entry = {
      url: result.url,
      title: result.metadata.title ?? '',
      author: result.metadata.author ?? '',
      date: result.metadata.publishedAt ?? '',
      content,
    };

    await appendFile(outputPath, `${JSON.stringify(entry)}\n`, 'utf8');
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
