/** Content reference stored in KVS */
interface ContentRef {
  key?: string;
  url?: string;
  hash: string;
  length: number;
}

/** Dataset item from Contextractor actor output */
export interface DatasetItem {
  loadedUrl: string;
  rawHtml?: ContentRef;
  loadedAt?: string;
  httpStatus?: number;
  metadata?: {
    title?: string | null;
    author?: string | null;
    publishedAt?: string | null;
    description?: string | null;
    siteName?: string | null;
    lang?: string | null;
  };
  extractedText?: ContentRef;
  extractedJson?: ContentRef;
  extractedMarkdown?: ContentRef;
  extractedXml?: ContentRef;
  extractedXmlTei?: ContentRef;
  '#error'?: boolean;
  '#errorMessage'?: string;
}
