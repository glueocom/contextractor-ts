export type { RequestProvider } from 'crawlee';
export { ProxyConfiguration, SitemapRequestList } from 'crawlee';
export { getBlocker, installCookieDefences, rejectViaAutoconsent } from './browser/cookies.js';
export type { ScrollConfig } from './browser/scroll.js';
export { autoScroll } from './browser/scroll.js';
export type { ContextractorCrawlerOptions } from './createCrawler.js';
export { buildRequests, createContextractorCrawler } from './createCrawler.js';
export { memorySink } from './sinks/memory.js';
export {
  type BuildSuccessRecordOpts,
  buildFailedRecord,
  buildSkippedRecord,
  buildSuccessRecord,
  type ContentKind,
  type ContentNode,
  type FailedRequestInfo,
  type KvsLike,
  kvsKey,
} from './sinks/storage.js';
export type { ExtractionResult, Sink } from './sinks/types.js';
