Usage: contextractor [options] [command] [urls...]

Extract web content from URLs using configurable extraction options.

Arguments:
  urls                                 URLs to extract content from

Options:
  -V, --version                        output the version number
  -c, --config <path>                  Path to JSON config file
  --start-url <url>                    Start URL (alternative to positional URL)
  -o, --output-dir <dir>               Output directory (default: ./output)
  --max-pages <n>                      Max pages to crawl (0 = unlimited)
  --crawl-depth <n>                    Max link depth from start URLs (0 = start only)
  --headless                           Run browser in headless mode
  --no-headless                        Run browser with UI
  --proxy-urls <urls>                  Comma-separated proxy URLs
  --proxy-rotation <strategy>          Proxy rotation: recommended, per_request,
                                       until_failure
  --crawler-type <type>                Crawler engine: adaptive, firefox, chromium,
                                       cheerio
  --rendering-detection-pct <n>        Rendering type detection percentage (adaptive
                                       only)
  --wait-until <event>                 Page load event: networkidle, load,
                                       domcontentloaded
  --page-load-timeout <secs>           Page load timeout in seconds
  --block-media                        Block images, stylesheets, fonts, PDFs, and ZIPs
  --no-block-media                     Do not block media requests (default)
  --ignore-cors                        Disable CORS/CSP restrictions
  --close-cookie-modals                Auto-dismiss cookie banners
  --max-scroll-height <px>             Max scroll height in pixels
  --ignore-ssl-errors                  Skip SSL certificate verification
  --user-agent <ua>                    Custom User-Agent string
  --globs <patterns>                   Comma-separated glob patterns to include
  --excludes <patterns>                Comma-separated glob patterns to exclude
  --link-selector <css>                CSS selector for links to follow
  --keep-url-fragments                 Preserve URL fragments
  --use-sitemaps                       Discover and enqueue URLs from sitemap.xml at
                                       each start URL domain root
  --respect-robots-txt                 Honor robots.txt
  --cookies <json>                     JSON array of cookie objects
  --headers <json>                     JSON object of custom HTTP headers
  --initial-concurrency <n>            Initial parallel requests (0 = Crawlee default)
  --max-concurrency <n>                Max parallel requests
  --max-retries <n>                    Max request retries
  --max-results <n>                    Max results per crawl (0 = unlimited)
  --save <formats>                     Output formats:
                                       markdown,html,txt,json,original,all
  --precision                          High precision mode (less noise)
  --recall                             High recall mode (more content)
  --fast                               Fast extraction mode (less thorough)
  --no-links                           Exclude links from output
  --no-comments                        Exclude comments from output
  --include-tables                     Include tables in output
  --no-tables                          Exclude tables from output
  --include-images                     Include image descriptions
  --include-formatting                 Preserve text formatting
  --no-formatting                      Drop text formatting
  --deduplicate                        Deduplicate extracted content
  --target-language <lang>             Filter by language (e.g. en)
  --with-metadata                      Extract metadata along with content
  --no-metadata                        Skip metadata extraction
  -v, --verbose                        Enable verbose logging
  --save-destination <dest>            Where to save: key-value-store|dataset
                                       (repeatable) (default: [])
  --storage-dir <path>                 Override Crawlee storage directory
  --store-skipped-urls                 Write skipped-urls.json to output dir after crawl
  --dynamic-content-wait <seconds>     Seconds to wait for network idle after navigation
                                       (0 = disabled)
  --wait-for-selector <selector>       CSS selector to wait for before extracting (fails
                                       on timeout)
  --soft-wait-for-selector <selector>  CSS selector to wait for before extracting
                                       (continues on timeout)
  --ignore-canonical-url               Disable canonical URL deduplication — extract
                                       every loaded URL even if its canonical was
                                       already extracted
  -h, --help                           display help for command

Commands:
  extract [options] [urls...]          Extract content from URLs and save to storage
  list [options] [dataset]             List items in a dataset
  get [options] <dataset> <index>      Get a single item from a dataset by 0-based index
  kvs                                  Key-value store operations
  purge [options]                      Purge default storage (or all storage with --all)
  storage-dir [options]                Print the resolved Crawlee storage directory and
                                       exit