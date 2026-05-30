import { z } from 'zod';

/**
 * Zod source-of-truth for the Apify Actor dataset output schema.
 *
 * The dataset carries three record shapes discriminated by `status`
 * (see apps/apify-actor/SPEC.md): `success`, `failed`, `skipped`.
 *
 * Crawl-provenance fields are nested under `crawl` (apify/website-content-crawler
 * style). Crawl-EVENT timestamps use `*Time` (`crawl.loadedTime`, `crawledTime`);
 * content-metadata dates use `*At` (`metadata.publishedAt`). Metadata field names
 * align with the upstream trafilatura fields.
 */

/**
 * A piece of content (an extracted format or the raw original HTML). Always an
 * object: `hash` + `bytes` are always present; `content` carries the inline
 * string when saving to the dataset, while `key` + `url` reference the blob when
 * stored in the key-value store.
 */
const ContentNode = z.object({
  hash: z.string().describe('MD5 hex digest of the content'),
  bytes: z.number().int().describe('UTF-8 byte length of the content'),
  content: z
    .string()
    .optional()
    .describe('Inline content string. Present when saveDestination includes "dataset".'),
  key: z
    .string()
    .optional()
    .describe('Key-value store key. Present when the content is stored in the key-value store.'),
  url: z
    .string()
    .optional()
    .describe('Public URL to the key-value store item. Present when stored to a public store.'),
});

const Metadata = z
  .object({
    title: z.string().nullable().describe('Page title'),
    author: z.string().nullable().describe('Content author'),
    publishedAt: z.string().nullable().describe('ISO 8601 publication date'),
    description: z.string().nullable().describe('Page description or summary'),
    siteName: z.string().nullable().describe('Site name (sitename in trafilatura)'),
    languageCode: z.string().nullable().describe('Detected content language code (ISO 639)'),
  })
  .describe('Extracted page metadata');

const Crawl = z
  .object({
    loadedUrl: z.string().describe('The URL that was loaded (post-redirect)'),
    loadedTime: z.string().describe('ISO 8601 timestamp when the page was loaded'),
    httpStatusCode: z
      .number()
      .int()
      .describe('HTTP response status code (currently always 200; see SPEC)'),
    depth: z.number().int().describe('Link distance from a start URL (0 for start URLs)'),
    referrerUrl: z.string().nullable().describe('The linking page URL, or null for start URLs'),
  })
  .describe('Crawl provenance for this page');

const SuccessRecord = z.object({
  url: z.string().describe('The original request URL'),
  status: z.literal('success').describe('Record outcome discriminator'),
  metadata: Metadata,
  crawl: Crawl,
  original: ContentNode.describe(
    'The raw page HTML. "hash" and "bytes" are always present. When "original" is in save, the raw HTML is included as "content" (saving to the dataset) or referenced by "key"/"url" (stored in the key-value store).',
  ),
  txt: ContentNode.optional().describe('Extracted plain text. Present when "txt" is in save.'),
  markdown: ContentNode.optional().describe(
    'Extracted Markdown. Present when "markdown" is in save.',
  ),
  json: ContentNode.optional().describe(
    'Extracted structured JSON. Present when "json" is in save.',
  ),
  html: ContentNode.optional().describe('Cleaned extracted HTML. Present when "html" is in save.'),
});

const FailedRecord = z.object({
  url: z.string().describe('The original request URL'),
  status: z.literal('failed').describe('Record outcome discriminator'),
  crawl: z
    .object({
      loadedUrl: z
        .string()
        .nullable()
        .describe('The URL that was loaded before failure, or null if navigation never completed'),
    })
    .describe('Crawl provenance for this page'),
  errors: z.array(z.string()).describe('Error messages from the final attempt'),
  retryCount: z.number().int().describe('Number of retries before the request was abandoned'),
  crawledTime: z.string().describe('ISO 8601 timestamp when the failed request was abandoned'),
});

const SkippedRecord = z.object({
  url: z.string().describe('The skipped URL'),
  status: z.literal('skipped').describe('Record outcome discriminator'),
  skipReason: z
    .enum(['robotsTxt', 'limit', 'enqueueLimit', 'filters', 'redirect', 'depth'])
    .describe('Why the URL was skipped'),
});

export const ContextractorOutput = z.discriminatedUnion('status', [
  SuccessRecord,
  FailedRecord,
  SkippedRecord,
]);
