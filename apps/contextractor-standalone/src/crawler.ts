import { createHash } from 'node:crypto';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ContentExtractor, type Metadata, type OutputFormat } from '@contextractor/engine';
import type { PlaywrightCrawlingContext } from 'crawlee';
import { PlaywrightCrawler, ProxyConfiguration, Request } from 'crawlee';
import type { CrawlConfig, SaveFormat } from './config.js';

export const FORMAT_EXTENSIONS: Readonly<Record<SaveFormat, string>> = Object.freeze({
  markdown: '.md',
  html: '.html',
  text: '.txt',
  json: '.json',
  jsonl: '.jsonl',
});

export function urlToFilename(url: string): string {
  let slug = url.replace(/^https?:\/\//, '');
  slug = slug.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (slug.length > 100) {
    const hash = createHash('md5').update(url).digest('hex').slice(0, 8);
    slug = `${slug.slice(0, 100)}-${hash}`;
  }
  return slug;
}

export interface CrawlOutcome {
  pagesExtracted: number;
}

export async function runCrawl(config: CrawlConfig): Promise<CrawlOutcome> {
  const outputDir = path.resolve(config.outputDir);
  await mkdir(outputDir, { recursive: true });

  const extractor = new ContentExtractor(config.trafilaturaConfig);
  let pagesExtracted = 0;

  const proxyConfig =
    config.proxyUrls.length > 0
      ? new ProxyConfiguration({ proxyUrls: config.proxyUrls })
      : undefined;

  const browserLaunchOptions = buildBrowserLaunchOptions(config);

  const crawler = new PlaywrightCrawler({
    headless: config.headless,
    launchContext: {
      launchOptions: browserLaunchOptions,
    },
    maxRequestsPerCrawl: config.maxPages > 0 ? config.maxPages : undefined,
    maxRequestRetries: config.maxRetries,
    requestHandlerTimeoutSecs: config.pageLoadTimeout,
    navigationTimeoutSecs: config.pageLoadTimeout,
    ...(proxyConfig ? { proxyConfiguration: proxyConfig } : {}),
    maxConcurrency: config.maxConcurrency,
    respectRobotsTxtFile: config.respectRobotsTxt,
    maxRequestsPerMinute: undefined,
  });

  crawler.router.addDefaultHandler(async (context: PlaywrightCrawlingContext) => {
    const url = context.request.url;
    if (config.maxResults > 0 && pagesExtracted >= config.maxResults) {
      context.log.info(`Reached max results (${config.maxResults}); skipping ${url}.`);
      return;
    }

    if (config.closeCookieModals) {
      try {
        await context.page.evaluate(COOKIE_DISMISS_SCRIPT);
        await context.page.waitForTimeout(1000);
      } catch {}
    }

    if (config.maxScrollHeight > 0) {
      try {
        await context.page.evaluate(async (max: number) => {
          let scrolled = 0;
          while (scrolled < max) {
            window.scrollBy(0, 500);
            scrolled += 500;
            await new Promise((r) => setTimeout(r, 100));
          }
          window.scrollTo(0, 0);
        }, config.maxScrollHeight);
      } catch {}
    }

    const html = await context.page.content();
    const slug = urlToFilename(url);
    const metadata = extractor.extractMetadata(html, url);

    let anySaved = false;

    for (const fmt of config.save) {
      anySaved =
        (await saveFormat(extractor, html, url, slug, outputDir, fmt, metadata)) || anySaved;
    }

    if (!anySaved) {
      context.log.warning(`No content extracted from ${url}`);
      return;
    }

    pagesExtracted += 1;

    if (config.crawlDepth > 0 && config.linkSelector) {
      const enqueueOptions: {
        selector: string;
        globs?: string[];
        exclude?: string[];
      } = {
        selector: config.linkSelector,
      };
      if (config.globs.length > 0) enqueueOptions.globs = [...config.globs];
      if (config.excludes.length > 0) enqueueOptions.exclude = [...config.excludes];
      await context.enqueueLinks(enqueueOptions);
    }
  });

  const requests = config.urls.map(
    (url) => new Request({ url, keepUrlFragment: config.keepUrlFragments }),
  );

  await crawler.run(requests);

  return { pagesExtracted };
}

async function saveFormat(
  extractor: ContentExtractor,
  html: string,
  url: string,
  slug: string,
  outputDir: string,
  fmt: SaveFormat,
  metadata: Metadata,
): Promise<boolean> {
  switch (fmt) {
    case 'html': {
      await writeFile(path.join(outputDir, `${slug}.html`), html, 'utf8');
      return true;
    }
    case 'jsonl': {
      const result = extractor.extract(html, { url, format: 'markdown' });
      if (!result?.content) return false;
      const entry = {
        url,
        title: metadata.title ?? '',
        author: metadata.author ?? '',
        date: metadata.date ?? '',
        content: result.content,
      };
      await appendFile(path.join(outputDir, 'output.jsonl'), `${JSON.stringify(entry)}\n`, 'utf8');
      return true;
    }
    case 'markdown':
    case 'text':
    case 'json': {
      const native: OutputFormat = fmt === 'text' ? 'txt' : fmt;
      const result = extractor.extract(html, { url, format: native });
      if (!result?.content) return false;
      const out =
        fmt === 'json' ? result.content : prependMetadataHeader(result.content, metadata, url);
      const ext = FORMAT_EXTENSIONS[fmt];
      await writeFile(path.join(outputDir, `${slug}${ext}`), out, 'utf8');
      return true;
    }
  }
}

function prependMetadataHeader(content: string, metadata: Metadata, url: string): string {
  const lines: string[] = [];
  if (metadata.title || metadata.author || metadata.date) {
    if (metadata.title) lines.push(`Title: ${metadata.title}`);
    if (metadata.author) lines.push(`Author: ${metadata.author}`);
    if (metadata.date) lines.push(`Date: ${metadata.date}`);
    lines.push(`URL: ${url}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  lines.push(content);
  return lines.join('\n');
}

function buildBrowserLaunchOptions(config: CrawlConfig): {
  args: string[];
  ignoreHTTPSErrors?: boolean;
} {
  const args: string[] = [];
  if (config.launcher === 'chromium') {
    args.push('--disable-blink-features=AutomationControlled');
  }
  if (process.env.CONTEXTRACTOR_NO_SANDBOX) {
    args.push('--no-sandbox');
  }
  const launchOptions: { args: string[]; ignoreHTTPSErrors?: boolean } = { args };
  if (config.ignoreSslErrors) launchOptions.ignoreHTTPSErrors = true;
  return launchOptions;
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
