import {
  ContentExtractor,
  computeContentInfo,
  type OutputFormat,
  projectMetadata,
  type TrafilaturaConfig,
} from '@contextractor/extraction';
import type {
  AdaptivePlaywrightCrawlerContext,
  CheerioCrawlingContext,
  EnqueueLinksOptions,
  LoadedContext,
  PlaywrightCrawlingContext,
  RequestHandler,
} from 'crawlee';
import { autoScroll, type ScrollConfig } from './browser/scroll.js';
import type { ExtractionResult, Sink } from './sinks/types.js';

interface HandlerOpts {
  extractionConfig?: TrafilaturaConfig;
  sink: Sink<ExtractionResult>;
  scroll?: ScrollConfig;
  formats: OutputFormat[];
  maxResults?: number;
  selector?: string;
  maxCrawlDepth?: number;
  globs?: string[];
  exclude?: string[];
  keepUrlFragment?: boolean;
  onSkippedUrl?: (url: string, reason: string) => void;
  waitForSelector?: string;
  softWaitForSelector?: string;
  waitForDynamicContentSecs?: number;
  deduplication: 'none' | 'url' | 'content-hash';
  seenCanonicals: Set<string>;
  seenContentHashes: Set<string>;
}

function checkAndRecordCanonical(
  html: string,
  url: string,
  seenCanonicals: Set<string>,
): { skip: boolean; canonical?: string } {
  const canonicalMatch =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const canonical = canonicalMatch?.[1];
  if (canonical === undefined) return { skip: false };
  if (canonical !== url && seenCanonicals.has(canonical)) {
    return { skip: true, canonical };
  }
  seenCanonicals.add(canonical);
  return { skip: false, canonical };
}

export function createHandler(opts: HandlerOpts): RequestHandler<PlaywrightCrawlingContext> {
  const extractor = new ContentExtractor(opts.extractionConfig);
  let resultCount = 0;

  return async (context: PlaywrightCrawlingContext): Promise<void> => {
    const { page, request, log } = context;
    const url = request.url;
    const loadedUrl = request.loadedUrl ?? request.url;
    const crawlDepth = typeof request.userData?.depth === 'number' ? request.userData.depth : 0;
    const referrerUrl =
      typeof request.userData?.referrerUrl === 'string' ? request.userData.referrerUrl : null;
    log.info(`Processing ${url}`);

    if (opts.maxResults && resultCount >= opts.maxResults) {
      log.info(`Max results (${opts.maxResults}) reached, stopping.`);
      return;
    }

    if (opts.scroll) {
      await autoScroll(context, opts.scroll);
    }

    if (opts.waitForDynamicContentSecs && opts.waitForDynamicContentSecs > 0) {
      await page
        .waitForLoadState('networkidle', { timeout: opts.waitForDynamicContentSecs * 1000 })
        .catch(() => {});
    }

    const selectorTimeoutMs = (opts.waitForDynamicContentSecs ?? 30) * 1000;

    if (opts.waitForSelector) {
      await page.waitForSelector(opts.waitForSelector, { timeout: selectorTimeoutMs });
    }
    if (opts.softWaitForSelector) {
      await page
        .waitForSelector(opts.softWaitForSelector, { timeout: selectorTimeoutMs })
        .catch(() => {});
    }

    const html = await page.content();

    if (opts.deduplication !== 'none') {
      const { skip, canonical } = checkAndRecordCanonical(html, url, opts.seenCanonicals);
      if (skip) {
        log.info(`Skipping ${url} — duplicate of canonical ${canonical}`);
        return;
      }
    }

    const { hash: rawHtmlHash, length: rawHtmlLength } = computeContentInfo(html);
    const metadata = projectMetadata(extractor.extractMetadata(html, url));

    const formats: Partial<Record<OutputFormat, string>> = {};
    for (const fmt of opts.formats) {
      const extracted = extractor.extract(html, { url, format: fmt });
      if (extracted?.content) formats[fmt] = extracted.content;
    }

    if (opts.deduplication === 'content-hash') {
      const extractedText = Object.values(formats).join('\n');
      if (extractedText.length > 0) {
        const { hash: contentHash } = computeContentInfo(extractedText);
        if (opts.seenContentHashes.has(contentHash)) {
          log.info(`Skipping ${url} — duplicate content hash`);
          return;
        }
        opts.seenContentHashes.add(contentHash);
      }
    }

    await opts.sink({
      url,
      loadedUrl,
      html,
      metadata,
      formats,
      rawHtmlHash,
      rawHtmlLength,
      crawlDepth,
      referrerUrl,
    });

    resultCount += 1;

    if (opts.maxResults && resultCount >= opts.maxResults) {
      log.info(`Max results (${opts.maxResults}) reached, stopping crawler.`);
      throw new Error('MAX_RESULTS_REACHED');
    }

    if (opts.selector) {
      await enqueueLinks(context, opts);
    }
  };
}

async function enqueueLinks(context: PlaywrightCrawlingContext, opts: HandlerOpts): Promise<void> {
  const rawDepth = context.request.userData?.depth;
  const currentDepth = typeof rawDepth === 'number' ? rawDepth : 0;
  if (
    opts.maxCrawlDepth !== undefined &&
    opts.maxCrawlDepth !== 0 &&
    currentDepth >= opts.maxCrawlDepth
  ) {
    return;
  }
  const newDepth = currentDepth + 1;
  const referrerUrl = context.request.url;
  const globs = opts.globs?.filter(Boolean) ?? [];
  const exclude = opts.exclude?.filter(Boolean) ?? [];
  await context.enqueueLinks({
    selector: opts.selector,
    ...(globs.length > 0 ? { globs } : {}),
    ...(exclude.length > 0 ? { exclude: exclude } : {}),
    userData: { depth: newDepth, referrerUrl },
    transformRequestFunction: (request) => {
      request.keepUrlFragment = opts.keepUrlFragment ?? false;
      return request;
    },
    ...(opts.onSkippedUrl
      ? { onSkippedRequest: ({ url, reason }) => opts.onSkippedUrl?.(url, reason) }
      : {}),
  });
}

export function createCheerioHandler(opts: HandlerOpts): RequestHandler<CheerioCrawlingContext> {
  const extractor = new ContentExtractor(opts.extractionConfig);
  let resultCount = 0;

  return async (context: CheerioCrawlingContext): Promise<void> => {
    const { request, log } = context;
    const url = request.url;
    const loadedUrl = request.loadedUrl ?? request.url;
    const crawlDepth = typeof request.userData?.depth === 'number' ? request.userData.depth : 0;
    const referrerUrl =
      typeof request.userData?.referrerUrl === 'string' ? request.userData.referrerUrl : null;
    log.info(`Processing ${url}`);

    if (opts.maxResults && resultCount >= opts.maxResults) {
      log.info(`Max results (${opts.maxResults}) reached, stopping.`);
      return;
    }

    const html = context.$('html').prop('outerHTML') ?? '';

    if (opts.deduplication !== 'none') {
      const { skip, canonical } = checkAndRecordCanonical(html, url, opts.seenCanonicals);
      if (skip) {
        log.info(`Skipping ${url} — duplicate of canonical ${canonical}`);
        return;
      }
    }

    const { hash: rawHtmlHash, length: rawHtmlLength } = computeContentInfo(html);
    const metadata = projectMetadata(extractor.extractMetadata(html, url));

    const formats: Partial<Record<OutputFormat, string>> = {};
    for (const fmt of opts.formats) {
      const extracted = extractor.extract(html, { url, format: fmt });
      if (extracted?.content) formats[fmt] = extracted.content;
    }

    if (opts.deduplication === 'content-hash') {
      const extractedText = Object.values(formats).join('\n');
      if (extractedText.length > 0) {
        const { hash: contentHash } = computeContentInfo(extractedText);
        if (opts.seenContentHashes.has(contentHash)) {
          log.info(`Skipping ${url} — duplicate content hash`);
          return;
        }
        opts.seenContentHashes.add(contentHash);
      }
    }

    await opts.sink({
      url,
      loadedUrl,
      html,
      metadata,
      formats,
      rawHtmlHash,
      rawHtmlLength,
      crawlDepth,
      referrerUrl,
    });

    resultCount += 1;

    if (opts.maxResults && resultCount >= opts.maxResults) {
      log.info(`Max results (${opts.maxResults}) reached, stopping crawler.`);
      throw new Error('MAX_RESULTS_REACHED');
    }

    if (opts.selector) {
      await enqueueLinksCheerio(context, opts);
    }
  };
}

export function createAdaptiveHandler(
  opts: HandlerOpts,
): (ctx: LoadedContext<AdaptivePlaywrightCrawlerContext>) => Promise<void> {
  const extractor = new ContentExtractor(opts.extractionConfig);
  let resultCount = 0;

  return async (context: LoadedContext<AdaptivePlaywrightCrawlerContext>): Promise<void> => {
    const { request, log } = context;
    const url = request.url;
    const loadedUrl = request.loadedUrl ?? request.url;
    const crawlDepth = typeof request.userData?.depth === 'number' ? request.userData.depth : 0;
    const referrerUrl =
      typeof request.userData?.referrerUrl === 'string' ? request.userData.referrerUrl : null;
    log.info(`Processing ${url}`);

    if (opts.maxResults && resultCount >= opts.maxResults) {
      log.info(`Max results (${opts.maxResults}) reached, stopping.`);
      return;
    }

    const $ = await context.parseWithCheerio();
    const html = $.html() ?? '';

    if (opts.deduplication !== 'none') {
      const { skip, canonical } = checkAndRecordCanonical(html, url, opts.seenCanonicals);
      if (skip) {
        log.info(`Skipping ${url} — duplicate of canonical ${canonical}`);
        return;
      }
    }

    const { hash: rawHtmlHash, length: rawHtmlLength } = computeContentInfo(html);
    const metadata = projectMetadata(extractor.extractMetadata(html, url));

    const formats: Partial<Record<OutputFormat, string>> = {};
    for (const fmt of opts.formats) {
      const extracted = extractor.extract(html, { url, format: fmt });
      if (extracted?.content) formats[fmt] = extracted.content;
    }

    if (opts.deduplication === 'content-hash') {
      const extractedText = Object.values(formats).join('\n');
      if (extractedText.length > 0) {
        const { hash: contentHash } = computeContentInfo(extractedText);
        if (opts.seenContentHashes.has(contentHash)) {
          log.info(`Skipping ${url} — duplicate content hash`);
          return;
        }
        opts.seenContentHashes.add(contentHash);
      }
    }

    await opts.sink({
      url,
      loadedUrl,
      html,
      metadata,
      formats,
      rawHtmlHash,
      rawHtmlLength,
      crawlDepth,
      referrerUrl,
    });

    resultCount += 1;

    if (opts.maxResults && resultCount >= opts.maxResults) {
      log.info(`Max results (${opts.maxResults}) reached, stopping crawler.`);
      throw new Error('MAX_RESULTS_REACHED');
    }

    if (opts.selector) {
      await enqueueLinksAdaptive(context, opts);
    }
  };
}

async function enqueueLinksCheerio(
  context: CheerioCrawlingContext,
  opts: HandlerOpts,
): Promise<void> {
  const rawDepth = context.request.userData?.depth;
  const currentDepth = typeof rawDepth === 'number' ? rawDepth : 0;
  if (
    opts.maxCrawlDepth !== undefined &&
    opts.maxCrawlDepth !== 0 &&
    currentDepth >= opts.maxCrawlDepth
  ) {
    return;
  }
  const newDepth = currentDepth + 1;
  const referrerUrl = context.request.url;
  const globs = opts.globs?.filter(Boolean) ?? [];
  const exclude = opts.exclude?.filter(Boolean) ?? [];
  await context.enqueueLinks({
    selector: opts.selector,
    ...(globs.length > 0 ? { globs } : {}),
    ...(exclude.length > 0 ? { exclude: exclude } : {}),
    userData: { depth: newDepth, referrerUrl },
    transformRequestFunction: (request) => {
      request.keepUrlFragment = opts.keepUrlFragment ?? false;
      return request;
    },
    ...(opts.onSkippedUrl
      ? { onSkippedRequest: ({ url, reason }) => opts.onSkippedUrl?.(url, reason) }
      : {}),
  });
}

async function enqueueLinksAdaptive(
  context: LoadedContext<AdaptivePlaywrightCrawlerContext>,
  opts: HandlerOpts,
): Promise<void> {
  const rawDepth = context.request.userData?.depth;
  const currentDepth = typeof rawDepth === 'number' ? rawDepth : 0;
  if (
    opts.maxCrawlDepth !== undefined &&
    opts.maxCrawlDepth !== 0 &&
    currentDepth >= opts.maxCrawlDepth
  ) {
    return;
  }
  const newDepth = currentDepth + 1;
  const referrerUrl = context.request.url;
  const globs = opts.globs?.filter(Boolean) ?? [];
  const exclude = opts.exclude?.filter(Boolean) ?? [];
  const enqueueOpts: EnqueueLinksOptions = {
    selector: opts.selector,
    ...(globs.length > 0 ? { globs } : {}),
    ...(exclude.length > 0 ? { exclude: exclude } : {}),
    userData: { depth: newDepth, referrerUrl },
    transformRequestFunction: (request) => {
      request.keepUrlFragment = opts.keepUrlFragment ?? false;
      return request;
    },
    ...(opts.onSkippedUrl
      ? { onSkippedRequest: ({ url, reason }) => opts.onSkippedUrl?.(url, reason) }
      : {}),
  };
  await context.enqueueLinks(enqueueOpts);
}
