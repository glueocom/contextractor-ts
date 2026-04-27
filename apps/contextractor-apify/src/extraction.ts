import { createHash } from 'node:crypto';
import type { ContentExtractor, OutputFormat } from '@contextractor/engine';

export interface ContentInfo {
  hash: string;
  length: number;
  key?: string;
  url?: string;
}

export interface KvsLike {
  setValue(key: string, value: string, options?: { contentType?: string }): Promise<void>;
  getPublicUrl?(key: string): string | Promise<string>;
}

const FORMAT_TO_NATIVE: Record<'text' | 'json' | 'markdown' | 'html', OutputFormat> = {
  text: 'txt',
  json: 'json',
  markdown: 'markdown',
  html: 'html',
};

export function extractFormat(
  html: string,
  format: 'text' | 'json' | 'markdown',
  extractor: ContentExtractor,
  url?: string,
): string | null {
  const native = FORMAT_TO_NATIVE[format];
  const result = extractor.extract(html, url ? { url, format: native } : { format: native });
  if (!result?.content) return null;
  return result.content;
}

export interface DatasetMetadata {
  title: string | null;
  author: string | null;
  publishedAt: string | null;
  description: string | null;
  siteName: string | null;
  lang: string | null;
}

export function projectMetadata(
  html: string,
  url: string,
  extractor: ContentExtractor,
): DatasetMetadata {
  const result = extractor.extractMetadata(html, url);
  let lang = result.language;
  if (!lang) {
    const match = html.match(/<html[^>]*\slang=["']([^"']+)["']/i);
    if (match?.[1]) lang = match[1];
  }
  return {
    title: result.title,
    author: result.author,
    publishedAt: result.date,
    description: result.description,
    siteName: result.sitename,
    lang: lang ?? null,
  };
}

export function computeContentInfo(content: string | Buffer): ContentInfo {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  return {
    hash: createHash('md5').update(buf).digest('hex'),
    length: buf.length,
  };
}

export async function saveContentToKvs(
  kvs: KvsLike,
  key: string,
  content: string,
  contentType: string,
): Promise<ContentInfo> {
  await kvs.setValue(key, content, { contentType });
  const info = computeContentInfo(content);
  info.key = key;
  if (kvs.getPublicUrl) {
    info.url = await kvs.getPublicUrl(key);
  }
  return info;
}
