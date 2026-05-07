import { z } from 'zod';

/**
 * Zod source-of-truth for the Apify Actor dataset output schema.
 * Each item represents one extracted page.
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

export const ContextractorOutput = z.object({
  loadedUrl: z.string().describe('The URL that was loaded'),

  httpStatus: z.number().int().describe('HTTP response status code'),

  loadedAt: z.string().describe('ISO 8601 timestamp when the page was loaded'),

  metadata: z
    .object({
      title: z.string().nullable().describe('Page title'),
      author: z.string().nullable().describe('Content author'),
      publishedAt: z.string().nullable().describe('ISO 8601 publication date'),
      description: z.string().nullable().describe('Page description or summary'),
      siteName: z.string().nullable().describe('Site name (sitename in trafilatura)'),
      lang: z.string().nullable().describe('Detected content language code'),
    })
    .describe('Extracted page metadata'),

  original: ContentField.optional().describe(
    'Raw page HTML captured before extraction. Present when "original" is in save.',
  ),

  txt: ContentField.optional().describe('Extracted plain text. Present when "txt" is in save.'),

  markdown: ContentField.optional().describe(
    'Extracted Markdown. Present when "markdown" is in save.',
  ),

  json: ContentField.optional().describe(
    'Extracted structured JSON with metadata. Present when "json" is in save.',
  ),

  html: ContentField.optional().describe('Cleaned extracted HTML. Present when "html" is in save.'),
});

export type ContextractorOutputType = z.infer<typeof ContextractorOutput>;
