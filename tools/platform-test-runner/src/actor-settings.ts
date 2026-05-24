/** Actor input settings from settings.json (Contextractor schema) */
export interface ActorSettings {
  // Crawl settings
  waitUntil?: 'NETWORKIDLE' | 'LOAD' | 'DOMCONTENTLOADED';
  maxRequestRetries?: number;
  pageLoadTimeoutSecs?: number;
  maxConcurrency?: number;
  headless?: boolean;
  launcher?: 'CHROMIUM' | 'FIREFOX';
  closeCookieModals?: boolean;
  maxScrollHeightPixels?: number;
  ignoreSslErrors?: boolean;
  downloadMedia?: boolean;
  downloadCss?: boolean;

  // Export options
  exportHtml?: boolean;
  exportText?: boolean;
  exportJson?: boolean;
  exportMarkdown?: boolean;
  exportXml?: boolean;
  exportXmlTei?: boolean;

  // Extraction options
  extractionMode?: 'FAVOR_PRECISION' | 'BALANCED' | 'FAVOR_RECALL';
  includeMetadata?: boolean;

  [key: string]: unknown;
}
