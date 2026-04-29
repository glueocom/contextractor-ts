import type { ContentExtractor, OutputFormat } from '@contextractor/extraction';
import { computeContentInfo as _computeContentInfo } from '@contextractor/extraction';

export type { DatasetMetadata } from '@contextractor/extraction';
export { projectMetadata } from '@contextractor/extraction';

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

export function computeContentInfo(content: string | Buffer): ContentInfo {
  return _computeContentInfo(content);
}

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

export async function saveContentToKvs(
  kvs: KvsLike,
  key: string,
  content: string,
  contentType: string,
): Promise<ContentInfo> {
  await kvs.setValue(key, content, { contentType });
  const info: ContentInfo = _computeContentInfo(content);
  info.key = key;
  if (kvs.getPublicUrl) {
    info.url = await kvs.getPublicUrl(key);
  }
  return info;
}
