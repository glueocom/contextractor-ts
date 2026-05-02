import { computeContentInfo as _computeContentInfo } from '@contextractor/extraction';

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
