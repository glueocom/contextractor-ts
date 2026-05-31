# Prompt — Contextractor Store README + docs overhaul

Reproducible prompt for the documentation overhaul done in this session. Revert the
relevant files in git and run this prompt to regenerate the same result.

## Objective

Turn `apps/apify-actor/README.md` into a proper, benefit-driven **Apify Store page**
(it is the public listing at `https://apify.com/glueo/contextractor`), refresh the
`actor.json` `description`, and modernize the developer-facing root `README.md` — all
while keeping the `@generated` markdown regions working via the generators.

## Audience model (critical)

- `apps/apify-actor/README.md` **is the public Apify Store page**, read by END USERS
  who run the Actor from the Apify Console (the Actor runs in Apify's cloud). It must
  be a sales + SEO page, NOT a developer doc.
- `README.md` (repo root) is the **GitHub/monorepo developer README** — developer
  sections (prerequisites, workspace commands, architecture) belong here.

## Hard constraints (repo rules)

- `.claude/rules/user-facing-docs.md` — the Store README must contain NO deploy/build/
  dev content, NO internal names (`contextractor-test`, `glueo/...`), NO Dockerfile/
  Git-build notes, NO `.claude/` references, NO npm package name as the H1.
- Preserve every `<!-- @generated:start name="…" -->` … `<!-- @generated:end … -->`
  region exactly; never hand-edit inside the markers. They are rebuilt from the Zod
  schema by `@contextractor/gen-md-regions`. Region matching is by name and is
  position-independent, so regions can be moved/reordered. Run `pnpm docs:update`
  after editing to fill them.
- `.claude/rules/json-config-only.md` — config examples in JSON, never YAML.
- `.claude/rules/native-addon-boundary.md` — format values stay `txt`/`markdown`/
  `json`/`html`/`original`; the word "text" may appear only in prose ("plain text"),
  never as a format value.
- `.claude/rules/minimal-diff.md` — use `Write` only for the full Store README rewrite;
  use `Edit` for the surgical `actor.json` and root README changes.
- Exactly ONE H1 per README. The Store README H1 must equal the `actor.json` `title`
  (`# Contextractor`).

## Research basis (so the structure is grounded, not invented)

Model the Store README on the closest analog **`apify/website-content-crawler`** and
the other top AI/RAG actors (`rag-web-browser`, `web-scraper`, `cheerio-scraper`) plus
Apify's official README/SEO playbook. Key principles applied:

- Lead with the AI/LLM/RAG **destination** in sentence one; the engine/mechanism is
  sentence two.
- Front-load value into the first ~25% (features + use cases) — most visitors never
  scroll further.
- Map EACH output format to a concrete job rather than listing them flat.
- Describe the pipeline as ~3 short stages (crawl → extract → output).
- "Show, don't tell": a real JSON output record + a fields table, not prose.
- Conversational, keyword-rich H2/H3 question headings for SEO ("How does it work?",
  "Is it legal to scrape website content?").
- Sparse emoji, Markdown + basic HTML only (no CSS).

## Task A — Rewrite `apps/apify-actor/README.md` (Store page)

Fully rewrite with `Write`. Section order (value-first → mechanism → proof → logistics):

- `# Contextractor` — the single H1 (matches `actor.json` title; never `@contextractor/apify`).
- **Opening pitch** (lead paragraph, no heading): two beats — (1) verb-first value +
  AI audience: "Crawl any website and extract clean, boilerplate-free main content as
  Markdown, plain text, JSON, HTML, or raw original HTML — ready to feed LLMs, RAG
  pipelines, and vector databases"; (2) the differentiator: rs-trafilatura main-content
  extraction (strips nav/ads/cookie banners) + adaptive Crawlee + Playwright crawler.
  Bold the key words. Link `rs-trafilatura` and `Crawlee`.
- `## What can Contextractor do?` — ~9 concrete benefit bullets (clean extraction; five
  formats; adaptive crawling; whole-site crawling; tunable precision/balanced/recall +
  toggles; anti-blocking proxy/session rotation; page metadata; modern-page handling
  incl. cookie modals, waits, scrolling, custom cookies/headers; deduplication).
- `## Designed for LLMs, RAG, and AI pipelines` — use-case bullets (RAG knowledge
  bases, feed/contextualize LLMs, training datasets, bulk processing, content/SEO
  research) + a **format→job table**: `markdown`→chunking/embeddings/chat context;
  `txt`→lightweight NLP; `json`→structured pipelines; `html`→layout-aware processing;
  `original`→full raw page for re-processing/audit.
- `## How does it work?` — 3 stages, one clause each: **Crawl** (adaptive crawler,
  scope, robots.txt) → **Extract** (rs-trafilatura, chosen mode) → **Output** (selected
  formats with MD5 hash + bytes, to dataset or key-value store). No napi-rs/monorepo/build.
- `## How to use Contextractor` — numbered no-code Console steps (add start URLs →
  choose format(s) → pick save destination → optional scope/proxy/waits → Start →
  download from dataset/KVS or the Apify API). (Numbered list is fine here — the
  no-numbered-headers rule governs `.claude/` prompts, not Store docs.)
- `## Input` — one-line lead, then the **preserved** `apify-input-schema` generated
  region (markers only; `pnpm docs:update` fills the table).
- `## Crawler and extraction options` — short lead, then a **new** `enum-values`
  generated region (markers only). It renders `### crawlerType/deduplication/mode/
  proxyRotation/waitUntil` value→title tables. The `enum-values` emitter is already
  registered in `tools/gen-md-regions/src/emitters/index.ts`.
- `## What data does Contextractor return?` — a **fields table** (`url`; `status`
  success/failed/skipped; `metadata.*`; `crawl.*`; `original` and per-format
  `txt`/`markdown`/`json`/`html` content nodes with `hash`+`bytes` then `content` OR
  `key`+`url`; failed-only `errors`/`retryCount`/`crawledTime`; skipped-only
  `skipReason`) + ONE realistic JSON success record (default settings: Markdown saved
  to the key-value store; include `original` with hash+bytes) + a `### Where your
  content is saved` explainer (key-value store default keyed `{format}-{md5(url)}.{ext}`
  vs inline dataset `content`). The dataset record shape is the source of truth in
  `apps/apify-actor/.actor/dataset_schema.json`. Do not end lists with "etc."
  - In the example, every content `hash` and the `{md5(url)}` portion of each KVS
    `key`/`url` MUST be a full 32-char MD5 hex (per `apps/apify-actor/SPEC.md`) — never
    a truncated placeholder. Compute the real md5 of the example URL so the example is
    internally consistent: `node -e "console.log(require('crypto').createHash('md5').update('<example-url>').digest('hex'))"`.
- `## Integrations and automation` — generic, truthful bullets only (Apify API & SDKs;
  scheduling/monitoring; MCP server; no-code connectors Make/Zapier/n8n; feeding the
  Markdown/JSON into LangChain/LlamaIndex/Pinecone/Qdrant/Weaviate/Chroma). Output is
  standard JSON/Markdown — keep claims as "works with"/"feed into", no invented connectors.
- `## FAQ` — keyword-rich H3 questions: "Is it legal to scrape website content?" ·
  "Why is some content missing or noisy?" · "How do I avoid getting blocked?" · "How
  do I crawl an entire website?" · "How do I remove duplicate pages?" · a "Found a bug
  or have a feature request?" closer pointing to the Issues tab.

**Explicitly removed** from the old README: the `# `@contextractor/apify`` H1,
`## Local prerequisites`, and `## Local development`.

## Task B — Update `apps/apify-actor/.actor/actor.json` description

`Edit` the `description` field to be verb-first and AI/RAG-framed (< 250 chars):

> Crawl any website and extract clean main-content text as Markdown, plain text, JSON,
> or HTML — ready for LLMs, RAG pipelines, and vector databases. Built on the
> rs-trafilatura engine and an adaptive Crawlee + Playwright crawler.

Leave `name` (`contextractor-test`) and all other fields untouched.

## Task C — Update root `README.md` (developer-facing)

Surgical `Edit`s, keep all developer sections, preserve the `input-type` region:

- Rewrite the lead paragraph to the same AI/RAG-framed, more descriptive intro
  (formats + LLMs/RAG/vector databases), keeping the `rs-trafilatura` + Crawlee links.
- Replace the thin `## Supported output formats` section with a `## Features` bullet
  list (clean extraction; adaptive crawling; five formats; whole-site crawling;
  anti-blocking; metadata + dedup; one engine / two surfaces).
- Keep `## Input schema` (incl. the `input-type` `@generated` region), `## Local
  prerequisites`, `## Workspace commands`, `## Architecture`, and `## Docs version`.
- Bump the `## Docs version` timestamp to the current UTC time
  (`date -u +%Y-%m-%dT%H:%M:%SZ`).

## Regenerate + verify

Run from the repo root:

```bash
pnpm docs:update                                   # fills apify-input-schema + enum-values (Store) and input-type (root)
pnpm docs:update                                   # second run must report "0 file(s) updated" (idempotent)
pnpm -F @contextractor/gen-input-schema start      # sanity: .actor/*.json must regenerate to no git diff
git status --short                                  # expect only README.md, apps/apify-actor/README.md, apps/apify-actor/.actor/actor.json
```

Correctness sweep on `apps/apify-actor/README.md`: exactly one `# ` H1 (`# Contextractor`);
both `@generated` regions present and populated; structured Output table + JSON example;
zero matches for `contextractor/apify|local prerequisite|local development|pnpm install|
apify run|rustup|contextractor-test|glueo/|Dockerfile|\.claude/`. Verify the example's
MD5 values are full 32-char hex (no truncated keys/hashes): every `[0-9a-f]` run inside a
`hash`, `key`, or KVS `url` must be exactly 32 chars.

## Notes

- Do NOT commit, push, or deploy unless the user explicitly asks. Production deploys to
  `glueo/contextractor` are gated (`.claude/rules/apify-production.md`).
- Pricing and Related-Actors sections were intentionally omitted from the Store README
  (no concrete pricing numbers / sibling-actor list available).
