# Should Contextractor Build an MCP Server?

_Strategic assessment — 2026-06-01_

---

## Bottom line

Build it, but build the local stdio version first and keep it small. The case is conditional.

**Yes, build it when:** your goal is to own the "zero-cost, npm-installable, Playwright-backed, trafilatura-quality extraction" niche, which is genuinely underserved. No incumbent in that intersection has a first-party, quality-focused MCP server today.

**No, or defer, when:** your goal is to compete head-on with hosted APIs (Firecrawl, Apify, Jina). That lane is saturated, and a cold-start hosted offering without proxy infrastructure, anti-bot bypass, or a substantial free tier will not gain traction.

**The honest framing:** this is mostly redundant for users who already have a Firecrawl subscription or are happy with Jina Reader's free tier. It is meaningfully differentiated for users who want extraction quality better than "HTML minus nav bars" — content never leaving their machine, no credit burn, and JS rendering — all in one `npx` command. That audience exists and is growing, but it is not large enough to justify a heavyweight investment. An MVP is low-effort and high-signal; the Apify Standby Actor path is secondary.

---

## 1. Can Claude already crawl the web — and where does it fall short?

### What Claude can do natively

Claude has two distinct web-access surfaces that work differently and are frequently confused.

**Claude Code's built-in WebFetch** fetches pages locally from the user's machine via Axios (a plain HTTP client), converts the HTML to Markdown via Turndown, then passes the result plus a required user-supplied prompt to a secondary Claude Haiku conversation. The main model receives only Haiku's summarized answer — not the raw page content. There is one fast-path exception: if the target domain is on a trusted-domain whitelist, the server responds with `Content-Type: text/markdown`, and the content is under 100 KB, Haiku is skipped and raw Markdown is returned directly. This fast-path is the exception, not the rule.

**Anthropic's API-level `web_fetch` tool** (`web_fetch_20250910` / `web_fetch_20260209`) is fundamentally different: it runs server-side, returns the full document as a content block directly into the main model's context (no intermediary model), supports PDF extraction, has configurable `max_content_tokens`, and a newer dynamic-filtering mode where Claude can write code to post-process fetched HTML before context insertion.

**Claude.ai's consumer web search** is Bing-powered, globally available in 159+ countries, returns cited synthesis rather than raw content, and counts against daily message limits.

### Confirmed gaps in both surfaces

Every gap below is confirmed by official Anthropic documentation and/or reproducible GitHub issues.

**JavaScript rendering.** Neither WebFetch nor the API `web_fetch` tool executes JavaScript. SPAs and React/Vue apps return an empty shell or raw JS/CSS assets. This is explicitly acknowledged in official API docs: "The web fetch tool currently does not support websites dynamically rendered with JavaScript." This is the single largest structural gap.

**Anti-bot bypass.** Claude Code's WebFetch makes a domain-safety preflight call to `claude.ai` before every fetch; in headless/CI/WSL environments, Cloudflare returns HTTP 403, making every WebFetch call fail regardless of the target URL (GitHub issue #39896, unresolved). There is no proxy rotation, no stealth mode, and no Cloudflare bypass in either surface.

**Authentication.** WebFetch makes anonymous GET requests only. Pages behind login (Google Docs, Confluence, Notion, paywalled content) always fail.

**Content truncation.** WebFetch has a hard ceiling of roughly 100 KB of Markdown text; large documentation pages are silently cut mid-sentence. A confirmed high-priority GitHub issue (#22937) shows a 15,858-line Firebase documentation page truncated before 50% of its content, marked as affecting "critical information."

**Multi-page crawling.** Both surfaces are single-URL, single-call tools. Cross-host redirects require an explicit second call. There is no link-following, pagination support, or crawl queue.

**Structured output.** Neither surface produces JSON, avoids boilerplate, or classifies page types. Both return Markdown or raw text; extraction quality is whatever Turndown produces from the unfiltered HTML.

**Platform availability.** The API `web_search` tool is not available on Amazon Bedrock; `web_fetch` is not available on Bedrock or Vertex AI.

**The upshot:** Claude's native fetch is adequate for fetching static, publicly accessible documentation pages when the answer fits in a few sentences and the domain is not bot-protected. It is inadequate for JS-heavy sites, authenticated pages, bulk extraction, or any scenario where the caller needs clean main-content rather than a model-summarized snippet.

---

## 2. Is Apify Website Content Crawler used through an MCP server?

### Short answer

Yes, WCC is accessible via MCP, but only through Apify's generic shared platform infrastructure — not a dedicated server. The actor Apify positions for real-time MCP agent use is `apify/rag-web-browser`, not WCC.

### How WCC is reached via MCP

Every actor on the Apify platform, including WCC, has an `/api/mcp` sub-page that generates a ready-to-use configuration pointing to `mcp.apify.com` with a `?tools=` pin. For WCC, the config is:

```json
{
  "command": "npx",
  "args": [
    "mcp-remote",
    "https://mcp.apify.com/?tools=apify/website-content-crawler",
    "--header",
    "Authorization: Bearer <YOUR_API_TOKEN>"
  ]
}
```

This is a platform-wide feature, not a bespoke WCC server. It functions identically for any of Apify's 6,000+ actors.

WCC is also reachable through the generic `call-actor` tool (actors category in the Apify MCP server), which accepts any actor ID. MCP clients supporting dynamic tool discovery (Claude.ai web, VS Code) get `add-actor` instead of `call-actor`; both handle WCC.

### Output is not inline — WCC requires two calls

When `call-actor` runs WCC, the MCP response contains run metadata, storage identifiers (including a `datasetId`), a summary, and a `nextStep` hint. The actual extracted content is not in the response. The agent must make a second call to `get-dataset-items` passing the returned `datasetId`. There is a partial inline preview for small outputs, but for any non-trivial crawl the two-step pattern is mandatory.

This makes WCC poorly suited to interactive agent loops. Running a crawl, waiting up to 45 seconds (the `waitSecs` maximum), then retrieving a dataset is a latency pattern that will frequently time out or break agentic reasoning.

### The dedicated MCP package for an Apify actor: rag-web-browser, now deprecated

The only dedicated first-party MCP package Apify ever published for a specific actor was `@apify/mcp-server-rag-web-browser`. It was archived and marked read-only on 2026-05-19, with the README explicitly directing users to `mcp.apify.com` instead. Both WCC and rag-web-browser now share the same `mcp.apify.com` infrastructure.

### Why rag-web-browser, not WCC, is the default agent tool

The Apify MCP server's default tool set (loaded when no `?tools=` parameter is specified) is: the `actors` category, the `docs` category, and `apify/rag-web-browser` as a named actor. WCC is not in the defaults.

rag-web-browser is architecturally suited for agent loops in a way WCC is not. It runs in Standby mode (persistent HTTP server, warm container), accepts a URL or search query, and returns cleaned Markdown inline in a single call. WCC is a run-to-completion batch actor whose output lives in a dataset.

Apify's own documentation explicitly states: "For single-URL extraction, RAG Web Browser in Standby mode is much faster and more efficient." Their internal architecture guide contrasts them directly: WCC for scheduled, domain-wide batch content collection; rag-web-browser for live, on-demand agent queries.

**rag-web-browser is not built on WCC.** It is an independent actor using Crawlee, Playwright, Mozilla Readability, and Turndown — a stack similar to Contextractor's but without trafilatura as the extraction engine.

---

## 3. The web-content MCP landscape

The "give an LLM clean web content as Markdown" MCP category is crowded. Three tiers exist:

### Tier 1 — Lightweight fetch utilities (free, no infrastructure)

**Official MCP Fetch server** (modelcontextprotocol/servers): ~600k monthly PyPI downloads. Python-based, stdio, no API key. Returns Markdown via markdownify. Has an unpatched SSRF vulnerability (CVE-2025-65513, CVSS 9.3). Best for simple static-page fetching.

**Jina Reader MCP**: Free unauthenticated tier at `mcp.jina.ai/v1`, with a 10 RPM limit. Uses Mozilla Readability under the hood (confirmed by independent analysis). No API key needed at low volumes. 1M tokens free with a free account. Jina AI was acquired by Elastic in October 2025.

**zcaceres/fetch-mcp**: ~770 stars, Playwright-backed, local, free. A reasonable middle ground but not well-maintained as a first-party product.

### Tier 2 — Production scraping platforms (paid, hosted)

**Firecrawl**: 6.4k stars on the MCP server, 100k+ on the core repo. The de facto paid SaaS standard for LLM-ready Markdown. Returns clean Markdown (default), JSON, screenshots. Hobby tier: $16/month for 3,000 credits; AI Extract is a separate $89+/month subscription. Self-hosted version is widely reported as buggy and inferior to the cloud version.

**Tavily**: 2.1k stars. Positioned as AI research search rather than pure scraping. Free tier: 1,000 credits/month. Only 38% web search success rate in independent benchmarks.

**Exa**: 4.5k stars. Neural/semantic search with page content extraction. Repriced in March 2026 to include page contents with search queries.

**ScrapeGraphAI**: 78 MCP-server stars, 20k+ on the core library. Remote hosted at a Render URL. Credit-based pricing.

**Apify MCP**: 1.3k stars. Gives access to 6,000+ actors including rag-web-browser and WCC. Free tier: $5/month platform credit.

### Tier 3 — Proxy-backed infrastructure (paid, enterprise)

**Bright Data**: 2.4k stars. The only server that scored 100% on web search and extraction in independent task-completion benchmarks (AIMultiple). Free tier: 5k requests/month (Markdown only). Pro mode adds browser control and 60+ specialized tools.

**Oxylabs**: 85.82% task success rate in Proxyway benchmarks, rated "most powerful AI-based tools on the list." Enterprise pricing.

**Decodo** (formerly Smartproxy): 30 stars but 87.09% success rate and 15.22s response time in Proxyway benchmarks (fastest of proxied providers). Free tier: 2k requests.

### Tier 4 — Open-source self-hosted alternatives

**Crawl4AI**: 62,000+ stars on the core library. Multiple community MCP wrappers explicitly describe it as "Firecrawl but free and self-hosted." Built-in MCP support added in v0.8+. Returns "Fit Markdown" with heuristic noise filtering. No hosted SaaS URL — requires Docker self-hosting. Does not use trafilatura.

**Microsoft Playwright MCP**: 33k stars, #1 on PulseMCP overall. Frequently appears in web-content comparisons but is categorically different — it returns an accessibility-tree snapshot for browser automation, not clean article text. Not a content-extraction competitor.

### The niche assessment

The low end (simple HTTP fetch to Markdown) is completely saturated. The high end (Playwright plus enterprise anti-bot bypass) is dominated by well-funded paid clouds. The middle — Playwright rendering combined with research-grade boilerplate removal, installable via npm, zero cost per extraction — has no dominant first-party open-source product as of mid-2026.

---

## 4. Where Contextractor could differentiate (or not)

### Real differentiators

**Extraction quality.** rs-trafilatura achieves F1 0.966 on the ScrapingHub article benchmark, outperforming Python trafilatura (0.958), go-trafilatura (0.960), and all Readability variants (approximately 0.943). Jina Reader uses Mozilla Readability under the hood. Crawl4AI does not use trafilatura. Firecrawl does not use trafilatura. This is a genuine, measurable advantage for article and long-form content — not a marginal one.

**Speed.** rs-trafilatura runs in 2–10ms per page on CPU. Jina's ReaderLM-v2 requires a minimum T4 GPU and runs at approximately 36 tokens/second output. The speed differential is orders of magnitude, and the absence of GPU requirements is a real advantage for local use.

**Page-type classification.** rs-trafilatura classifies pages into seven types (article, forum, product, collection, listing, documentation, service) and applies per-type extraction profiles. No other open-source local extractor offers this capability. Multi-type benchmark F1 is 0.893.

**Local / no-API-key / no-per-call-cost.** Every major incumbent is a paid hosted API. Firecrawl's credits are expensive relative to extraction volume (AI Extract add-on is $89+/month beyond the base plan; credit multipliers make real cost 5–7x the headline numbers). Self-hosting Firecrawl is widely reported as buggy and unreliable. The "content never leaves your machine" property is meaningful for privacy-conscious RAG pipelines and developer workflows.

**Playwright + trafilatura in one package.** Trafilatura's one acknowledged structural weakness is that it operates on static HTML — it cannot handle JS-rendered content on its own. Contextractor's Crawlee+Playwright layer directly addresses this. No other free/local MCP server combines Playwright rendering with trafilatura-grade main-content filtering in a single npm-installable package.

### Weak or contested differentiators

**"No API key required."** Crawl4AI already occupies this position with 62,000+ stars and active community MCP wrappers. The claim is true but not unique.

**Open-source.** Crawl4AI, fetcher-mcp, and the official Fetch MCP are all open-source. Not a standalone differentiator.

**Multi-format output (txt/markdown/json/html).** Firecrawl and Bright Data already offer Markdown and JSON. The structured JSON output is a mild differentiator but not a strong one.

### Where Contextractor is not differentiated

- Anti-bot bypass and proxy rotation: entirely absent; Bright Data, Oxylabs, and Decodo dominate here
- Search integration: Tavily, Exa, and Jina all offer search + extraction; Contextractor is extract-only
- Enterprise SLA, monitoring, or analytics: not in scope
- Apify-hosted version competing against Apify's own rag-web-browser: Apify promotes its own actor first; Contextractor on Apify is an upstream-sourced competitor, not a flagship offering on that platform

---

## 5. Recommendation

### Decision matrix

| Scenario | Recommendation |
|---|---|
| Build local stdio MCP server (npm/npx, no cloud) | **Build it** — low effort, fills a real gap |
| Build Apify Standby Actor as MCP server | **Build it** — infrastructure already exists; monetize per-event |
| Build a standalone hosted cloud API to compete with Firecrawl | **Skip** — saturated, capital-intensive, not the team's advantage |
| Build first and optimize for anti-bot/proxy use cases | **Skip** — wrong axis; Bright Data has this locked |

### Which route carries the value

**Route 1 — Local stdio npm package.** This is the highest-value, lowest-effort option. An `npx contextractor-mcp` that exposes a single `extract_url` tool (URL in, clean Markdown/JSON out) addresses the real gap: developers who want Firecrawl quality without Firecrawl's credit burn, in a `claude_desktop_config.json` entry that takes 30 seconds to install. This is the MVP.

**Route 2 — Apify Standby Actor as MCP server.** The `webServerMcpPath` + `usesStandbyMode: true` pattern in `actor.json` is already built infrastructure. Adding an MCP endpoint to the existing Contextractor Actor is low incremental effort and enables pay-per-event monetization (`Actor.charge({ eventName: 'tool-request' })`). This also addresses the latency problem WCC has in agent loops — Standby mode keeps the container warm, eliminating cold-start delay.

**Route 3 — Streamable HTTP standalone server.** This is the right architecture for self-hosting at scale, but it requires users to run a server, which adds friction compared to stdio. Ship it as a secondary option, not the MVP.

### What the MVP should be

A local stdio MCP server (`contextractor-mcp`) that:
- Exposes one tool: `extract_url(url: string, format?: "markdown" | "txt" | "json" | "html") -> string`
- Wraps the existing extraction pipeline (Crawlee adaptive crawler + rs-trafilatura)
- Installs via `npx contextractor-mcp` with no API key, no account creation, no credits
- Includes a one-paragraph `README` section showing the Claude Desktop config block
- Ships as an npm package with the existing `.node` prebuild bundled

The tool's description in the MCP schema should mention "trafilatura-quality boilerplate removal" and "JavaScript rendering via Playwright" because those are the claims that differentiate it from the simple fetch utilities in the same category.

### What would make it not worth building

- If Crawl4AI ships a first-party, quality-maintained MCP server with built-in Playwright + aggressive noise filtering before this ships, the local-free lane becomes fully occupied
- If Anthropic adds JS rendering to `web_fetch` (they have an active dynamic-filtering mode; JS execution is the next logical step), the primary gap narrows significantly
- If the team's roadmap cannot accommodate maintaining an npm package and its update cadence — a stale MCP server accumulates CVEs faster than a stale web scraper

---

## Confidence and open questions

**High confidence:**
- Claude Code WebFetch does not execute JavaScript; this will not change soon (GitHub issue closed as "not planned")
- WCC has no dedicated MCP server package and is architecturally unsuited to inline agent calls
- rs-trafilatura's F1 benchmark score is from the actor's own README and corroborated by the upstream trafilatura evaluation page; the comparison is fair but limited to the ScrapingHub article benchmark (one domain type)
- Firecrawl's self-hosted version being unreliable is widely reported but not from a single authoritative source

**Medium confidence:**
- Crawl4AI's built-in MCP support (v0.8+) is documented but the quality of its MCP packaging as a first-party product (versus community wrappers) is not fully assessed here
- The "no dominant player in the quality+local intersection" claim is based on registry searches and published comparisons as of mid-2026; the category moves fast
- Proxyway and AIMultiple benchmark methodologies are not independently verified

**Open questions:**
- Does Contextractor's Playwright crawler already handle the JS-rendering step reliably enough for the MCP use case (single-URL, latency-sensitive) vs its current batch-crawl optimization?
- What is the actual cold-start latency of the Apify Standby Actor with the current Docker image size, and does it meet the sub-5-second threshold that makes agent tool calls usable?
- Is there a `trafilatura_mcp` server on Glama (`@fvanevski/trafilatura_mcp`) that wraps Python trafilatura directly? If it is active and maintained, it overlaps meaningfully with the local stdio route.
- The SIGIR 2023 benchmark study finding ("heuristic extractors perform best, neural models surprisingly bad") could not be verified against the original paper's exact figures within this research; treat the qualitative conclusion as directionally correct but unverified in detail.

---

## Sources

- [Anthropic API web_fetch tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool)
- [Anthropic API web_search tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
- [Mikhail Shilkov: Claude Code web tools reverse engineering](https://mikhail.io/2025/10/claude-code-web-tools/)
- [Quercle.dev: Claude Code web tools internal analysis](https://quercle.dev/blog/claude-code-web-tools)
- [GitHub claude-code issue #4597 — JS pages return empty shell](https://github.com/anthropics/claude-code/issues/4597)
- [GitHub claude-code issue #22937 — WebFetch truncation](https://github.com/anthropics/claude-code/issues/22937)
- [GitHub claude-code issue #39896 — Cloudflare 403 on domain safety check](https://github.com/anthropics/claude-code/issues/39896)
- [GitHub claude-code issue #33314 — WebSearch US-only description inaccurate](https://github.com/anthropics/claude-code/issues/33314)
- [Firecrawl: Claude web_fetch vs Firecrawl comparison](https://www.firecrawl.dev/blog/claude-web-fetch-vs-firecrawl)
- [Search Engine Journal: Anthropic bot user-agents and robots.txt](https://www.searchenginejournal.com/anthropics-claude-bots-make-robots-txt-decisions-more-granular/568253/)
- [Claude.ai web search support article](https://support.claude.com/en/articles/10684626-enable-and-use-web-search)
- [Anthropic supported countries](https://www.anthropic.com/supported-countries)
- [Apify WCC /api/mcp page](https://apify.com/apify/website-content-crawler/api/mcp)
- [Apify WCC actor page](https://apify.com/apify/website-content-crawler)
- [Apify rag-web-browser actor page](https://apify.com/apify/rag-web-browser)
- [Apify platform MCP docs](https://docs.apify.com/platform/integrations/mcp)
- [GitHub: apify/apify-mcp-server](https://github.com/apify/apify-mcp-server)
- [GitHub: apify/actors-mcp-server](https://github.com/apify/actors-mcp-server)
- [GitHub: apify/mcp-server-rag-web-browser (archived)](https://github.com/apify/mcp-server-rag-web-browser)
- [GitHub: apify/rag-web-browser](https://github.com/apify/rag-web-browser)
- [npm: @apify/mcp-server-rag-web-browser](https://www.npmjs.com/package/@apify/mcp-server-rag-web-browser)
- [npm: @apify/actors-mcp-server](https://www.npmjs.com/package/@apify/actors-mcp-server)
- [use-apify.com: MCP servers web scraping guide](https://use-apify.com/blog/mcp-servers-web-scraping-guide)
- [use-apify.com: Apify MCP Claude Desktop setup](https://use-apify.com/blog/apify-mcp-claude-desktop)
- [use-apify.com: RAG data pipeline architecture](https://use-apify.com/docs/apify-use-cases/data-for-ai-rag)
- [Apify blog: Actor output preview announcement](https://blog.apify.com/your-ai-agent-used-to-guess-what-actors-return-now-it-knows-before-running-them/)
- [Apify blog: Build and deploy MCP servers in TypeScript](https://blog.apify.com/build-and-deploy-mcp-servers-typescript/)
- [Apify actor.json field reference](https://docs.apify.com/platform/actors/development/actor-definition/actor-json)
- [Apify Standby mode docs](https://docs.apify.com/platform/actors/development/programming-interface/standby)
- [GitHub: modelcontextprotocol/servers — fetch server](https://github.com/modelcontextprotocol/servers/tree/main/src/fetch)
- [CVE-2025-65513 — Official MCP Fetch SSRF vulnerability](https://github.com/advisories/GHSA-8fxj-2g9q-8fjw)
- [GitHub: firecrawl/firecrawl-mcp-server](https://github.com/firecrawl/firecrawl-mcp-server)
- [Firecrawl pricing](https://www.firecrawl.dev/pricing)
- [GitHub: microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)
- [GitHub: jina-ai/MCP](https://github.com/jina-ai/MCP)
- [Jina Reader](https://jina.ai/reader/)
- [GitHub: tavily-ai/tavily-mcp](https://github.com/tavily-ai/tavily-mcp)
- [Tavily API credits docs](https://docs.tavily.com/documentation/api-credits)
- [GitHub: exa-labs/exa-mcp-server](https://github.com/exa-labs/exa-mcp-server)
- [Exa pricing](https://exa.ai/pricing)
- [GitHub: brightdata/brightdata-mcp](https://github.com/brightdata/brightdata-mcp)
- [Bright Data MCP pricing](https://brightdata.com/pricing/mcp-server)
- [Bright Data free tier announcement](https://brightdata.com/blog/ai/web-mcp-free-tier)
- [GitHub: oxylabs/oxylabs-mcp](https://github.com/oxylabs/oxylabs-mcp)
- [GitHub: ScrapeGraphAI/scrapegraph-mcp](https://github.com/ScrapeGraphAI/scrapegraph-mcp)
- [GitHub: unclecode/crawl4ai](https://github.com/unclecode/crawl4ai)
- [GitHub: Decodo/mcp-server](https://github.com/Decodo/mcp-server)
- [GitHub: hyperbrowserai/mcp](https://github.com/hyperbrowserai/mcp)
- [AIMultiple browser MCP benchmark](https://aimultiple.com/browser-mcp)
- [Proxyway MCP servers for web scraping benchmark](https://proxyway.com/best/mcp-servers-for-web-scraping)
- [Chatforest: best web scraping MCP servers guide](https://chatforest.com/guides/best-web-scraping-mcp-servers/)
- [rs-trafilatura GitHub](https://github.com/Murrough-Foley/rs-trafilatura)
- [Trafilatura evaluation benchmark](https://trafilatura.readthedocs.io/en/latest/evaluation.html)
- [ScrapingHub article extraction benchmark](https://github.com/scrapinghub/article-extraction-benchmark/blob/master/README.rst)
- [Contextractor: trafilatura vs Jina ReaderLM comparison](https://www.contextractor.com/trafilatura-vs-jina-readerlm/)
- [dev.to: rs-trafilatura page-type-aware extraction](https://dev.to/murroughfoley/rs-trafilatura-page-type-aware-web-content-extraction-in-rust-2ppf)
- [skywork.ai: Jina Reader deep dive](https://skywork.ai/skypage/en/jina-ai-reader-deep-dive/1977985446337515520)
- [eesel.ai: Firecrawl alternatives](https://www.eesel.ai/blog/firecrawl-alternatives)
- [ScrapeGraphAI: Firecrawl pricing breakdown](https://scrapegraphai.com/blog/firecrawl-pricing)
- [effloow.com: MCP ecosystem growth to 100M installs](https://effloow.com/articles/mcp-ecosystem-growth-100-million-installs-2026)
- [mcpservers.org web scraping category](https://mcpservers.org/category/web-scraping)
- [PulseMCP server directory](https://www.pulsemcp.com/servers)
- [XDA Developers: local LLM MCP stack](https://www.xda-developers.com/added-these-mcp-servers-local-llm-stack-one-replaces-paid-tool/)
- [Glama MCP server registry](https://glama.ai/mcp/servers)
- [use-apify.com: best MCP server actors](https://use-apify.com/docs/best-apify-actors/best-mcp-server-actors)
- [Apify blog: configure MCP server with Apify actors](https://blog.apify.com/configure-mcp-server-with-apify-actors/)
- [Apify Crawlee GitHub](https://github.com/apify/crawlee)
