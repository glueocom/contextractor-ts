import { createHash } from 'node:crypto';
import type { ExtractionResult, Sink } from '@contextractor/crawler';
import { computeContentInfo, type OutputFormat } from '@contextractor/extraction';
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
  { format: 'txt', dataKey: 'txt', contentType: 'text/plain; charset=utf-8', ext: 'txt' },
  {
    format: 'json',
    dataKey: 'json',
    contentType: 'application/json; charset=utf-8',
    ext: 'json',
  },
  {
    format: 'markdown',
    dataKey: 'markdown',
    contentType: 'text/markdown; charset=utf-8',
    ext: 'md',
  },
  {
    format: 'html',
    dataKey: 'html',
    contentType: 'text/html; charset=utf-8',
    ext: 'html',
  },
];

interface ApifySinkOpts {
  kvs: KvsLike;
  dataset: Dataset;
  saveOriginal: boolean;
  saveDestination: string[];
}

export function createApifySink(opts: ApifySinkOpts): Sink<ExtractionResult> {
  const { kvs, dataset, saveOriginal, saveDestination } = opts;
  const toKvs = saveDestination.includes('key-value-store');
  const toDataset = saveDestination.includes('dataset');

  return async (result: ExtractionResult): Promise<void> => {
    const keyBase = createHash('md5').update(result.url).digest('hex').slice(0, 16);

    const data: Record<string, unknown> = {
      loadedUrl: result.url,
      status: 'success',
      loadedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      metadata: result.metadata,
      httpStatus: 200,
      originalHash: result.rawHtmlHash,
      crawl: { depth: result.crawlDepth, referrerUrl: result.referrerUrl },
    };

    if (saveOriginal) {
      if (toKvs) {
        const originalKey = `${keyBase}-original.html`;
        const originalInfo: ContentInfo = {
          hash: result.rawHtmlHash,
          length: result.rawHtmlLength,
          key: originalKey,
        };
        await kvs.setValue(originalKey, result.html, { contentType: 'text/html; charset=utf-8' });
        if (kvs.getPublicUrl) originalInfo.url = await kvs.getPublicUrl(originalKey);
        data.original = originalInfo;
      } else if (toDataset) {
        data.original = result.html;
      }
    }

    for (const spec of FORMAT_SPECS) {
      const content = result.formats[spec.format];
      if (!content) continue;

      if (toDataset) {
        data[spec.dataKey] = content;
        data[`${spec.dataKey}Hash`] = computeContentInfo(content).hash;
      } else if (toKvs) {
        const key = `${keyBase}.${spec.ext}`;
        data[spec.dataKey] = await saveContentToKvs(kvs, key, content, spec.contentType);
      }
    }

    await dataset.pushData(data);
  };
}
