do a ressearch, save the ressearch to `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-19-cli-proxy-config-consolidation/context/ressearch-consolidation-by-claude-code.md`

it seems there is redundant proxy configuration params. There is both `--proxy <url> ` and `--proxy-tier <tier>` and also `--proxy-tiers <json> `

Is it required to have both `--proxy <url> ` and `--proxy-tier <tier>`  ? would be better just one repeatable?
Also, is it required to have separate `--proxy-tiers <json> `? as there is already the `  -c, --config <path>                  Path to JSON config file`

suggestio: remove all the other config files, only keep `  -c, --config <path>                  Path to JSON config file` and ` --input-file <file>                  Read URLs (one per line) from a file`

Do deep ressearch, find out how other similar projects solves that. look around crawlee.dev community, apify community and other general best practices, industry standards. Read the "Tiered proxies" section of https://crawlee.dev/js/docs/guides/proxy-management#tiered-proxies . Look on https://crawlee.dev/ https://github.com/apify/crawlee

those are the arguments
```
Extract content from URLs and save to storage

Arguments:
  urls                                 URLs to extract content from

Options:
  --input-file <file>                  Read URLs (one per line) from a file
  --dataset <name>                     Route output to a named dataset (default: default)
  -c, --config <path>                  Path to JSON config file
  --clean                              Purge default storage before extracting (datasets, KVS, request queues)
  --max-pages <n>                      Max pages to crawl (0 = unlimited) (default: unlimited)
  --crawl-depth <n>                    Max link depth from start URLs (0 = start only) (default: unlimited)
  --headless                           Run browser in headless mode (default: true)
  --no-headless                        Run browser with UI
  --proxy <url>                        Proxy URL (repeatable) (default: [])
  --proxy-rotation <strategy>          Proxy rotation: recommended, per_request, until_failure
  --proxy-tier <tier>                  Proxy tier: comma-separated URLs for one tier, empty string for no-proxy tier (repeatable)
                                       (default: [])
  --proxy-tiers <json>                 Tiered proxy URLs as JSON (string|null)[][]
  --session-pool-name <name>           Named session pool for cross-run session sharing
  --max-session-rotations <n>          Max session rotations per request on block detection (default: 10)
  --crawler-type <type>                Crawler engine: adaptive, firefox, chromium, cheerio
  --rendering-detection-pct <n>        Rendering type detection percentage (adaptive only)
  --wait-until <event>                 Page load event: networkidle, load, domcontentloaded
  --page-load-timeout <secs>           Page load timeout in seconds (default: 60)
  --block-media                        Block images, stylesheets, fonts, PDFs, and ZIPs
  --no-block-media                     Do not block media requests (default)
  --ignore-cors                        Disable CORS/CSP restrictions
  --close-cookie-modals                Auto-dismiss cookie banners (default: true)
  --max-scroll-height <px>             Max scroll height in pixels
  --ignore-ssl-errors                  Skip SSL certificate verification
  --user-agent <ua>                    Custom User-Agent string
  --glob <pattern>                     Glob pattern to include (repeatable) (default: [])
  --exclude <pattern>                  Glob pattern to exclude (repeatable) (default: [])
  --link-selector <css>                CSS selector for links to follow
  --keep-url-fragments                 Preserve URL fragments
  --use-sitemaps                       Discover and enqueue URLs from sitemap.xml at each start URL domain root
  --respect-robots-txt                 Honor robots.txt
  --cookies <json>                     JSON array of cookie objects
  --headers <json>                     JSON object of custom HTTP headers
  --initial-concurrency <n>            Initial parallel requests (0 = Crawlee default)
  --max-concurrency <n>                Max parallel requests (default: 50)
  --max-retries <n>                    Max request retries (default: 3)
  --max-results <n>                    Max results per crawl (0 = unlimited) (default: unlimited)
  --save <format>                      Output format: markdown, txt, json, html, original, all (repeatable) (default: ["markdown"])
  --mode <mode>                        Extraction mode: precision (less noise), balanced (default), or recall (more content) (choices:
                                       "precision", "balanced", "recall", default: "balanced")
  --no-links                           Exclude links from output
  --no-comments                        Exclude comments from output
  --no-tables                          Exclude tables from output
  --images                             Include image alt text and captions
  --no-images                          Exclude image alt text and captions (default)
  --target-language <lang>             Filter by language (e.g. en)
  -v, --verbose                        Enable verbose logging
  --save-destination <dest>            Where to save: key-value-store|dataset (repeatable) (default: ["key-value-store"])
  --storage-dir <path>                 Override Crawlee storage directory
  --store-skipped-urls                 Push skipped URL records to the dataset after crawl
  --dynamic-content-wait <seconds>     Seconds to wait for network idle after navigation (0 = disabled)
  --wait-for-selector <selector>       CSS selector to wait for before extracting (fails on timeout)
  --soft-wait-for-selector <selector>  CSS selector to wait for before extracting (continues on timeout)
  --deduplication <level>              Deduplication level: minimal, basic (default), or full (choices: "minimal", "basic", "full")
  -h, --help                           display help for command
```