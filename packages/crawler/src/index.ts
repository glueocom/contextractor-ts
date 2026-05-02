export type { ProxyConfiguration, RequestProvider } from 'crawlee';
export { getBlocker, installCookieDefences, rejectViaAutoconsent } from './browser/cookies.js';
export type { ScrollConfig } from './browser/scroll.js';
export { autoScroll } from './browser/scroll.js';
export type { ContextractorCrawlerOptions } from './createCrawler.js';
export { buildRequests, createContextractorCrawler } from './createCrawler.js';
export { FORMAT_EXTENSIONS, fileSink, urlToFilename } from './sinks/file.js';
export { memorySink } from './sinks/memory.js';
export type { ExtractionResult, Sink } from './sinks/types.js';
