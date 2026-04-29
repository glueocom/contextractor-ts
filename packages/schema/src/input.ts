import { z } from 'zod';
import { apifyMeta } from './apify-meta.js';

const initialCookiesDescription = [
  'Cookies that will be pre-set to all pages the scraper opens. This is useful for pages that require login. The value is expected to be a JSON array of objects with `name` and `value` properties. For example: ',
  '',
  '```json',
  '[',
  '  {',
  '    "name": "cookieName",',
  '    "value": "cookieValue",',
  '    "path": "/",',
  '    "domain": ".example.com"',
  '  }',
  ']',
  '```',
  '',
  'You can use the [EditThisCookie](https://docs.apify.com/academy/tools/edit-this-cookie) browser extension to copy browser cookies in this format, and paste it here.',
  '',
  'Note that the value is secret and encrypted to protect your login cookies.',
].join('\n');

export const ContextractorInput = z.object({
  startUrls: z
    .array(z.object({ url: z.string() }).loose())
    .min(1)
    .describe('URLs to extract content from')
    .meta({
      title: 'Start URLs',
      ...apifyMeta({
        editor: 'requestListSources',
        prefill: [{ url: 'https://blog.apify.com/what-is-web-scraping/' }],
      }),
    }),

  globs: z
    .array(z.object({ glob: z.string() }).loose())
    .default([])
    .describe(
      'Glob patterns matching URLs of pages that will be included in crawling. Setting this option allows you to customize the crawling scope. For example `https://{store,docs}.example.com/**` lets the crawler access all URLs starting with `https://store.example.com/` or `https://docs.example.com/`.',
    )
    .meta({
      title: 'Include URLs (globs)',
      ...apifyMeta({ editor: 'globs', sectionCaption: 'Crawler settings' }),
    }),

  excludes: z
    .array(z.object({ glob: z.string() }).loose())
    .default([])
    .describe(
      'Glob patterns matching URLs of pages that will be excluded from crawling. Note that this affects only links found on pages, but not Start URLs, which are always crawled.',
    )
    .meta({
      title: 'Exclude URLs (globs)',
      ...apifyMeta({ editor: 'globs' }),
    }),

  pseudoUrls: z
    .array(z.object({ purl: z.string().optional() }).loose())
    .default([])
    .describe(
      'Pseudo-URLs to match links in the page that you want to enqueue. Alternative to glob patterns. Combine with Link selector to tell the scraper where to find links.',
    )
    .meta({
      title: 'Pseudo-URLs',
      ...apifyMeta({ editor: 'pseudoUrls' }),
    }),

  linkSelector: z
    .string()
    .default('')
    .describe('CSS selector for links to enqueue. Leave empty to disable link enqueueing.')
    .meta({
      title: 'Link Selector',
      ...apifyMeta({ editor: 'textfield' }),
    }),

  keepUrlFragments: z
    .boolean()
    .default(false)
    .describe(
      'URL fragments (the parts of URL after a #) are not considered when the scraper determines whether a URL has already been visited. Turn this on to treat URLs with different fragments as different pages.',
    )
    .meta({ title: 'Keep URL fragments' }),

  respectRobotsTxtFile: z
    .boolean()
    .default(false)
    .describe(
      'If enabled, the crawler will consult the robots.txt file for each domain before crawling pages.',
    )
    .meta({ title: 'Respect robots.txt' }),

  initialCookies: z
    .array(z.unknown())
    .optional()
    .describe(initialCookiesDescription)
    .meta({
      title: 'Initial cookies',
      ...apifyMeta({ editor: 'json', prefill: [], isSecret: true }),
    }),

  customHttpHeaders: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'HTTP headers that will be added to all requests made by the crawler. This is useful for setting custom authentication headers or other headers required by the target website. The value is expected to be a JSON object with header names as keys and header values as values. For example: `{ "Authorization": "Bearer token123", "X-Custom-Header": "value" }`.',
    )
    .meta({
      title: 'Custom HTTP headers',
      ...apifyMeta({ editor: 'json', prefill: {} }),
    }),

  maxPagesPerCrawl: z
    .int()
    .min(0)
    .default(0)
    .describe(
      'Maximum pages to crawl. Includes start URLs and pagination pages. The crawler will automatically finish after reaching this number. 0 means unlimited.',
    )
    .meta({ title: 'Max pages' }),

  maxResultsPerCrawl: z
    .int()
    .min(0)
    .default(0)
    .describe(
      'Maximum number of results that will be saved to dataset. The scraper will terminate after reaching this number. 0 means unlimited.',
    )
    .meta({
      title: 'Max results',
      ...apifyMeta({ unit: 'results' }),
    }),

  maxCrawlingDepth: z
    .int()
    .min(0)
    .default(0)
    .describe(
      'Maximum link depth from Start URLs. Pages discovered further from start URLs than this limit will not be crawled. 0 means unlimited.',
    )
    .meta({ title: 'Max crawling depth' }),

  maxConcurrency: z
    .int()
    .min(1)
    .default(50)
    .describe(
      'Maximum number of browser pages running in parallel. This setting is useful to avoid overloading target websites and getting blocked.',
    )
    .meta({ title: 'Max concurrency' }),

  maxRequestRetries: z
    .int()
    .min(0)
    .default(3)
    .describe('Maximum number of retries for failed requests on network, proxy, or server errors.')
    .meta({ title: 'Max request retries' }),

  trafilaturaConfig: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'rs-trafilatura extraction settings. Leave empty for balanced defaults. Keys: fast, favorPrecision, favorRecall, includeComments, includeTables, includeImages, includeFormatting, includeLinks, deduplicate, targetLanguage, withMetadata, onlyWithMetadata, teiValidation.',
    )
    .meta({
      title: 'Trafilatura options',
      ...apifyMeta({ editor: 'json', sectionCaption: 'Content extraction' }),
    }),

  saveRawHtmlToKeyValueStore: z
    .boolean()
    .default(false)
    .describe(
      'If enabled, the crawler saves the raw HTML of all pages to the default key-value store and includes the URL link in the dataset output.',
    )
    .meta({
      title: 'Save raw HTML to key-value store',
      ...apifyMeta({ sectionCaption: 'Output settings' }),
    }),

  saveExtractedTextToKeyValueStore: z
    .boolean()
    .default(false)
    .describe(
      'If enabled, the crawler extracts plain text from all pages, saves it to the key-value store, and includes the URL link in the dataset output.',
    )
    .meta({ title: 'Save extracted text to key-value store' }),

  saveExtractedJsonToKeyValueStore: z
    .boolean()
    .default(false)
    .describe(
      'If enabled, the crawler extracts JSON with metadata from all pages, saves it to the key-value store, and includes the URL link in the dataset output.',
    )
    .meta({ title: 'Save extracted JSON to key-value store' }),

  saveExtractedMarkdownToKeyValueStore: z
    .boolean()
    .default(true)
    .describe(
      'If enabled, the crawler extracts Markdown from all pages, saves it to the key-value store, and includes the URL link in the dataset output.',
    )
    .meta({ title: 'Save extracted Markdown to key-value store' }),

  datasetName: z
    .string()
    .optional()
    .describe(
      'Name or ID of the dataset for storing results. Leave empty to use the default run dataset.',
    )
    .meta({
      title: 'Dataset name',
      ...apifyMeta({ editor: 'textfield' }),
    }),

  keyValueStoreName: z
    .string()
    .optional()
    .describe(
      'Name or ID of the key-value store for content files. Leave empty to use the default store.',
    )
    .meta({
      title: 'Key-value store name',
      ...apifyMeta({ editor: 'textfield' }),
    }),

  requestQueueName: z
    .string()
    .optional()
    .describe('Name of the request queue for pending URLs. Leave empty to use the default queue.')
    .meta({
      title: 'Request queue name',
      ...apifyMeta({ editor: 'textfield' }),
    }),

  proxyConfiguration: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Enables loading websites from IP addresses in specific geographies and to circumvent blocking.',
    )
    .meta({
      title: 'Proxy configuration',
      ...apifyMeta({ editor: 'proxy', sectionCaption: 'Proxy' }),
    }),

  proxyRotation: z
    .enum(['RECOMMENDED', 'PER_REQUEST', 'UNTIL_FAILURE'])
    .default('RECOMMENDED')
    .describe(
      'Proxy rotation strategy. RECOMMENDED automatically picks the best proxies. PER_REQUEST uses a new proxy for each request. UNTIL_FAILURE uses one proxy until it fails.',
    )
    .meta({
      title: 'Proxy rotation',
      ...apifyMeta({
        editor: 'select',
        enumTitles: ['Recommended', 'Rotate per request', 'Use until failure'],
      }),
    }),

  pageLoadTimeoutSecs: z
    .int()
    .min(1)
    .default(60)
    .describe('Maximum time to wait for page load in seconds')
    .meta({
      title: 'Page load timeout',
      ...apifyMeta({ unit: 'seconds', sectionCaption: 'Browser' }),
    }),

  waitUntil: z
    .enum(['NETWORKIDLE', 'LOAD', 'DOMCONTENTLOADED'])
    .default('LOAD')
    .describe('When to consider navigation finished')
    .meta({
      title: 'Navigation wait until',
      ...apifyMeta({
        editor: 'select',
        enumTitles: ['Network idle', 'Load event', 'DOM content loaded'],
      }),
    }),

  launcher: z
    .enum(['CHROMIUM', 'FIREFOX'])
    .default('CHROMIUM')
    .describe('Browser to use for crawling')
    .meta({
      title: 'Browser type',
      ...apifyMeta({ editor: 'select', enumTitles: ['Chromium', 'Firefox'] }),
    }),

  headless: z
    .boolean()
    .default(true)
    .describe('Run browser in headless mode')
    .meta({ title: 'Headless mode' }),

  ignoreCorsAndCsp: z
    .boolean()
    .default(false)
    .describe(
      'Ignore Content Security Policy and Cross-Origin Resource Sharing restrictions. Enables free XHR/Fetch requests from pages.',
    )
    .meta({ title: 'Ignore CORS and CSP' }),

  closeCookieModals: z
    .boolean()
    .default(true)
    .describe('Automatically dismiss cookie consent modals with Ghostery-based blocking.')
    .meta({ title: 'Close cookie modals' }),

  maxScrollHeightPixels: z
    .int()
    .min(0)
    .default(5000)
    .describe(
      'Maximum pixels to scroll down the page until all content is loaded. Setting to 0 disables scrolling.',
    )
    .meta({
      title: 'Max scroll height',
      ...apifyMeta({ unit: 'pixels' }),
    }),

  userAgent: z
    .string()
    .default('')
    .describe(
      'Custom User-Agent string for the browser. Leave empty to use the default browser User-Agent.',
    )
    .meta({
      title: 'User-Agent',
      ...apifyMeta({ editor: 'textfield' }),
    }),

  ignoreSslErrors: z
    .boolean()
    .default(false)
    .describe('Ignore SSL certificate errors. Use at your own risk.')
    .meta({ title: 'Ignore SSL errors' }),

  debugLog: z
    .boolean()
    .default(false)
    .describe('Include debug messages in the log output.')
    .meta({
      title: 'Debug log',
      ...apifyMeta({ sectionCaption: 'Diagnostics' }),
    }),

  browserLog: z
    .boolean()
    .default(false)
    .describe(
      'Include browser console messages in the log. May flood logs with errors at high concurrency.',
    )
    .meta({ title: 'Browser log' }),
});

export type ContextractorInputType = z.infer<typeof ContextractorInput>;
