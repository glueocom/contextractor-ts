/**
 * One piece of content (an extracted format or the raw original HTML), as
 * written by the Contextractor Actor. `hash` + `bytes` are always present;
 * `content` is the inline string when saving to the dataset, while `key` + `url`
 * reference the blob when saving to the key-value store.
 */
interface ContentNode {
  hash: string;
  bytes: number;
  content?: string;
  key?: string;
  url?: string;
}

/**
 * A dataset item from the Contextractor Actor output. The dataset carries three
 * record shapes discriminated by `status`: `success`, `failed`, `skipped`.
 */
export interface DatasetItem {
  url: string;
  status: 'success' | 'failed' | 'skipped';
  // success / failed
  loadedUrl?: string | null;
  // success
  loadedAt?: string;
  httpStatus?: number;
  metadata?: {
    title: string | null;
    author: string | null;
    publishedAt: string | null;
    description: string | null;
    siteName: string | null;
    lang: string | null;
  };
  crawl?: { depth: number; referrerUrl: string | null };
  original?: ContentNode;
  txt?: ContentNode;
  markdown?: ContentNode;
  json?: ContentNode;
  html?: ContentNode;
  // failed
  errorMessages?: string[];
  retryCount?: number;
  crawledAt?: string;
  // skipped
  skipReason?: 'robotsTxt' | 'limit' | 'enqueueLimit' | 'filters' | 'redirect' | 'depth';
}
