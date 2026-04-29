import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { OutputFormat } from '@contextractor/extraction';
import type { ExtractionResult, Sink } from './types.js';

export const FORMAT_EXTENSIONS: Readonly<Record<OutputFormat, string>> = Object.freeze({
  txt: '.txt',
  markdown: '.md',
  json: '.json',
  html: '.html',
});

export function urlToFilename(url: string): string {
  let slug = url.replace(/^https?:\/\//, '');
  slug = slug.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (slug.length > 100) {
    const hash = createHash('md5').update(url).digest('hex').slice(0, 8);
    slug = `${slug.slice(0, 100)}-${hash}`;
  }
  return slug;
}

export function fileSink(opts: {
  outDir: string;
  formats?: OutputFormat[];
}): Sink<ExtractionResult> {
  const { outDir, formats } = opts;

  return async (result: ExtractionResult): Promise<void> => {
    await mkdir(path.resolve(outDir), { recursive: true });
    const slug = urlToFilename(result.url);

    const fmts = formats ?? (Object.keys(result.formats) as OutputFormat[]);
    for (const fmt of fmts) {
      const content = result.formats[fmt];
      if (!content) continue;
      const ext = FORMAT_EXTENSIONS[fmt];
      const out =
        fmt === 'json' || fmt === 'html'
          ? content
          : prependMetadataHeader(content, result.metadata, result.url);
      await writeFile(path.join(path.resolve(outDir), `${slug}${ext}`), out, 'utf8');
    }
  };
}

function prependMetadataHeader(
  content: string,
  metadata: ExtractionResult['metadata'],
  url: string,
): string {
  const lines: string[] = [];
  if (metadata.title || metadata.author || metadata.publishedAt) {
    if (metadata.title) lines.push(`Title: ${metadata.title}`);
    if (metadata.author) lines.push(`Author: ${metadata.author}`);
    if (metadata.publishedAt) lines.push(`Date: ${metadata.publishedAt}`);
    lines.push(`URL: ${url}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  lines.push(content);
  return lines.join('\n');
}
