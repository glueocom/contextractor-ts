# Trafilatura's Precision/Recall Axis: Enum Design Recommendations for contextractor-ts

## Executive summary

The right enum for the Apify input schema and TypeScript CLI is **`ExtractionMode`** with three string values **`"precision" | "balanced" | "recall"`**, defaulting to `"balanced"`. That naming is not a stylistic choice — it is the literal vocabulary that Trafilatura itself uses internally (`self.focus = "recall" if recall else "precision" if precision else "balanced"` in `trafilatura/settings.py`) and that the most widely used Trafilatura port, go-trafilatura, exposes publicly as `ExtractionFocus` with constants `Balanced`, `FavorRecall`, `FavorPrecision`. Adopting the same vocabulary aligns the wrapper with the ecosystem and removes ambiguity about what `precision` and `recall` mean. The `fast` / `no_fallback` flag belongs on a **separate** axis (it controls runtime cost, not the inclusion threshold) and should not be folded into this enum. Other booleans (`include_comments`, `include_tables`, `include_images`, `include_links`, `include_formatting`, `deduplicate`) are content-shape choices orthogonal to the precision/recall axis and should remain orthogonal boolean flags.

Crucially for v1 of contextractor-ts: **rs-trafilatura supports `favor_precision` and `favor_recall` as separate boolean fields on its public `Options` struct**, so the enum can be implemented today by mapping `"precision" → {favor_precision:true, favor_recall:false}`, `"recall" → {false,true}`, and `"balanced" → {false,false}`. No "future" placeholder is needed for the mode itself.

---

## 1. Trafilatura v2.x: every parameter relevant to a "mode" enum

The current public release is **Trafilatura 2.0.0** (the documentation site at `trafilatura.readthedocs.io/en/latest` is explicitly tagged `version: 2.0.0`). The signature of `extract()` and `bare_extraction()` in this release is, verbatim:

```python
trafilatura.extract(
    filecontent, url=None, record_id=None,
    fast=False, no_fallback=False,
    favor_precision=False, favor_recall=False,
    include_comments=True, output_format='txt', tei_validation=False,
    target_language=None,
    include_tables=True, include_images=False,
    include_formatting=False, include_links=False,
    deduplicate=False,
    date_extraction_params=None,
    with_metadata=False, only_with_metadata=False,
    max_tree_size=None, url_blacklist=None, author_blacklist=None,
    settingsfile=None, prune_xpath=None,
    config=DEFAULT_CONFIG, options=None,
)
```

### 1.1 `favor_precision` / `favor_recall` — the actual precision/recall axis

**Definition (from the official `corefunctions.html` parameter table):**

- `favor_precision` (bool, default `False`) — "prefer less text but correct extraction."
- `favor_recall` (bool, default `False`) — "when unsure, prefer more text."

**The two flags are not orthogonal — they collapse into a three-valued internal state.** In `trafilatura/settings.py`, the `Extractor` constructor contains:

```python
self.focus: str = (
    "recall" if recall else "precision" if precision else "balanced"
)
```

This is the single most important fact for enum design: Trafilatura's own internal representation is already a three-state categorical (`"recall"`, `"precision"`, `"balanced"`), and the two booleans are merely the public surface for setting it. The boolean pair has only three meaningful states (`(F,F) = balanced`, `(T,F) = precision`, `(F,T) = recall`); the fourth combination `(T,T)` is **not an error** — Python's short-circuit `if recall else if precision else "balanced"` simply gives recall precedence and silently ignores `precision=True`. This is undocumented behavior; the CLI surface treats them as mutually exclusive (the `cli.py` source places `--precision` and `--recall` in an `add_mutually_exclusive_group()`), which is the maintainer's tell that they should never be set together. **The categorical enum design is what trafilatura "actually wants" — the booleans are a legacy API.**

**Behavioral consequences in v2.0 source code (`main_extractor.py`, `htmlprocessing.py`, `core.py`):**

- In `extract_content`, when `len_text < options.min_extracted_size and not options.focus == "precision"`, a baseline rescue extraction is performed. **Precision mode disables the baseline-rescue safety net** — short outputs are not "rescued" by a more permissive fallback.
- In `_extract` (recovery of wild text elements): `if options.focus == "recall": potential_tags.update(['div', 'lb']); search_expr += '|.//div|.//lb|.//list'`. **Recall mode broadens the XPath that hunts for missed text** to include `<div>`, `<lb>`, and `<list>` elements that the balanced path ignores.
- In `tree_cleaning` (`htmlprocessing.py`): `if options.focus == "recall" and tree.find(".//p") is not None:` triggers a paragraph-preservation branch that prevents the cleaner from removing paragraphs aggressively.
- In `prune_unwanted_sections`, the local variable `favor_precision = options.focus == "precision"` controls additional rule-based deletion.

**Quantitative evidence of the trade-off** comes from the maintained go-trafilatura comparison run against Trafilatura 1.12.2 on a 960-document evaluation set:

| Configuration | Precision | Recall | F1 |
| --- | --- | --- | --- |
| `trafilatura` + fallback | 0.919 | 0.915 | 0.917 |
| `trafilatura` + fallback + precision | **0.932** | 0.889 | 0.910 |
| `trafilatura` + fallback + recall | 0.907 | **0.919** | 0.913 |

Precision mode raises precision by ~1.3 pp and drops recall by ~2.6 pp; recall mode does the inverse. F1 stays essentially constant. This empirically confirms what the docs claim: it is genuinely a trade-off knob, not a "free improvement" lever.

### 1.2 `fast` / `no_fallback` — a separate speed axis

- `fast` (bool, default `False`) — "Use faster heuristics and skip backup extraction."
- `no_fallback` (bool, default `False`) — "Will be deprecated, use 'fast' instead."

The v2.0 source explicitly deprecates `no_fallback`. What `fast=True` does (per `core.py`): it skips the `compare_extraction()` call that runs the `try_readability` and `try_justext` external fallback algorithms and picks the best of the three outputs. This is a pure speed/quality trade-off in the **algorithm-selection** dimension, not the inclusion-threshold dimension. The docs claim "about twice as fast." It is **orthogonal to `favor_precision` / `favor_recall`** — you can run `fast=True, favor_precision=True` or any other combination.

### 1.3 Content-shape toggles (orthogonal to precision/recall)

| Parameter | Default | Behavior | Notes |
| --- | --- | --- | --- |
| `include_comments` | `True` | Extract comment sections at bottom of articles | Truly orthogonal. |
| `include_tables` | `True` | Take into account `<table>` text | Truly orthogonal. |
| `include_images` | `False` | Keep `<img>` with alt/src/title attrs | Marked **experimental** in docs. |
| `include_links` | `False` | Keep `<a href="…">` link targets | Marked **experimental**. |
| `include_formatting` | `False` | Keep `<b>/<strong>`, `<i>/<emph>`, etc. | Auto-on for Markdown output. |
| `deduplicate` | `False` | LRU-cache-based segment/document dedup | Uses `MIN_DUPLCHECK_SIZE` and `MAX_REPETITIONS`. |

### 1.4 Filtering, language, output

- `target_language` (ISO 639-1, default `None`) — drops documents whose detected language doesn't match.
- `with_metadata` / `only_with_metadata` — output-shape controls.
- `prune_xpath` — pre-extraction tree pruning; docs recommend it as the partner of `favor_precision` for fine-tuned noise removal.
- `output_format` ∈ `{"csv", "html", "json", "markdown", "txt", "xml", "xmltei"}`, default `"txt"`.

### 1.5 `settings.cfg` thresholds (the *real* knobs underneath the presets)

| Constant | Default | Purpose |
| --- | --- | --- |
| `MIN_EXTRACTED_SIZE` | `250` | Below this, fallbacks trigger (and baseline rescue runs unless `focus == "precision"`). |
| `MIN_OUTPUT_SIZE` | `1` | Absolute minimum for main text. |
| `MIN_DUPLCHECK_SIZE` | `100` | Minimum size to run deduplication on. |
| `MAX_REPETITIONS` | `2` | Maximum allowed duplicates. |
| `EXTRACTION_TIMEOUT` | `30` | CLI-only extraction timeout (seconds). |

### 1.6 Maintainer guidance

From Trafilatura's troubleshooting page (Adrien Barbaresi):

> "Content extraction is a tradeoff between precision and recall, that is between desired and undesirable content. […] Opting for `favor_recall` (Python) or `--recall` (CLI), Changing the minimum acceptable length in the settings, Using the more basic `baseline` or `html2txt` functions instead."

And from `usage-python.html`:

> "If your results contain too much noise, prioritize precision […]. If parts of your documents are missing, try this preset to take more elements into account."

---

## 2. rs-trafilatura: support matrix

Source: `github.com/Murrough-Foley/rs-trafilatura` README, PyPI `rs-trafilatura 0.1.1`, the Dev.to integration write-ups by Murrough Foley. The crate self-describes as **a Rust port of trafilatura / go-trafilatura** that advertises "28 options to tune precision/recall tradeoff, content selection, and output format."

The README's canonical Custom Options example:

```rust
let options = Options {
    include_comments: true,
    include_tables: true,
    include_images: true,
    include_links: true,
    favor_precision: true,   // Stricter filtering, less noise
    // favor_recall: true,   // More inclusive, may include some noise
    url: Some("https://example.com/article".to_string()),
    ..Options::default()
};
```

**rs-trafilatura — unlike the sibling Rust port `nchapman/trafilatura-rs`, which uses an `ExtractionFocus::FavorPrecision/FavorRecall` enum — chose the Python boolean-pair shape.** The public surface is `favor_precision: bool, favor_recall: bool` on `Options`, so contextractor-ts will do the boolean mapping itself.

### Confirmed-supported fields

| rs-trafilatura field | Type | Status |
| --- | --- | --- |
| `favor_precision` | `bool` | ✅ Supported |
| `favor_recall` | `bool` | ✅ Supported |
| `include_comments` | `bool` | ✅ Supported |
| `include_tables` | `bool` | ✅ Supported |
| `include_images` | `bool` | ✅ Supported |
| `include_links` | `bool` | ✅ Supported |
| `output_markdown` | `bool` | ✅ Supported (substitute for `output_format="markdown"`) |
| `url` | `Option<String>` | ✅ Supported |
| `page_type` | `Option<PageType>` | ✅ Supported (rs-trafilatura specific) |

### Not visible in rs-trafilatura's public examples (treat as unsupported for v1)

- `fast` / `no_fallback` — rs-trafilatura is a from-scratch Rust port whose architecture differs from the Python pipeline; semantics of `fast` may not map cleanly. **Treat as unsupported for v1.**
- `include_formatting` — not in examples. Markdown is emitted via `output_markdown: true` which auto-implies formatting upstream. **Treat as unsupported for v1.**
- `deduplicate`, `target_language`, `prune_xpath`, `tei_validation`, `url_blacklist`, `author_blacklist` — not in examples.
- `with_metadata` / `only_with_metadata` — rs-trafilatura always returns a `Metadata` struct, so `with_metadata` is implicitly always on.
- `output_format` (other than markdown vs text) — rs-trafilatura exposes `content_text`, `content_html`, and `content_markdown` directly on `ExtractResult`; no `output_format` selector.

### Port lineage

rs-trafilatura's README: "A high-performance Rust port of trafilatura / go-trafilatura." go-trafilatura's README: "up to date with the original Trafilatura **v2.0.0** (commit c6e8340)." So rs-trafilatura's algorithmic ancestor is Trafilatura v2.0.0. The README lists ScrapingHub benchmark F1 of 0.966 (vs go-trafilatura 0.960 and Python trafilatura 0.958).

There are zero open issues on rs-trafilatura at the time of writing, no public roadmap document, and the crate has only one release tag (v0.1.1, March 2026). **The realistic expectation is that the public Options surface is what's in the README.** Do not assume parity with Python Trafilatura beyond what the README documents.

---

## 3. Cross-library naming survey

| Library | Has a precision/recall mode? | Surface name | Values |
| --- | --- | --- | --- |
| **Trafilatura (Python)** | Yes — booleans in API, three-state internally | `favor_precision`, `favor_recall`; `focus` (internal); `--precision`/`--recall` (CLI, mutually exclusive) | `"precision"`, `"balanced"`, `"recall"` |
| **go-trafilatura** | Yes — proper categorical | `Focus ExtractionFocus` on `Options` | `Balanced` (default), `FavorRecall`, `FavorPrecision` |
| **rs-trafilatura** | Yes — boolean pair (Python style) | `favor_precision`, `favor_recall` on `Options` | Same booleans as Python |
| **trafilatura-rs (nchapman)** | Yes — proper categorical | `with_focus(ExtractionFocus::FavorRecall)` builder method | `Balanced`, `FavorRecall`, `FavorPrecision` |
| **Mozilla Readability.js** | No precision/recall axis | Closest knobs: `charThreshold` (default 500), `nbTopCandidates` (default 5), `linkDensityModifier` | n/a — numerical thresholds |
| **boilerpy3** | Yes — but via **preset class selection** | `ArticleExtractor`, `DefaultExtractor`, `KeepEverythingExtractor`, etc. | `KeepEverythingExtractor` = max recall, `ArticleExtractor` = highest precision |
| **jusText** | No mode switch; raw thresholds | `length_low/high`, `stopwords_low/high`, `max_link_density` | Numerical |
| **newspaper3k / newspaper4k** | No | n/a | n/a |
| **goose3** | No — its `strict` config is about exception handling, not extraction | `Configuration.strict: bool` | Misleading name — do **not** use as a model. |
| **node-unfluff** | No | Minimal API | n/a |
| **Postlight Parser** | No | No strictness toggle | n/a |
| **dragnet** | "Mode" is choice of trained ML model | n/a | Preset model approach. |

**Vocabulary patterns:**

- **"Precision / Recall / Balanced"** — Trafilatura family. Dominant convention in the direct peer group.
- **"Favor X / Favor Y"** — go-trafilatura, trafilatura-rs prefix constants with `Favor`.
- **Preset extractors** — boilerpy3, dragnet.
- **Threshold tuples** — jusText, Readability.js.
- **"strict" / "lenient" / "aggressive"** — do **not** appear in any major content-extractor's API.

**This is decisive: the term-of-art for this axis in web content extraction is `precision` / `recall` / `balanced`.** Inventing new vocabulary would diverge from the term Trafilatura's own source uses.

---

## 4. Community sentiment

**When to use `favor_precision`:**

- LLM training datasets where you would rather lose a borderline paragraph than ingest navigation/footer noise.
- Scholarly text corpora (the original motivating use case — Barbaresi 2021, ACL).
- Downstream LLM evaluation or topic modeling where boilerplate skews results across many documents.

**When to use `favor_recall`:**

- Archival / preservation work.
- RAG pipelines where downstream embedding+retrieval can deal with extra context cheaply.
- Forum and discussion-board pages, where Trafilatura's "balanced" defaults are tuned for article-style pages.
- The first knob to try when the troubleshooting guide says "parts of the contents are still missing."

**Empirical**: precision mode is worth +1.3 pp precision at the cost of −2.6 pp recall; recall mode is +0.4 pp recall at −1.2 pp precision. F1 stays within 0.7 pp of balanced. The presets are **fine-tuning**, not a regime change.

**Common gotchas:**

- Both flags set to `True` does not raise — `favor_recall=True` silently wins.
- `no_fallback` is deprecated as of v2.x — `fast` is the supported name.
- `include_formatting` is largely useless unless `output_format` is XML or Markdown; Markdown silently turns it on.
- `deduplicate` is not active by default and is what people who get duplicated paragraphs across boilerplate-heavy templates actually want.

---

## 5. Recommendations (opinionated, evidence-backed)

### 5.1 Enum name: **`ExtractionMode`**

- Mirrors the natural language used in Trafilatura's own troubleshooting docs ("focus of the extraction process") and the `Extractor.focus` field name.
- Short and unambiguous in TypeScript: `mode: ExtractionMode.Precision`.
- "Mode" is the standard term in similar JSON-Schema / Apify Actor schemas (`crawlerType`, `outputMode`, etc.).
- Reject `ExtractionStrictness` and `ContentSelectivity`: neither matches Trafilatura's vocabulary; "strictness" collides with goose3's confusingly-named `strict` flag.

### 5.2 Enum values: **`"precision" | "balanced" | "recall"`** with `"balanced"` as the default

- These are the **exact string literals** used by `Extractor.focus` in `trafilatura/settings.py`. The internal mapping is a literal pass-through:

  ```ts
  const focus = input.mode; // "precision" | "balanced" | "recall"
  const opts = {
    favor_precision: focus === "precision",
    favor_recall:    focus === "recall",
  };
  ```

- Reject `"strict" / "default" / "lenient"`: invents new vocabulary, doesn't map to any ecosystem norm.
- Reject `"favorPrecision" / "favorRecall" / "balanced"`: redundant verbosity inherited from go-trafilatura's Go-idiomatic constant naming. Once the enum's name is `ExtractionMode`, the `Favor-` prefix becomes noise.
- Reject `"article" / "everything" / …` (boilerpy3 style): you've chosen Trafilatura, not a preset-extractor family.

### 5.3 Apify case convention: **lowercase string literals**

Apify input-schema enums are JSON strings — there is **no platform-level enforcement of SCREAMING_SNAKE_CASE**. Apify's canonical examples (`apify-shared-js/packages/input_schema/src/schema.json`, Website Content Crawler) use lowercase or kebab-case values like `"playwright:chrome"`, `"cheerio"`, `"jsdom"`. The `enum` array carries machine values; `enumTitles` carries display labels. Schema entry:

```json
"extractionMode": {
  "title": "Extraction mode",
  "type": "string",
  "editor": "select",
  "enum": ["precision", "balanced", "recall"],
  "enumTitles": ["Precision (less noise)", "Balanced (default)", "Recall (more text)"],
  "default": "balanced",
  "description": "Trade-off between precision (less unwanted text) and recall (more content captured). 'Balanced' matches Trafilatura's default."
}
```

SCREAMING_SNAKE_CASE is a *GraphQL* convention, not a JSON Schema convention, and not an Apify convention.

### 5.4 Per-flag verdict

| Flag | Verdict | Rationale |
| --- | --- | --- |
| `favor_precision`, `favor_recall` | **Fold into `ExtractionMode`** | This is the whole point — they collapse cleanly into three states. |
| `fast` / `no_fallback` | **Keep separate** as `fastMode: boolean` or sibling enum | `fast` controls whether external fallback algorithms run; precision/recall controls the inclusion threshold. Python source treats them orthogonally. **Also: rs-trafilatura doesn't expose it in v1, so omit from contextractor-ts v1.** |
| `include_comments` | **Orthogonal `includeComments: boolean`**, default `true` | Content shape, not aggression. |
| `include_tables` | **Orthogonal `includeTables: boolean`**, default `true` | Same. |
| `include_images` | **Orthogonal `includeImages: boolean`**, default `false` | Same. Experimental upstream. |
| `include_links` | **Orthogonal `includeLinks: boolean`**, default `false` | Same. Experimental. |
| `include_formatting` | **Orthogonal `includeFormatting: boolean`**, default `false` | Markdown output forces it on regardless. |
| `deduplicate` | **Orthogonal `deduplicate: boolean`**, default `false` | Truly independent — post-extraction LRU pass. |
| `output_format` | **Separate string enum** (`OutputFormat`) | Different axis. |
| `target_language` | **Separate string field** | Filter, not mode. |
| `with_metadata` / `only_with_metadata` | **Orthogonal booleans** | Output-shape, not mode. |
| `prune_xpath` | **Orthogonal string/array field** | Pre-extraction surgery; complementary to `precision`. |

### 5.5 The fast/no_fallback question specifically

**`fast` belongs on its own axis — do not fold it into `ExtractionMode`.**

1. **Orthogonality is documented**: Trafilatura's quickstart shows `extract(downloaded, include_comments=False, include_tables=False, no_fallback=True)` treated independently from precision/recall.
2. **The decision dimensions differ**: `fast` is *quality vs. CPU*; `favor_*` is *precision vs. recall*. Folding them creates a Cartesian product (6 values) that explodes the API surface, or forces an arbitrary coupling.
3. **rs-trafilatura may not even support `fast`**. Absent from the README and public examples. **For v1 of contextractor-ts, omit any `fast`/speed toggle entirely and add it later when/if rs-trafilatura's `Options` struct exposes the equivalent.**

### 5.6 Concrete v1 contextractor-ts surface

```ts
export type ExtractionMode = "precision" | "balanced" | "recall";

export interface ExtractInput {
  /** Trade-off between noise (precision) and completeness (recall). */
  mode?: ExtractionMode;          // default: "balanced"
  includeComments?: boolean;      // default: true
  includeTables?: boolean;        // default: true
  includeImages?: boolean;        // default: false  (experimental)
  includeLinks?: boolean;         // default: false  (experimental)
  includeFormatting?: boolean;    // default: false  (forced on for Markdown)
  deduplicate?: boolean;          // default: false
  outputFormat?: "txt" | "markdown" | "html" | "json" | "xml";
  url?: string;
  targetLanguage?: string;        // ISO 639-1
}
```

Internal mapping:

```ts
const focus = input.mode ?? "balanced";
const rsOptions = {
  favor_precision: focus === "precision",
  favor_recall:    focus === "recall",
  include_comments: input.includeComments ?? true,
  include_tables:   input.includeTables   ?? true,
  include_images:   input.includeImages   ?? false,
  include_links:    input.includeLinks    ?? false,
};
```

This design is grounded in: (a) Trafilatura's own internal three-state `focus` representation in `settings.py`; (b) the mutually-exclusive CLI group in `cli.py`; (c) go-trafilatura's `ExtractionFocus { Balanced, FavorRecall, FavorPrecision }` precedent; (d) Apify's actual `enum`/`enumTitles` conventions; (e) the empirically-confirmed behavioral differences (baseline-rescue disabled in precision mode; `<div>/<lb>/<list>` XPath broadening in recall mode; paragraph-preservation branch in recall mode) visible in Trafilatura v2.0.0 source on master.
