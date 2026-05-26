import { z } from 'zod';
import { apifyMeta } from '../apify/apify-meta.js';

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

  crawlerType: z
    .enum(['playwright-adaptive', 'playwright-firefox', 'playwright-chromium', 'cheerio'])
    .default('playwright-adaptive')
    .describe(
      'Browser engine or HTTP client for crawling. playwright-adaptive automatically switches between browser and HTTP client per page. cheerio uses raw HTTP only (fastest, no JS).',
    )
    .meta({
      title: 'Crawler type',
      ...apifyMeta({
        sectionCaption: 'Crawler settings',
        editor: 'select',
        enumTitles: [
          'Adaptive switching (Recommended)',
          'Headless browser (Firefox+Playwright)',
          'Headless browser (Chromium+Playwright)',
          'Raw HTTP client (Cheerio)',
        ],
      }),
    }),

  renderingTypeDetectionPercentage: z
    .int()
    .min(0)
    .max(100)
    .default(10)
    .describe(
      '(Adaptive only) Percentage of pages on which the crawler runs a rendering-type detection probe. Higher values are more accurate but slower.',
    )
    .meta({ title: 'Rendering type detection', ...apifyMeta({ unit: '%' }) }),

  globs: z
    .array(z.object({ glob: z.string() }).loose())
    .default([])
    .describe(
      'Glob patterns matching URLs of pages that will be included in crawling. Setting this option allows you to customize the crawling scope. For example `https://{store,docs}.example.com/**` lets the crawler access all URLs starting with `https://store.example.com/` or `https://docs.example.com/`.',
    )
    .meta({
      title: 'Include URLs (globs)',
      ...apifyMeta({ editor: 'globs' }),
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

  useSitemaps: z
    .boolean()
    .default(false)
    .describe(
      'If enabled, the crawler looks for sitemap.xml at the root of each start URL domain and enqueues matching URLs from it in addition to link-following.',
    )
    .meta({ title: 'Use sitemaps' }),

  deduplication: z
    .enum(['none', 'url', 'content-hash'])
    .default('url')
    .describe(
      "Deduplication level applied on top of Crawlee's built-in URL deduplication. " +
        'url (default): skip pages whose <link rel="canonical"> was already extracted, across all handler types. ' +
        'content-hash: also skip pages whose extracted text content matches a previously extracted page. ' +
        "none: disable additional deduplication — only Crawlee's URL dedup remains active.",
    )
    .meta({
      title: 'Deduplication',
      ...apifyMeta({
        editor: 'select',
        enumTitles: [
          'None — URL only',
          'URL — canonical URL (default)',
          'Content hash — canonical URL + content hash',
        ],
      }),
    }),

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

  initialConcurrency: z
    .int()
    .min(0)
    .default(0)
    .describe(
      'Initial number of browser pages or HTTP clients running in parallel. Crawlee auto-scales up to maxConcurrency. 0 lets Crawlee pick the default.',
    )
    .meta({ title: 'Initial concurrency' }),

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

  mode: z
    .enum(['precision', 'balanced', 'recall'])
    .default('balanced')
    .describe(
      'Extraction mode. precision minimizes noise (may miss some content); recall maximizes content (may include noise); balanced is the default.',
    )
    .meta({
      title: 'Extraction mode',
      ...apifyMeta({
        editor: 'select',
        sectionCaption: 'Content extraction',
        enumTitles: ['Precision (less noise)', 'Balanced (default)', 'Recall (more content)'],
      }),
    }),

  includeComments: z
    .boolean()
    .default(true)
    .describe('Include HTML comments in the extracted text.')
    .meta({ title: 'Include comments', ...apifyMeta({ sectionCaption: 'Content extraction' }) }),

  includeTables: z
    .boolean()
    .default(true)
    .describe('Include table content in the extracted text.')
    .meta({ title: 'Include tables' }),

  includeImages: z
    .boolean()
    .default(false)
    .describe('Include image alt text and captions in the extracted text.')
    .meta({ title: 'Include images' }),

  includeLinks: z
    .boolean()
    .default(true)
    .describe('Include hyperlinks in the extracted text.')
    .meta({ title: 'Include links' }),

  targetLanguage: z
    .string()
    .default('')
    .describe(
      'Filter extracted content by language code (e.g. "en"). Leave empty to accept any language.',
    )
    .meta({ title: 'Target language', ...apifyMeta({ editor: 'textfield' }) }),

  save: z
    .array(z.enum(['txt', 'markdown', 'json', 'html', 'original']))
    .default(['markdown'])
    .describe(
      'Output formats to extract and save. "original" saves the raw page HTML before extraction.',
    )
    .meta({
      title: 'Save formats',
      ...apifyMeta({
        editor: 'select',
        sectionCaption: 'Output settings',
        enumTitles: ['Plain text', 'Markdown', 'JSON', 'HTML', 'Original HTML'],
      }),
    }),

  saveDestination: z
    .array(z.enum(['key-value-store', 'dataset']))
    .default(['key-value-store'])
    .describe('Where to save extracted content. Supported by both Actor and CLI.')
    .meta({
      title: 'Save to',
      ...apifyMeta({
        editor: 'select',
        enumTitles: ['Key-value store', 'Dataset'],
      }),
    }),

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

  storeSkippedUrls: z
    .boolean()
    .default(false)
    .describe(
      'If enabled, pushes a dataset record for each URL skipped during crawling (excluded by globs, robots.txt, depth limit, or concurrency cap). Can produce high record volume — enable for auditing only.',
    )
    .meta({ title: 'Store skipped URLs' }),

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
    .enum(['recommended', 'per-request', 'until-failure'])
    .default('recommended')
    .describe(
      'Proxy rotation strategy. recommended automatically picks the best proxies. per-request uses a new proxy for each request. until-failure uses one proxy until it fails.',
    )
    .meta({
      title: 'Proxy rotation',
      ...apifyMeta({
        editor: 'select',
        enumTitles: ['Recommended', 'Rotate per request', 'Use until failure'],
      }),
    }),

  tieredProxyUrls: z
    .array(z.array(z.string().url().nullable()).min(1))
    .min(1)
    .optional()
    .describe(
      'Tiered proxy URLs for automatic escalation. An array of tiers; each tier is a list of ' +
        'proxy URLs (or null for "no proxy"). Crawling starts on tier 0; Crawlee escalates a domain ' +
        'to a higher tier on block detection and probes lower tiers periodically to downshift. ' +
        'Takes precedence over a flat custom proxy list. Not combinable with useApifyProxy: true ' +
        'in proxyConfiguration.',
    )
    .meta({
      title: 'Tiered proxy URLs',
      ...apifyMeta({ editor: 'json', sectionCaption: 'Proxy', isSecret: true, prefill: [] }),
    }),

  tieredProxyConfig: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .optional()
    .describe(
      'Tiered Apify proxy configurations for automatic escalation. An array of Apify proxy ' +
        'configuration objects; Crawlee starts on tier 0 and escalates per domain on block detection. ' +
        'Each element accepts the same fields as proxyConfiguration (groups, countryCode, password, etc.) ' +
        'but not proxyUrls or tieredProxyUrls. Example: ' +
        '[{"groups":["RESIDENTIAL"]},{"groups":["DATACENTER"]}]. ' +
        'Takes precedence over tieredProxyUrls if both are set. Requires Apify Proxy access.',
    )
    .meta({
      title: 'Tiered Apify proxy config',
      ...apifyMeta({ editor: 'json', sectionCaption: 'Proxy', isSecret: true, prefill: [] }),
    }),

  sessionPoolName: z
    .string()
    .min(3)
    .max(200)
    .regex(/^[0-9A-Za-z_-]+$/)
    .optional()
    .describe(
      'Name for a persistent, shared session pool. Sessions (IP + cookies) are saved under this ' +
        'key and reused across Actor runs. Useful when proxies are frequently blocked — previously ' +
        'working sessions are preferred over random ones.',
    )
    .meta({
      title: 'Session pool name',
      ...apifyMeta({ editor: 'textfield', sectionCaption: 'Proxy' }),
    }),

  maxSessionRotations: z
    .int()
    .min(0)
    .max(20)
    .default(10)
    .describe(
      'Maximum number of session (IP + browser fingerprint) rotations per request on block ' +
        'detection. Independent of maxRequestRetries. Set to 0 to disable session rotation.',
    )
    .meta({
      title: 'Max session rotations',
      ...apifyMeta({ sectionCaption: 'Proxy' }),
    }),

  pageLoadTimeoutSecs: z
    .int()
    .min(1)
    .default(60)
    .describe('Maximum time to wait for page load in seconds')
    .meta({
      title: 'Page load timeout',
      ...apifyMeta({ unit: 'seconds', sectionCaption: 'Performance and limits' }),
    }),

  blockMedia: z
    .boolean()
    .default(false)
    .describe(
      'Block loading of images, stylesheets, fonts (.woff), PDFs, and ZIPs. Reduces bandwidth and speeds up crawling. Has no effect when using the raw HTTP crawler type or non-Chromium browsers (Chromium only).',
    )
    .meta({ title: 'Block media' }),

  waitForSelector: z
    .string()
    .default('')
    .describe(
      'Wait for this CSS selector to appear before extracting content. The request fails and is retried if the selector does not appear within the timeout. Leave empty to disable.',
    )
    .meta({ title: 'Wait for selector', ...apifyMeta({ editor: 'textfield' }) }),

  softWaitForSelector: z
    .string()
    .default('')
    .describe(
      'Wait for this CSS selector to appear before extracting content. Unlike waitForSelector, the request continues even if the selector does not appear within the timeout. Leave empty to disable.',
    )
    .meta({ title: 'Soft wait for selector', ...apifyMeta({ editor: 'textfield' }) }),

  dynamicContentWaitSecs: z
    .int()
    .min(0)
    .default(0)
    .describe(
      'Maximum seconds to wait for dynamic page content to load after navigation. The crawler continues when the network goes idle or this timeout elapses, whichever comes first. 0 disables this wait. Also used as the timeout for waitForSelector and softWaitForSelector.',
    )
    .meta({ title: 'Dynamic content wait', ...apifyMeta({ unit: 'seconds' }) }),

  waitUntil: z
    .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
    .default('load')
    .describe(
      'When to consider navigation finished. networkidle waits for 500ms of network silence (best for JS-heavy SPAs, slower); load waits for the load event (default, good for most articles); domcontentloaded is fastest but may fire before client-side rendering completes; commit fires when network response is received and the document has started loading.',
    )
    .meta({
      title: 'Navigation wait until',
      ...apifyMeta({
        editor: 'select',
        enumTitles: ['Load event', 'DOM content loaded', 'Network idle', 'Commit'],
        sectionCaption: 'Performance and limits',
      }),
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
});

export type ContextractorInputType = z.infer<typeof ContextractorInput>;
