import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type ExtractionResult, fileSink, type Sink, urlToFilename } from '@contextractor/crawler';
import type { SaveFormat } from './config.js';

export function createCliSink(opts: {
  outDir: string;
  formats: SaveFormat[];
}): Sink<ExtractionResult> {
  const { outDir, formats } = opts;
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
    for (const sink of sinks) {
      await sink(result);
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
