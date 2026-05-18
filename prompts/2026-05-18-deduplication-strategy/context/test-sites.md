# Industry-Standard Test Sites for Web Scraper Deduplication

## TL;DR
- **Use scrapeme.live as your primary dedup testbed**, supplemented by **books.toscrape.com** and **quotes.toscrape.com**. scrapeme.live is the only widely-adopted public sandbox that natively covers all three dedup scenarios (near-duplicates via http/https + query params, same product under multiple category AND tag URLs, and tracking-param variants), because it is a real WooCommerce instance.
- **books.toscrape.com and quotes.toscrape.com (the Zyte/Scrapinghub "toscrape" pair) are the undisputed de-facto standards** referenced in the official Scrapy tutorial, Apify Academy, Crawlee examples, and thousands of blog posts. Both ignore arbitrary query parameters (returning identical content with `?utm_source=...`, `?sessionid=...`, etc.) and both serve via http and https with no redirect — perfect for canonical/tracking-param dedup tests. Their weakness is that books.toscrape.com does NOT place the same item under multiple categories.
- **Both stacks work everywhere**: all three sites are static HTML that Trafilatura/HTTP scrapers handle directly, and they also render correctly in Playwright. quotes.toscrape.com additionally exposes `/js`, `/js-delayed`, and `/scroll` endpoints for browser-only paths, and scrapeme.live emits a `rel=canonical` tag so you can also test honoring vs. ignoring canonicals.

## Key Findings

**The "toscrape" sandbox (books.toscrape.com + quotes.toscrape.com) is the canonical scraper-test target.** It is what the Scrapy official tutorial uses ("We are going to scrape quotes.toscrape.com, a website that lists quotes from famous authors"), what the Apify Academy and Crawlee blog reference, and what every BeautifulSoup/Scrapy/Playwright tutorial since the domain's registration on June 28, 2016 (per WHOIS, Registry Domain ID 2038149596_DOMAIN_COM-VRSN) has built on. The umbrella site at toscrape.com explicitly describes books.toscrape.com as "A fictional bookstore that desperately wants to be scraped. It's a safe place for beginners learning web scraping and for developers validating their scraping technologies as well."

**scrapeme.live/shop is the second-tier industry standard** — a real, intentionally-public WooCommerce Pokémon shop whose own pagination banner reads "Showing 1–16 of 755 results", used in Rust/Go/Python tutorials by ScrapeHero, Gkomninos (Scrapemate), SelectorLib, and many GitHub repos. Because it is real WooCommerce, it inherits all the URL-duplication pathologies of WordPress/Woo: category URLs, tag URLs, query-param permalinks, pagination duplicates, and product-page tracking variants.

**scrapethissite.com and webscraper.io/test-sites are widely used but weaker for dedup.** scrapethissite.com targets pagination/forms/AJAX exercises (its sandbox link list is the "Hockey Teams: Forms, Searching and Pagination", "Oscar Winning Films: AJAX and JavaScript", "Countries of the World" trio). webscraper.io/test-sites/e-commerce/{static,allinone,more,scroll} is the standard target for the Web Scraper Chrome extension and is heavily used in Apify and Web Scraper tutorials — but its categories don't share items, so it does not exercise duplicate-listing logic.

**httpbin.org and the-internet.herokuapp.com are not dedup testbeds.** httpbin.org is an HTTP semantics fixture (status codes, headers, redirects, cache headers — `/cache`, `/etag/:etag`, `/cache/:n`); use it for HTTP-level edge cases but not for URL-level deduplication. the-internet.herokuapp.com (Sauce Labs' "The Internet") is a browser-automation fixture (dynamic loading, redirects, JS challenges) — useful for Playwright robustness, but its `/redirect` endpoint is the only dedup-adjacent feature and it does not model category/tag overlap.

## Details

### Coverage matrix

| Site | Scenario 1: Canonical/protocol variants | Scenario 2: Same item under multiple category/tag/page URLs | Scenario 3: Tracking-param / session-id | Works for Trafilatura (HTTP)? | Works for Playwright? | Community adoption |
|---|---|---|---|---|---|---|
| **scrapeme.live/shop** | ✅ http+https both serve; `rel=canonical` emitted on product pages | ✅ Each product belongs to 2 categories + 3 tags + appears on multiple paginated listing pages | ✅ Arbitrary `?utm_*`, `?ref=`, `?sessionid=` ignored — identical product content returned | ✅ Static HTML | ✅ Yes | High (Rust/Go/Python tutorials, ScrapeHero, SelectorLib) |
| **books.toscrape.com** | ✅ http+https both serve, no redirect; index.html and `/` both work | ⚠️ Each book is in exactly ONE category — no category overlap. But the *site itself* is reachable as `/index.html` and `/`, and `catalogue/` paths often overlap with `catalogue/category/...` listings | ✅ Verified: `?utm_source=...&ref=...`, `?sessionid=abc123` all return byte-identical product pages | ✅ | ✅ | Highest (Scrapy tutorial, Apify, Firecrawl, Browserbase docs) |
| **quotes.toscrape.com** | ✅ http+https; `/` and `/page/1/` are duplicates of each other | ✅ Each quote appears under multiple `/tag/<tag>/` pages (e.g., the Einstein change/world quote appears under `/tag/change/`, `/tag/world/`, `/tag/thinking/`, `/tag/deep-thoughts/`) AND on the main pagination. Authors also dedupe across quotes (the Scrapy docs themselves cite this as the canonical dedup-filter example) | ✅ Verified: `?utm_source=twitter&utm_campaign=test`, `?sessionid=xyz` return identical content | ✅ | ✅ + `/js` and `/scroll` endpoints | Highest (Scrapy official tutorial uses this exact site) |
| scrapethissite.com | Partial (pagination only) | ❌ | ❌ | ✅ | ✅ | Medium |
| webscraper.io/test-sites | Pagination + load-more + scroll variants | ❌ Categories are disjoint | ❌ | ✅ | ✅ | High in Web Scraper extension community |
| httpbin.org | N/A (HTTP semantics, not content dedup) | ❌ | N/A | ✅ | ✅ | High but different purpose |
| the-internet.herokuapp.com | `/redirect` only | ❌ | ❌ | Partial (many JS pages) | ✅ | High for QA automation, low for scraping |

### Concrete URL patterns that trigger each scenario

**Scenario 1 — Near-duplicate pages (same content, different URLs):**

On **books.toscrape.com** all of these return the same homepage HTML:
- `http://books.toscrape.com/`
- `https://books.toscrape.com/`
- `https://books.toscrape.com/index.html`

On **scrapeme.live** the Bulbasaur product page is served identically at:
- `https://scrapeme.live/shop/Bulbasaur/`
- `http://scrapeme.live/shop/Bulbasaur/`
- and the page emits `<link rel="canonical" href="https://scrapeme.live/shop/Bulbasaur/">` — so you can simultaneously test (a) dedup that respects canonical tags and (b) dedup that ignores them.

**Scenario 2 — Same item under multiple listing pages:**

On **quotes.toscrape.com**, the Einstein quote with tags `change, deep-thoughts, thinking, world` is reachable on all of:
- `https://quotes.toscrape.com/page/1/`
- `https://quotes.toscrape.com/tag/change/page/1/`
- `https://quotes.toscrape.com/tag/world/page/1/`
- `https://quotes.toscrape.com/tag/thinking/page/1/`
- `https://quotes.toscrape.com/tag/deep-thoughts/page/1/`

Additionally, the Scrapy docs explicitly call out the author-page dedup behavior: "even if there are many quotes from the same author, we don't need to worry about visiting the same author page multiple times. By default, Scrapy filters out duplicated requests to URLs already visited."

On **scrapeme.live**, direct fetches confirmed that the Bulbasaur product page metadata block reads "SKU: 4391 Categories: Pokemon, Seed Tags: bulbasaur, Overgrow, Seed" — meaning Bulbasaur appears in listings at:
- `https://scrapeme.live/product-category/pokemon/`
- `https://scrapeme.live/product-category/seed/`
- `https://scrapeme.live/product-tag/bulbasaur/`
- `https://scrapeme.live/product-tag/overgrow/`
- `https://scrapeme.live/product-tag/seed/`
- plus the unfiltered shop pagination `https://scrapeme.live/shop/`, `https://scrapeme.live/shop/page/2/`, etc.

That's 6+ listing URLs all referencing the same single product detail page — exactly the duplicate-listings pathology your dedup logic needs to handle.

**Scenario 3 — Tracking params / session IDs:**

Verified by direct fetches:
- `https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html` and `...index.html?utm_source=newsletter&ref=email` and `...index.html?sessionid=abc123` all return byte-identical HTML (title "A Light in the Attic", price £51.77, UPC a897fe39b1053632). Notably, the page sends `meta-robots: NOARCHIVE,NOCACHE` but ships **no** `rel=canonical` tag, so your dedup must rely on URL normalization.
- `https://quotes.toscrape.com/` and `https://quotes.toscrape.com/?utm_source=twitter&utm_campaign=test` and `https://quotes.toscrape.com/page/1/?sessionid=xyz` all return the same 10 quotes in the same order.
- `https://scrapeme.live/shop/Bulbasaur/` and `https://scrapeme.live/shop/Bulbasaur/?utm_source=test` return identical primary content (price £63.00, 45 in stock, SKU 4391); only the randomized "Related products" carousel changes — a useful gotcha for content-hash–based dedup.

### Why this set works for both stacks

Crawlee + Playwright in TypeScript will navigate, render, and intercept normally on all three sites. Trafilatura (an HTML-text-extraction library that operates on already-fetched HTML or its built-in HTTP client) will work because all three sites serve complete static HTML for the URL patterns above — no JavaScript is required to read the listing pages, tag pages, category pages, or product pages. The exceptions you should know:
- `https://quotes.toscrape.com/js/`, `/js-delayed/`, and `/scroll` require JS — use these specifically when you want a Playwright-only path.
- scrapeme.live is WordPress/Woo, which means its HTML is heavier and slower to parse, but still fully server-rendered.

### Adoption signals

- **books.toscrape.com / quotes.toscrape.com**: cited in the official Scrapy tutorial (docs.scrapy.org/en/latest/intro/tutorial.html), the umbrella toscrape.com page, scrapinghub's official sample-projects repo at github.com/scrapinghub/sample-projects/tree/master/quotes_crawler (which ships `toscrape-css`, `toscrape-xpath`, `toscrape-selenium`, `toscrape-infinite-scrolling`, and `toscrape-csrf-login-v1`/`v2` spiders), Browserbase docs, Firecrawl tutorials, Apify Academy lessons, Crawlee blog posts on infinite scroll, and the Scrapy default `DOWNLOAD_SLOTS` example in docs.scrapy.org/en/latest/topics/settings.html which sets `"quotes.toscrape.com": {"concurrency": 1, "delay": 2, "randomize_delay": False}, "books.toscrape.com": {"delay": 3, "randomize_delay": False}`.
- **scrapeme.live**: tutorials in Rust (ScrapeHero), Go (Gkomninos / Scrapemate), Python (Tom's Tech Academy, SelectorLib), plus dozens of GitHub repos. The site's own README markets it as a scraping playground.
- **webscraper.io/test-sites**: the canonical target for the Web Scraper Chrome extension; used in Apify and Oxylabs tutorials but not by Scrapy/Crawlee documentation directly.

## Recommendations

**Stage 1 — Build your dedup unit tests against the toscrape pair (one weekend):**
1. **Scenario 1 (canonical variants)** → hit `http://`, `https://`, `/`, `/index.html`, and `/index.html?utm_source=x` on books.toscrape.com. Assert your dedup key collapses all five to one.
2. **Scenario 2 (multi-listing dedup)** → crawl `https://quotes.toscrape.com/` plus all `/tag/<tag>/` pages and assert that each unique quote (text + author) appears exactly once in your output. The Einstein change/world quote is the canary — it shows up under at least four tag pages plus the main pagination.
3. **Scenario 3 (tracking params)** → fetch the same quotes.toscrape.com or books.toscrape.com URL with `?utm_source`, `?utm_campaign`, `?sessionid`, `?ref`, `?fbclid`, `?gclid` and assert all collapse to the same canonical key.

**Stage 2 — Promote to scrapeme.live for realistic e-commerce dedup (1–2 days):**
Once stage-1 tests pass, run the same crawler against `https://scrapeme.live/shop/`. This forces your dedup logic to handle real-world WooCommerce pathology: each product on 2 category pages + 3 tag pages + N paginated listing pages + tracking-param variants + a `rel=canonical` tag you may choose to respect. **Benchmark**: the site has 755 products (per its own "Showing 1–16 of 755 results" banner); if your dedup is correct, your final dataset should contain exactly 755 unique product records regardless of the crawl entry point (start from `/shop/`, from `/product-category/pokemon/`, or from a tag — the count should match).

**Stage 3 — Optional reinforcement:**
- Use `webscraper.io/test-sites/e-commerce/scroll` and `/load-more` to confirm dedup also holds under JS-driven pagination in Playwright.
- Use `httpbin.org/redirect-to?url=...` and `/cache` to verify your HTTP-layer dedup handles redirect chains and conditional GETs.
- Use `quotes.toscrape.com/js/` and `/scroll` to validate the Playwright-only branch of your Crawlee setup against the same dedup expectations as the static `/` path.

**Thresholds that should change the plan:**
- If your dedup fails on scrapeme.live but passes on the toscrape pair → your URL normalization is fine but your *content fingerprinting* (cross-URL same-item detection) is missing; add a content-hash or product-ID-based dedup layer.
- If you need to test dedup against URL fragments, hash params, or POST-body identity, none of these public sites cover it — spin up your own httpbin or a small Express fixture for that.
- If rate limits become an issue (scrapeme.live is on a real WooCommerce host), respect a 2–3 s delay per the Scrapy 2.15.2 docs' recommended `DOWNLOAD_SLOTS` example which explicitly slots `books.toscrape.com` at `delay: 3`.

## Caveats

- **books.toscrape.com does NOT have category overlap.** Each book belongs to exactly one category. So while it is the most-cited scraper test site in the world and ideal for scenarios 1 and 3, you cannot test scenario 2 (same item under multiple categories) on it. This is why scrapeme.live is necessary as a supplement.
- **None of these sites perfectly model malicious tracking-param redirection.** They all simply *ignore* unknown query parameters and return the same content — which is exactly what you want for dedup-key testing but does not stress-test redirect chains. For redirect-based tracking testing, layer in httpbin.org/redirect-to.
- **scrapeme.live emits a `rel=canonical` tag on product pages**, which is realistic but means your dedup logic decision (honor canonical vs. URL-normalize vs. content-fingerprint) becomes visible. Decide your policy explicitly.
- **books.toscrape.com ships no `rel=canonical` tag on its product pages** — confirmed by direct fetch — so dedup there must rely on URL normalization, not canonical-tag honoring. This is a useful asymmetry to test against scrapeme.live.
- **All three primary sites are operated by third parties** (Zyte/Scrapinghub for toscrape.com, an independent maintainer for scrapeme.live). toscrape.com has been continuously running since June 28, 2016 — nearly 10 years as of May 2026, per WHOIS (Registrar: Amazon Registrar, Inc.) — but is not under SLA. For long-term CI, mirror them locally with `wget --mirror` or run scrapeme.live's WooCommerce locally.
- **The Scrapy official-tutorial mention of dedup is a *request* dedup filter**, not a content dedup — it deduplicates by URL only via `DUPEFILTER_CLASS`. Your need (cross-URL content dedup) requires extra logic on top of whatever Crawlee's request-queue dedup gives you.
- **Apify Academy's JS-track exercise targets wtatennis.com**, a real production site that may change. Don't depend on real production sites for CI dedup tests.
