# Deduplication naming review

Scope: two questions about the `deduplication` schema key / `--deduplication` CLI flag and its
`none | url | content-hash` enum. Authority for this review is the **Crawlee + Apify ecosystem**
only — trafilatura naming is explicitly out of scope.

## TL;DR

- **Keep `--deduplication` (noun). Do NOT rename to `--deduplicate` (verb).** The `--exclude`
  comparison does not hold: `--exclude` is a Crawlee-inherited name for an imperative + pattern flag,
  whereas `--deduplication` is a contextractor-owned **enum-mode selector**, and every enum-mode flag
  in this CLI is a noun. `--deduplicate none` also reads as a contradiction.
- **Keep the choices `none | url | content-hash`.** They are accurate. `none` does not claim "no
  deduplication at all" — it means "no *additional* contextractor dedup; Crawlee's always-on URL dedup
  remains," and the description already says exactly that. No change needed.

---

## Q1 — `--deduplication` vs `--deduplicate`

### The `--exclude` analogy is a mis-generalization

`--exclude` is not evidence of a repo-wide "use verbs" convention. It exists because Crawlee named it:
it maps to `EnqueueLinksOptions.exclude` (per Step CRAWLEE-ALIGN). It is an **imperative + target**
flag — `--exclude <pattern>`, repeatable, "exclude this glob." Its sibling toggles in that family are
also verbs because they are imperatives or booleans:

- `--exclude <pattern>`, `--globs <pattern>` (value = a pattern, not a mode)
- `--block-media`, `--keep-url-fragment`, `--use-sitemaps`, `--respect-robots-txt`,
  `--ignore-cors-and-csp`, `--ignore-https-errors`, `--store-skipped-urls` (boolean toggles)
- `--wait-for-selector`, `--wait-for-dynamic-content` (imperative + target)

### `--deduplication` belongs to the enum-mode-selector family — all nouns

Flags whose value selects one of a fixed set of **modes/levels** are uniformly nouns in this CLI:

| Flag | Value type | Form |
|---|---|---|
| `--mode <mode>` | `precision\|balanced\|recall` | noun |
| `--crawler-type <type>` | `adaptive\|firefox\|chromium\|cheerio` | noun |
| `--proxy-rotation <strategy>` | `per-request\|until-failure\|…` | noun |
| `--save <format>` | `markdown\|txt\|json\|html\|original\|all` | noun |
| `--save-destination <dest>` | `key-value-store\|dataset` | noun |
| `--wait-until <event>` | `load\|domcontentloaded\|…` | noun |
| `--deduplication <level>` | `none\|url\|content-hash` | **noun (consistent)** |

**No verb-form flag in the CLI takes an enum value.** Every verb flag is either a boolean toggle or
takes a free-form pattern/selector/number. So `--deduplication` is already on the correct side of the
convention; `--deduplicate` would be the *inconsistent* one.

### The `none` value makes the verb form contradictory

`--deduplicate none` parses as "deduplicate: none" — an imperative verb commanding "none." Mode-selector
nouns with an off-switch value (`--save-destination`, `--proxy-rotation`, `--mode`) all read cleanly
with their values; a verb does not. `--deduplication none` reads as a setting, which is what it is.

### Flag-mirrors-schema-key principle (Step CLI) seals it

The prompt's rule: CLI flags mirror the schema key, diverging only for a short idiomatic spelling. The
schema key is `deduplication` (a noun, and **locked** by the enum-casing convention — never reverted to
`minimal/basic/full`). There is no idiomatic short form of "deduplication," so the flag mirrors the key
verbatim: `--deduplication`. `--deduplicate` would be a gratuitous, unjustified divergence.

### Crawlee / Apify ecosystem precedent

There is **no precedent forcing either spelling**, and crucially **no Apify actor names a field
`deduplication` or `deduplicate`** (see the Apify input-schema survey below). Crawlee has no public
option literally named `deduplication` either — request dedup is implicit via the request queue's
`uniqueKey`. Apify actors instead express crawl-scope dedup as **nouns / adjective-phrases on boolean
toggles** (`ignoreCanonicalUrl`, `aggressivePrune`, `keepUrlFragments`), and dedicated dataset-dedup
actors name the param `fields` — never an imperative verb. So the ecosystem leans noun, and the
internal-consistency call also favors the noun `--deduplication`.

**Verdict: keep `--deduplication`.** No source change. The verb `--deduplicate` has zero precedent in
either Crawlee or the Apify Store.

### Apify Store input-schema survey (real schemas, June 2026)

Verified against live `input-schema` pages. Two distinct ecosystem patterns, neither using a
`deduplication` enum:

**Pattern A — crawler actors split dedup into separate boolean toggles.** The Website Content Crawler
(`apify/website-content-crawler`), the actor contextractor is most directly modeled on, uses:

| Key | Title | Type / default | ≈ contextractor level |
|---|---|---|---|
| `ignoreCanonicalUrl` | "Ignore canonical URLs" | boolean, `false` | `url` (canonical-URL skip) |
| `aggressivePrune` | "Remove duplicate text lines" | boolean, `false` (Count-Min Sketch) | `content-hash` (content skip) |

Web Scraper (`apify/web-scraper`) adds `keepUrlFragments` ("URL #fragments identify unique pages",
boolean, `false`) — already present in contextractor as `keepUrlFragment`.

**Pattern B — dedicated dataset-dedup actors** (`lukaskrivka/dedup-datasets`,
`automation-lab/dataset-dedup`) name the dedup-key param **`fields`** (the columns that make a record
unique). "Deduplicate/Dedup" appears only in the **actor title**, never as a field key. These are
post-crawl dataset cleaners — a different category from crawl-scope dedup.

**Implications for contextractor:**

- contextractor's `deduplication: none | url | content-hash` is a **clean consolidation of WCC's two
  booleans** into one ordered enum. The value mapping is faithful: `none` ≈ `ignoreCanonicalUrl:true` +
  `aggressivePrune:false`; `url` (default) ≈ `ignoreCanonicalUrl:false`; `content-hash` ≈ adds
  `aggressivePrune`. WCC's effective default is canonical-dedup-ON, so contextractor's default `url`
  matches WCC behavior.
- One enum is arguably cleaner than WCC's two booleans (WCC's `ignoreCanonicalUrl` carries an awkward
  inverted sense). Keeping it is justified.
- Note: contextractor's **old** flag was `--ignore-canonical-url` (the exact WCC field name); this
  refactor replaces it with `--deduplication none`. The WCC-faithful alternative would be two booleans
  instead of one enum — a deliberate, defensible divergence, not an oversight.

---

## Q2 — Are `none | url | content-hash` the right choices given dedup "is always done"?

### What is actually always-on

Crawlee's request queue always dedups by URL (`uniqueKey`) regardless of this setting. That is a
Crawlee invariant, not something this enum controls. This enum controls **contextractor's additional,
post-fetch dedup layer** stacked on top:

- `none` — additional dedup OFF; only Crawlee's built-in URL dedup remains (handler: `if (opts.deduplication !== 'none')` is skipped — `packages/crawler/src/handler.ts:97,200,277`)
- `url` (default) — also skip pages whose `<link rel="canonical">` was already extracted
- `content-hash` — also skip pages whose extracted text matches a prior page (`handler.ts:114,217,294`)

### Are the values OK? Yes

- They accurately model the *additional* layer the option governs. `none` correctly means "no
  additional dedup," and the description already states Crawlee's URL dedup stays active — so it does
  **not** falsely promise "zero dedup." The "always done" research finding is therefore not a
  contradiction; it is already reflected in the wording.
- Values are kebab-case (`content-hash`) per the locked enum-casing convention. Compliant.
- `url` / `content-hash` are self-describing levels with a sensible default (`url`).

### One naming overlap worth noting (not a blocker)

The value `url` here means **canonical-URL** dedup (the `<link rel=canonical>` skip), which is a
different mechanism from Crawlee's built-in **request-URL** dedup. Two distinct "URL" dedup concepts
coexist. The current description disambiguates them ("on top of Crawlee's built-in URL deduplication …
url: skip pages whose `<link rel="canonical">` was already extracted"), so it is acceptable as-is. If
future clarity is ever wanted, `canonical-url` would remove the ambiguity — but it is **out of scope
here** (the enum is locked, and renaming would churn schema/CLI/docs for marginal gain).

**Verdict: keep `none | url | content-hash` and the default `url`.** No source change. The description
already encodes the "Crawlee dedup is always on" fact correctly.

---

## Recommendation summary

| Item | Decision | Action |
|---|---|---|
| `--deduplication` flag name | Keep (noun, mode-selector family, mirrors locked schema key) | none |
| `none / url / content-hash` enum | Keep (accurate, locked, kebab-case) | none |
| `url` vs Crawlee built-in URL dedup overlap | Documented in description; acceptable | none (optional future: `canonical-url`) |

Neither proposed change should be applied. The current naming is the more consistent and more accurate
choice under Crawlee/Apify-ecosystem authority.
