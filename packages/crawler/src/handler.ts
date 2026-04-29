import {
  ContentExtractor,
  computeContentInfo,
  type OutputFormat,
  projectMetadata,
  type TrafilaturaConfig,
} from '@contextractor/extraction';
import type { PlaywrightCrawlingContext, RequestHandler } from 'crawlee';
import { autoScroll, type ScrollConfig } from './browser/scroll.js';
import type { ExtractionResult, Sink } from './sinks/types.js';

export interface HandlerOpts {
  extractionConfig?: TrafilaturaConfig;
  sink: Sink<ExtractionResult>;
  scroll?: ScrollConfig;
  formats: OutputFormat[];
  maxResults?: number;
  linkSelector?: string;
  maxCrawlingDepth?: number;
  globs?: string[];
  excludes?: string[];
  keepUrlFragments?: boolean;
  browserLog?: boolean;
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

    if (opts.browserLog) {
      page.on('console', (message) => {
        log.info(`[Browser] ${message.type()}: ${message.text()}`);
      });
    }

    if (opts.scroll) {
      await autoScroll(context, opts.scroll);
    }

    const html = await page.content();
    const { hash: rawHtmlHash, length: rawHtmlLength } = computeContentInfo(html);
    const metadata = projectMetadata(extractor.extractMetadata(html, url));

    const formats: Partial<Record<OutputFormat, string>> = {};
    for (const fmt of opts.formats) {
      const extracted = extractor.extract(html, { url, format: fmt });
      if (extracted?.content) formats[fmt] = extracted.content;
    }

    await opts.sink({
      url,
      html,
      metadata,
      formats,
      rawHtmlHash,
      rawHtmlLength,
    });

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

async function enqueueLinks(context: PlaywrightCrawlingContext, opts: HandlerOpts): Promise<void> {
  const currentDepth = (context.request.userData?.depth as number | undefined) ?? 0;
  if (
    opts.maxCrawlingDepth !== undefined &&
    opts.maxCrawlingDepth !== 0 &&
    currentDepth >= opts.maxCrawlingDepth
  ) {
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
    transformRequestFunction: (request) => {
      request.keepUrlFragment = opts.keepUrlFragments ?? false;
      return request;
    },
  });
}
