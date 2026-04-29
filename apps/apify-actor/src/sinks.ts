import { createHash } from 'node:crypto';
import type { ExtractionResult, Sink } from '@contextractor/crawler';
import type { OutputFormat } from '@contextractor/extraction';
import type { Dataset } from 'apify';
import type { ContentInfo, KvsLike } from './extraction.js';
import { saveContentToKvs } from './extraction.js';

interface FormatSpec {
  format: OutputFormat;
  dataKey: string;
  contentType: string;
  ext: string;
}

const FORMAT_SPECS: readonly FormatSpec[] = [
  { format: 'txt', dataKey: 'extractedText', contentType: 'text/plain; charset=utf-8', ext: 'txt' },
  {
    format: 'json',
    dataKey: 'extractedJson',
    contentType: 'application/json; charset=utf-8',
    ext: 'json',
  },
  {
    format: 'markdown',
    dataKey: 'extractedMarkdown',
    contentType: 'text/markdown; charset=utf-8',
    ext: 'md',
  },
];

export interface ApifySinkOpts {
  kvs: KvsLike;
  dataset: Dataset;
  saveHtml: boolean;
}

export function createApifySink(opts: ApifySinkOpts): Sink<ExtractionResult> {
  const { kvs, dataset, saveHtml } = opts;

  return async (result: ExtractionResult): Promise<void> => {
    const keyBase = createHash('md5').update(result.url).digest('hex').slice(0, 16);

    const rawHtmlInfo: ContentInfo = { hash: result.rawHtmlHash, length: result.rawHtmlLength };
    if (saveHtml) {
      const htmlKey = `${keyBase}-raw.html`;
      await kvs.setValue(htmlKey, result.html, { contentType: 'text/html; charset=utf-8' });
      rawHtmlInfo.key = htmlKey;
      if (kvs.getPublicUrl) rawHtmlInfo.url = await kvs.getPublicUrl(htmlKey);
    }

    const data: Record<string, unknown> = {
      loadedUrl: result.url,
      rawHtml: rawHtmlInfo,
      loadedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      metadata: result.metadata,
      httpStatus: 200,
    };

    for (const spec of FORMAT_SPECS) {
      const content = result.formats[spec.format];
      if (!content) continue;
      const key = `${keyBase}.${spec.ext}`;
      data[spec.dataKey] = await saveContentToKvs(kvs, key, content, spec.contentType);
    }

    await dataset.pushData(data);
  };
}
