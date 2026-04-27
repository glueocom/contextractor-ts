import { createHash } from 'node:crypto';
import { ContentExtractor } from '@contextractor/engine';
import type { Actor, Dataset } from 'apify';
import type { PlaywrightCrawlingContext } from 'crawlee';
import type { CrawlConfig, SaveFormat } from './config.js';
import {
  type ContentInfo,
  computeContentInfo,
  extractFormat,
  type KvsLike,
  projectMetadata,
  saveContentToKvs,
} from './extraction.js';

export class ResultsCounter {
  private count = 0;
  constructor(public readonly maxResults: number) {}
  increment(): number {
    this.count += 1;
    return this.count;
  }
  isLimitReached(): boolean {
    return this.maxResults > 0 && this.count >= this.maxResults;
  }
  get value(): number {
    return this.count;
  }
}

export interface HandlerDeps {
  kvs: KvsLike;
  dataset: Dataset | null;
  resultsCounter: ResultsCounter;
  browserLogEnabled: boolean;
}

const COOKIE_DISMISS_SCRIPT = `() => {
  if (window.Didomi) {
    try { window.Didomi.setUserAgreeToAll(); return; } catch {}
  }
  const onetrust = document.querySelector('#onetrust-accept-btn-handler');
  if (onetrust) { onetrust.click(); return; }
  const cookiebot = document.querySelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
  if (cookiebot) { cookiebot.click(); return; }
  const quantcast = document.querySelector('.qc-cmp2-summary-buttons button[mode="primary"]');
  if (quantcast) { quantcast.click(); return; }
  const selectors = [
    '[class*="cookie"] button', '[id*="cookie"] button',
    '[class*="consent"] button', '[id*="consent"] button',
    'button[class*="accept"]', 'button[id*="accept"]',
  ];
  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn) { btn.click(); return; }
  }
}`;

export function createRequestHandler(
  deps: HandlerDeps,
): (context: PlaywrightCrawlingContext) => Promise<void> {
  const { kvs, dataset, resultsCounter, browserLogEnabled } = deps;

  return async function handler(context: PlaywrightCrawlingContext): Promise<void> {
    if (resultsCounter.isLimitReached()) {
      context.log.info(`Max results (${resultsCounter.maxResults}) reached, stopping.`);
      return;
    }

    const url = context.request.url;
    context.log.info(`Processing ${url}`);

    if (browserLogEnabled) {
      context.page.on('console', (msg) => {
        context.log.info(`[Browser] ${msg.type()}: ${msg.text()}`);
      });
    }

    const handlerConfig = (context.request.userData?.config as CrawlConfig) ?? null;
    if (!handlerConfig) {
      context.log.warning('No crawl config in user data; skipping.');
      return;
    }

    if (handlerConfig.closeCookieModals) {
      try {
        await context.page.evaluate(COOKIE_DISMISS_SCRIPT);
        await context.page.waitForTimeout(1000);
      } catch {
        // Best effort.
      }
    }

    if (handlerConfig.maxScrollHeightPixels > 0) {
      try {
        await context.page.evaluate(async (max: number) => {
          let scrolled = 0;
          while (scrolled < max) {
            window.scrollBy(0, 500);
            scrolled += 500;
            await new Promise((r) => setTimeout(r, 100));
          }
          window.scrollTo(0, 0);
        }, handlerConfig.maxScrollHeightPixels);
      } catch {
        // Best effort.
      }
    }

    const html = await context.page.content();
    const keyBase = createHash('md5').update(url).digest('hex').slice(0, 16);

    const extractor = new ContentExtractor(handlerConfig.trafilaturaConfig);

    const rawHtmlInfo: ContentInfo = computeContentInfo(html);
    if (handlerConfig.save.includes('html')) {
      const htmlKey = `${keyBase}-raw.html`;
      await kvs.setValue(htmlKey, html, { contentType: 'text/html; charset=utf-8' });
      rawHtmlInfo.key = htmlKey;
      if (kvs.getPublicUrl) rawHtmlInfo.url = await kvs.getPublicUrl(htmlKey);
    }

    const metadata = projectMetadata(html, url, extractor);

    const data: Record<string, unknown> = {
      loadedUrl: url,
      rawHtml: rawHtmlInfo,
      loadedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      metadata,
      httpStatus: 200,
    };

    await saveExtractedFormats(kvs, keyBase, html, url, extractor, handlerConfig, data);

    if (dataset) {
      await dataset.pushData(data);
    } else {
      await context.pushData(data);
    }

    resultsCounter.increment();

    if (resultsCounter.isLimitReached()) {
      context.log.info(`Max results (${resultsCounter.maxResults}) reached, stopping crawler.`);
      throw new Error('MAX_RESULTS_REACHED');
    }

    if (handlerConfig.linkSelector) {
      await enqueueLinks(context, handlerConfig);
    }
  };
}

interface SaveSpec {
  format: SaveFormat;
  outputFormat: 'text' | 'json' | 'markdown';
  dataKey: string;
  contentType: string;
  ext: string;
}

const SAVE_SPECS: readonly SaveSpec[] = [
  {
    format: 'text',
    outputFormat: 'text',
    dataKey: 'extractedText',
    contentType: 'text/plain; charset=utf-8',
    ext: 'txt',
  },
  {
    format: 'json',
    outputFormat: 'json',
    dataKey: 'extractedJson',
    contentType: 'application/json; charset=utf-8',
    ext: 'json',
  },
  {
    format: 'markdown',
    outputFormat: 'markdown',
    dataKey: 'extractedMarkdown',
    contentType: 'text/markdown; charset=utf-8',
    ext: 'md',
  },
];

async function saveExtractedFormats(
  kvs: KvsLike,
  keyBase: string,
  html: string,
  url: string,
  extractor: ContentExtractor,
  config: CrawlConfig,
  data: Record<string, unknown>,
): Promise<void> {
  for (const spec of SAVE_SPECS) {
    if (!config.save.includes(spec.format)) continue;
    const content = extractFormat(html, spec.outputFormat, extractor, url);
    if (!content) continue;
    const key = `${keyBase}.${spec.ext}`;
    data[spec.dataKey] = await saveContentToKvs(kvs, key, content, spec.contentType);
  }
}

async function enqueueLinks(
  context: PlaywrightCrawlingContext,
  config: CrawlConfig,
): Promise<void> {
  const currentDepth = (context.request.userData?.depth as number | undefined) ?? 0;
  if (config.maxCrawlingDepth !== 0 && currentDepth >= config.maxCrawlingDepth) {
    return;
  }
  const newDepth = currentDepth + 1;
  const globs = config.globs.map((g) => g.glob).filter(Boolean);
  const excludes = config.excludes.map((e) => e.glob).filter(Boolean);
  await context.enqueueLinks({
    selector: config.linkSelector,
    ...(globs.length > 0 ? { globs } : {}),
    ...(excludes.length > 0 ? { exclude: excludes } : {}),
    userData: { config, depth: newDepth },
    transformRequestFunction: (req) => {
      req.keepUrlFragment = config.keepUrlFragments;
      return req;
    },
  });
}

export type { Actor };
