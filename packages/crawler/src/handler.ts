import {
  ContentExtractor,
  computeContentInfo,
  projectMetadata,
  type TrafilaturaConfig,
  type OutputFormat,
} from '@contextractor/extraction';
import type { RequestHandler } from 'crawlee';
import type { PlaywrightCrawlingContext } from 'crawlee';
import { installCookieDefences } from './browser/cookies.js';
import { autoScroll, type ScrollConfig } from './browser/scroll.js';
import type { ExtractionResult, Sink } from './sinks/types.js';

export interface HandlerOpts {
  extractionConfig?: TrafilaturaConfig;
  sink: Sink<ExtractionResult>;
  cookieStrategy: 'ghostery' | 'autoconsent' | 'none';
  scroll?: ScrollConfig;
  formats: OutputFormat[];
  maxResults?: number;
  linkSelector?: string;
  maxCrawlingDepth?: number;
  globs?: string[];
  excludes?: string[];
  keepUrlFragments?: boolean;
}

export function createHandler(opts: HandlerOpts): RequestHandler<PlaywrightCrawlingContext> {
  const extractor = new ContentExtractor(opts.extractionConfig);
  let resultCount = 0;

  return async (context: PlaywrightCrawlingContext): Promise<void> => {
    const { page, request, log } = context;
    const url = request.url;
    log.info(`Processing ${url}`);

    if (opts.maxResults && resultCount >= opts.maxResults) {
      log.info(`Max results (${opts.maxResults}) reached, stopping.`);
      return;
    }

    if (opts.cookieStrategy === 'ghostery') {
      await installCookieDefences(page);
    }

    if (opts.scroll) {
      await autoScroll(context, opts.scroll);
    }

    const html = await page.content();
    const { hash: rawHtmlHash, length: rawHtmlLength } = computeContentInfo(html);

    const meta = extractor.extractMetadata(html, url);
    const metadata = projectMetadata(meta);

    const formats: Partial<Record<OutputFormat, string>> = {};
    for (const fmt of opts.formats) {
      const extracted = extractor.extract(html, { url, format: fmt });
      if (extracted?.content) formats[fmt] = extracted.content;
    }

    const result: ExtractionResult = { url, html, metadata, formats, rawHtmlHash, rawHtmlLength };
    await opts.sink(result);

    resultCount += 1;

    if (opts.maxResults && resultCount >= opts.maxResults) {
      log.info(`Max results (${opts.maxResults}) reached, stopping crawler.`);
      throw new Error('MAX_RESULTS_REACHED');
    }

    if (opts.linkSelector) {
      await enqueueLinks(context, opts);
    }
  };
}

async function enqueueLinks(
  context: PlaywrightCrawlingContext,
  opts: HandlerOpts,
): Promise<void> {
  const currentDepth = (context.request.userData?.depth as number | undefined) ?? 0;
  if (opts.maxCrawlingDepth !== undefined && opts.maxCrawlingDepth !== 0 && currentDepth >= opts.maxCrawlingDepth) {
    return;
  }
  const newDepth = currentDepth + 1;
  const globs = opts.globs?.filter(Boolean) ?? [];
  const excludes = opts.excludes?.filter(Boolean) ?? [];
  await context.enqueueLinks({
    selector: opts.linkSelector,
    ...(globs.length > 0 ? { globs } : {}),
    ...(excludes.length > 0 ? { exclude: excludes } : {}),
    userData: { depth: newDepth },
    transformRequestFunction: (req) => {
      req.keepUrlFragment = opts.keepUrlFragments ?? false;
      return req;
    },
  });
}
