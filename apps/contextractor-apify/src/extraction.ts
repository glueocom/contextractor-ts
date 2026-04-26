import { createHash } from 'node:crypto';
import type { ContentExtractor, OutputFormat } from '@contextractor/engine';

export interface RichMetadata {
    title: string | null;
    author: string | null;
    publishedAt: string | null;
    description: string | null;
    siteName: string | null;
    lang: string | null;
}

export function extractMetadata(
    html: string,
    url: string,
    extractor: ContentExtractor,
): RichMetadata {
    const m = extractor.extractMetadata(html, url);
    let lang = m.language;
    if (!lang) {
        const match = html.match(/<html[^>]*\slang=["']([^"']+)["']/i);
        if (match?.[1]) lang = match[1];
    }
    return {
        title: m.title,
        author: m.author,
        publishedAt: m.date,
        description: m.description,
        siteName: m.sitename,
        lang,
    };
}

export function extractFormat(
    html: string,
    format: OutputFormat,
    extractor: ContentExtractor,
    url?: string,
): string | null {
    const r = extractor.extract(html, { url, format });
    return r?.content ?? null;
}

export interface ContentInfo {
    hash: string;
    length: number;
    key?: string;
    url?: string;
}

export function computeContentInfo(content: string | Buffer): ContentInfo {
    const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    return {
        hash: createHash('md5').update(buf).digest('hex'),
        length: buf.length,
    };
}

export interface KvsLike {
    setValue(key: string, value: string, options?: { contentType?: string }): Promise<void>;
    getPublicUrl(key: string): string;
}

export async function saveContentToKvs(
    kvs: KvsLike,
    key: string,
    content: string,
    contentType: string,
): Promise<ContentInfo & { key: string; url: string }> {
    await kvs.setValue(key, content, { contentType });
    const buf = Buffer.from(content, 'utf8');
    return {
        key,
        url: kvs.getPublicUrl(key),
        hash: createHash('md5').update(buf).digest('hex'),
        length: buf.length,
    };
}
