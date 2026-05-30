import { z } from 'zod';

/**
 * Zod source-of-truth for the Apify Actor dataset output schema.
 *
 * The dataset carries three record shapes discriminated by `status`
 * (see apps/apify-actor/SPEC.md): `success`, `failed`, `skipped`.
 *
 * Field names follow rs-trafilatura output conventions and align with the
 * upstream Python trafilatura metadata fields.
 */

const ContentRef = z.object({
  hash: z.string().describe('MD5 hex digest of the content'),
  length: z.number().int().describe('Byte length of the content'),
  key: z.string().optional().describe('Key-value store key'),
  url: z.string().optional().describe('Public URL to the key-value store item'),
});

const ContentField = z.union([
  ContentRef,
  z.string().describe('Inline string content when saveDestination includes "dataset"'),
]);

const Metadata = z
  .object({
    title: z.string().nullable().describe('Page title'),
    author: z.string().nullable().describe('Content author'),
    publishedAt: z.string().nullable().describe('ISO 8601 publication date'),
    description: z.string().nullable().describe('Page description or summary'),
    siteName: z.string().nullable().describe('Site name (sitename in trafilatura)'),
    lang: z.string().nullable().describe('Detected content language code'),
  })
  .describe('Extracted page metadata');

const Crawl = z
  .object({
    depth: z.number().int().describe('Link distance from a start URL (0 for start URLs)'),
    referrerUrl: z.string().nullable().describe('The linking page URL, or null for start URLs'),
  })
  .describe('Crawl provenance for this page');

const SuccessRecord = z.object({
  url: z.string().describe('The original request URL'),
  loadedUrl: z.string().describe('The URL that was loaded (post-redirect)'),
  status: z.literal('success').describe('Record outcome discriminator'),
  loadedAt: z.string().describe('ISO 8601 timestamp when the page was loaded'),
  metadata: Metadata,
  httpStatus: z
    .number()
    .int()
    .describe('HTTP response status code (currently always 200; see SPEC)'),
  crawl: Crawl,
  original: ContentRef.describe(
    'Reference to the raw page HTML. "hash" and "length" are always present; "key" and "url" are added when "original" is in save and the raw HTML is stored in the key-value store.',
  ),
  txt: ContentField.optional().describe('Extracted plain text. Present when "txt" is in save.'),
  markdown: ContentField.optional().describe(
    'Extracted Markdown. Present when "markdown" is in save.',
  ),
  json: ContentField.optional().describe(
    'Extracted structured JSON. Present when "json" is in save.',
  ),
  html: ContentField.optional().describe('Cleaned extracted HTML. Present when "html" is in save.'),
  txtHash: z
    .string()
    .optional()
    .describe('MD5 hex of inline txt. Present when saveDestination includes "dataset".'),
  markdownHash: z
    .string()
    .optional()
    .describe('MD5 hex of inline markdown. Present when saveDestination includes "dataset".'),
  jsonHash: z
    .string()
    .optional()
    .describe('MD5 hex of inline json. Present when saveDestination includes "dataset".'),
  htmlHash: z
    .string()
    .optional()
    .describe('MD5 hex of inline html. Present when saveDestination includes "dataset".'),
});

const FailedRecord = z.object({
  url: z.string().describe('The original request URL'),
  loadedUrl: z
    .string()
    .nullable()
    .describe('The URL that was loaded before failure, or null if navigation never completed'),
  status: z.literal('failed').describe('Record outcome discriminator'),
  errorMessages: z.array(z.string()).describe('Error messages from the final attempt'),
  retryCount: z.number().int().describe('Number of retries before the request was abandoned'),
  crawledAt: z.string().describe('ISO 8601 timestamp when the failed request was abandoned'),
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
