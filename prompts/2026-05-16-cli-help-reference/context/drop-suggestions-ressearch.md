# What Else to Drop from contextractor-ts v1

This document combines two pieces of research into a single drop-list for the v1 surface of `contextractor-ts`:

1. **Part 1** — evidence review on whether Trafilatura's `fast` / `no_fallback` mode is used in practice (the trigger question that prompted this audit).
2. **Part 2** — the broader audit: which other Trafilatura-Python flags should be dropped, demoted, or kept in the v1 wrapper.

Companion to `./extraction-mode-research.md`, which established the `ExtractionMode` enum design.

---

# Part 1: Is Trafilatura's `fast` Mode Actually Used?

**TL;DR — The evidence supports dropping `fast` mode from `contextractor-ts` v1.** The flag is a documented power-user knob, but it shows up almost nowhere in real-world production code. The largest trafilatura deployment on earth (HuggingFace's `datatrove`, used to build FineWeb / FineWeb-Edu / 15T-token corpora) *does not* set it. Community sentiment skews toward leaving the fallback chain on, and a maintainer-reported issue confirms that turning fallbacks off can produce visibly worse output on real articles. On top of that, the `fast` flag's semantic doesn't cleanly map to rs-trafilatura, which replaces the readability+justext fallback chain with a different architecture entirely. Dropping the flag is defensible. The rest of this part is the evidence behind that verdict.

## 1.1 Usage Frequency in the Wild

The honest answer: `fast=True` / `no_fallback=True` is documented prominently, mentioned in nearly every tutorial that copy-pastes the trafilatura quickstart… and almost never set in real production code that I could surface.

**Where it does *not* appear** (the surprising part):

- **HuggingFace `datatrove`** — the canonical Trafilatura wrapper for large-scale corpus building, used to produce FineWeb (15T tokens, 96 CommonCrawl snapshots) and FineWeb-Edu (1.3T tokens). The wrapper at `src/datatrove/pipeline/extractors/trafilatura.py` calls `extract(text, favor_precision=self.favour_precision, include_comments=False, deduplicate=self.deduplicate, **self.kwargs)`. Note what is missing: no `fast`, no `no_fallback`. The default is `favour_precision=True`, `timeout=1` second, fallback chain on. This is the most consequential production user of trafilatura by document volume, and they deliberately keep the readability+justext fallback chain enabled. They mitigate worst-case latency with a per-document timeout, not by disabling fallbacks.
- **FineWeb / FineWeb-Edu / FineWeb2 pipelines** (the `examples/fineweb.py` reference script) — instantiate `Trafilatura()` with default parameters, again leaving fallbacks on.
- **RefinedWeb (Falcon)** — uses trafilatura for WARC → text. The published methodology does not enable fast mode.
- **LangChain** — has no built-in trafilatura loader; community proposals (e.g., the well-circulated LinkedIn write-up by Abdul Rehman) suggest using `trafilatura.extract(downloaded)` with default settings, again no `no_fallback`.
- **Apify's `apify/website-content-crawler`** — does not actually use trafilatura at all; it offers Mozilla Readability, Defuddle, Extractus and "None" as HTML transformers. So it's not a data point either way.

**Where it does appear:**

- Tutorial code and blog walk-throughs that quote the trafilatura docs verbatim (the "fastest execution" example with `include_comments=False, include_tables=False, no_fallback=True`).
- One-off ad-hoc scripts and notebooks.
- A handful of GitHub issues against the trafilatura repo, mostly users *asking* about it or hitting confusing behavior — e.g., issue #85, where a user got *less* text with `no_fallback=True` than without it on a New Yorker article.

The pattern is consistent: people who scrape billions of pages don't reach for `fast`. People who scrape one page in a tutorial do — because it's listed in the docs.

## 1.2 The Speed/Quality Trade-off — What the Numbers Actually Say

The trafilatura documentation makes two claims, repeated since the v1.x days and preserved in v2.0:

> "The available fallbacks make extraction more precise but also slower. The use of fallback algorithms can also be bypassed in fast mode, which should make extraction about twice as fast."

> "You can bypass the use of fallback algorithms in fast mode. This can improve performance, but may affect the accuracy of the extraction."

That's it. There is no published F1-vs-fast-mode table on the readthedocs evaluation page, and the maintainer's blog post "Web scraping with Trafilatura just got faster" frames the relevant speedups as coming from upstream dependency improvements (charset_normalizer, justext) — *not* from telling users to flip off fallbacks. In that post Barbaresi explicitly notes: "Since further processing is triggered in case the default extraction did not work properly, the changes are less visible than in the first case" — implying the fallback path actually fires often enough to matter.

The independent benchmarks that establish trafilatura's reputation:

- **ScrapingHub article-extraction-benchmark**: trafilatura's headline F1 of ~0.96 on the 181-page article corpus is the *combined* result (main extractor + readability + justext fallback). The reported number is *not* the fast-mode number.
- **Bevendorff et al., SIGIR 2023** ("An Empirical Comparison of Web Content Extraction Algorithms"): trafilatura wins by ROUGE-LSum Mean F1 — again, tested with the combined pipeline. Heuristic extractors with their fallback chains outperform the neural extractors tested in that paper.
- **The trafilatura evaluation page itself** explicitly notes: "Rule-based approaches such as trafilatura's obtain balanced results despite a lack of precision. **Combined with an algorithmic approach they perform significantly better than the other tested solutions.**" That last sentence is the official maintainer position. The "algorithmic approach" *is* the readability+justext fallback. Removing it removes the source of trafilatura's published benchmark advantage.

So the empirical answer to "what does fast mode cost in quality?" is: the maintainer hasn't published the number, and the headline F1 scores everyone cites assume the fallback chain is on. Anecdotal evidence (issue #85, community Q&A) suggests the cost is real on harder pages.

## 1.3 Where Fast Mode *Is* Adopted (the strongest cases)

I could not surface a single major open-source pipeline or product that documents using fast mode in production. The closest concrete cases are:

- **The trafilatura CLI when streaming high-volume**: anecdotal blog posts (the "faitch" CLI persona script, the Stephane Robert RAG guide in French) show users reaching for it when batch-processing many URLs interactively.
- **Real-time per-request extraction in agents/RAG demos**: a handful of Medium/Dev.to posts mention it as an option for "doubling throughput in your chatbot's web fetch tool."
- **htmldate's internal default**: trafilatura's metadata extraction uses `htmldate`, which itself defaults to "the fast/no_fallback option" for date extraction. This is a maintainer-set internal default, not user-facing.

That is genuinely all I found. The use case the maintainer *intended* — high-throughput scraping where 2× speed beats a few F1 points — appears to exist mostly in theory.

## 1.4 Where Fast Mode Is Explicitly Avoided

This is where the evidence is strongest:

- **`datatrove` (HuggingFace)** — keeps fallbacks on, uses `favor_precision=True` + 1-second timeout instead. This is the explicit design choice of the team that did the most ablation work on trafilatura settings.
- **FineWeb/FineWeb-Edu/FineWeb2 reproducible pipelines** — same.
- **AICC corpus paper (2511.16397, late 2025)** — compares RefinedWeb/FineWeb (trafilatura) vs. DCLM/Dolma (Resiliparse) vs. their new MinerU-HTML neural extractor. They report a 1.08pp benchmark gap from *extractor quality*. None of the trafilatura baselines they reference use fast mode. The take-home: in corpus construction, people care so much about the last 1–2 percentage points of extraction quality that they're willing to switch to neural extractors — they are obviously not going to flip off fallbacks to gain speed.
- **Trafilatura issue #85** — user explicitly reports that `no_fallback=True` returned only a few paragraphs of a New Yorker article and `no_fallback=False` returned more (though still not the full text). Closed as `wontfix`, but the data point stands: on real long-form journalism, fast mode visibly loses recall.

## 1.5 Community Sentiment

Experienced users I could find writing about this:

- The maintainer (Adrien Barbaresi) describes fast mode neutrally as a knob for users who need speed. He does not recommend it as the default in tutorials or in his blog. His public quality narrative always references the *combined* pipeline.
- HuggingFace data team: implicit preference for fallback-on, given that's what `datatrove` ships.
- French RAG guide author (Stephane Robert): recommends `favor_precision=True` for RAG, doesn't mention fast mode in the recommended-settings cheatsheet.
- Hacker News commenters on the trafilatura threads ("Trafilatura: Python tool to gather text on the Web", item 37124424, and the 41433841 thread): praise the library for being a money-saver vs. LLM-based extractors, but no one in the threads I read makes a case for fast mode specifically.
- The maintainer's deprecation choice in v2.0 is itself informative: he renamed `no_fallback` to `fast` rather than removing it — keeping the feature but tidying the API. So it's not on the chopping block upstream, but it's also clearly not a hot path the maintainer is promoting.

The sentiment is best summarized as: "It exists, it's there if you really need it, most people leave it alone."

## 1.6 rs-trafilatura Specifics — Does the Flag Even Map?

This is where the decision gets cleaner. The Python trafilatura `fast` flag has a very specific meaning: *skip `compare_extraction()`, which runs readability-lxml and justext as backups and picks the best of the three outputs.* That control flow does not exist in rs-trafilatura.

From the rs-trafilatura README and the Dev.to write-up:

- rs-trafilatura is a *from-scratch* Rust reimplementation (with go-trafilatura as a reference point), not a port of the Python codebase line-by-line.
- It replaces the readability + justext fallback chain with a 7-page-type XGBoost classifier (article, forum, product, collection, listing, documentation, service) that selects a *type-specific extraction profile* up front.
- It also has a separate 27-feature XGBoost "extraction quality predictor" that scores each result 0.0–1.0 and flags pages below 0.80 as candidates for an *external* LLM-based fallback (e.g. MinerU-HTML).
- Reported F1 = 0.966 on ScrapingHub's article benchmark, 0.893 on a 511-page held-out generalization set.

So in rs-trafilatura, the architectural concept that `fast` toggles in Python (run/don't-run readability+justext) literally has no counterpart. There is no readability call to skip, no justext call to skip, no `compare_extraction()` step to short-circuit. The closest analog would be "don't run the quality predictor" or "don't escalate low-confidence pages to an LLM fallback," but those are different decisions with different cost models and they aren't exposed under a `fast` flag today.

This means: a `fast` flag in `contextractor-ts` would either (a) be a no-op that lies to the user, or (b) require inventing new semantics specific to rs-trafilatura that don't match user expectations from the Python API. Both are bad.

## 1.7 Verdict on `fast` mode

**Drop `fast` mode from v1. Do not defer it. Do not expose it.**

Reasoning, ranked by weight:

1. **The flag does not map onto rs-trafilatura's architecture.** Exposing a `fast` boolean that doesn't toggle a readability+justext fallback (because rs-trafilatura has no such fallback) would mislead anyone migrating from Python trafilatura. That's worse than not having the flag at all.

2. **The strongest production users of trafilatura don't use it.** HuggingFace's `datatrove`, the FineWeb pipeline, RefinedWeb — none enable fast mode. If the people processing trillions of tokens on tight compute budgets don't reach for this knob, it's not a load-bearing piece of the trafilatura API.

3. **The headline F1 numbers everyone quotes (0.96 on ScrapingHub, best ROUGE-LSum in SIGIR 2023) are with fallbacks on.** rs-trafilatura is being marketed against those numbers. Exposing a flag that demonstrably degrades extraction quality (issue #85, maintainer's own "may affect the accuracy" warning) undercuts that positioning.

4. **The speed argument is weaker than it looks for the contextractor-ts use case.** rs-trafilatura already reports 71 files/s on articles. That's compiled Rust, not Python. The 2× speedup that motivated Python's fast mode is a much smaller absolute concern when the baseline is already 10-100× faster than Python trafilatura. The downstream cost (LLM tokens, vector DB writes, network) almost certainly dominates extraction CPU.

5. **Use case alignment.** `contextractor-ts` wraps a Rust extractor for Node/TypeScript consumers. The realistic users are (a) RAG / agent pipelines, (b) one-off content fetchers feeding LLMs, (c) crawlers building indexes. Categories (a) and (b) are dominated by LLM inference cost — saving 30ms of extraction is invisible. Category (c) is where speed *might* matter, but those users are also the ones most sensitive to extraction quality regressions and most likely to be benchmarking against the published F1 scores.

6. **Optionality has a cost.** Every flag in a wrapper API is documentation surface, test surface, version-compatibility surface, and a place for users to footgun themselves. Adding `fast` to v1 buys you nothing concrete, costs you docs/tests, and ties you to a semantic that doesn't match the underlying engine.

**One thing to watch:** if rs-trafilatura ever gains a flag to skip the XGBoost quality predictor or skip neural-LLM fallback escalation, *that* would be the legitimate `fast` mode for this codebase — different semantics, but the same spirit. Reserve the name for that, don't burn it on a flag that no longer corresponds to anything real.

## 1.8 Caveats and Limitations of the Fast-Mode Review

- GitHub's code search API isn't directly queryable from the tools used here, so this review could not produce a hard count of `no_fallback=True` occurrences across all public Python repos. The "where it doesn't appear" claims are based on inspecting flagship pipelines (datatrove, FineWeb, RefinedWeb pipeline code) and major integrations (LangChain, Haystack-Apify, Apify Website Content Crawler, Crawl4AI), not on an exhaustive enumeration.
- No published quantitative F1 comparison of `fast=True` vs default on a benchmark dataset was found. The strongest negative data point is anecdotal (trafilatura issue #85). If this decision needs to be defended hard, running the trafilatura evaluation harness twice — once with default settings, once with `no_fallback=True` — on the project's bundled test set would produce the missing number. The gap is unlikely to be less than 1–2 F1 points on the harder page types.
- Apify's `apify/website-content-crawler` source isn't fully public; non-use of trafilatura is inferred from the published input schema (HTML transformer options: Readability, Extractus, Defuddle, None) and from the docs not mentioning trafilatura. If their internal pipeline does call trafilatura somewhere, that "doesn't use it" claim is wrong, but the broader argument doesn't depend on it.

---

# Part 2: What Else to Drop, Demote, or Keep

The fast-mode question generalizes. Going through every Trafilatura-Python flag against the two filters that matter — *does rs-trafilatura actually expose it?* and *do real users tune it?* — here's the full v1 verdict.

## 2.1 Drop entirely

**`tei_validation`** — TEI XML validation. rs-trafilatura doesn't emit TEI XML at all (its output struct is `content_text` / `content_html` / `content_markdown` plus `Metadata`). The flag has nothing to validate. Zero production uses found.

**`url_blacklist` / `author_blacklist`** — Filtering sets that exclude already-seen URLs or named authors. Not in rs-trafilatura's README. Also: contextractor-ts is doing crawling at the Crawlee layer, which already has its own URL deduplication. Blacklisting at the extractor layer is redundant with the layer above it.

**`prune_xpath`** — Pre-extraction XPath surgery. Powerful, but: not in rs-trafilatura's README; requires users to write XPath against the pre-extraction DOM (which they can't see without running the extractor first); and it's a debugging knob, not a production setting. The Trafilatura docs pitch it as a partner for `favor_precision` for "fine-tuned noise removal" — i.e. it's the advanced-user escape hatch. contextractor-ts users will reach for it once, write the wrong expression, and stop using contextractor-ts.

**`only_with_metadata`** — Drops documents lacking date+title+url. Not in rs-trafilatura's README, and conceptually wrong for a CLI/Actor: if the user crawled a URL, they want the result back. Filtering at extraction time vs. filtering at the consumer end is a semantic the CLI shouldn't impose.

**`with_metadata`** — Already implicitly always-on in rs-trafilatura (its `ExtractResult` always carries a `Metadata` struct). Exposing the flag is a lie.

**`max_tree_size`** — DOM-node ceiling. Niche, undocumented in rs-trafilatura, and the kind of knob people only reach for when they've already hit a problem. Add it then.

**`date_extraction_params`** — Pass-through to `htmldate`. rs-trafilatura doesn't appear to expose htmldate tunables. Drop.

**`record_id`** — Identifier echoed back into XML/TEI output. Useless when you're not emitting TEI.

**`settingsfile`** — Pointer to a custom `settings.cfg`. rs-trafilatura is compiled Rust and doesn't load Python's `settings.cfg`. The flag is meaningless in this context.

**`fast` / `no_fallback`** — See Part 1.

## 2.2 Demote (don't expose as flags; keep as internal defaults you can revisit)

**`include_formatting`** — Markdown output forces it on regardless. Text output ignores it. The flag only matters for XML output, which contextractor-ts probably shouldn't expose either. Hide it.

**`deduplicate`** — Useful, but its mechanism (LRU-cache-based segment dedup using `MIN_DUPLCHECK_SIZE` and `MAX_REPETITIONS` from `settings.cfg`) is one rs-trafilatura doesn't expose tunables for. If rs-trafilatura supports the flag, default it to `false` and don't expose it; users who hit duplicated paragraphs across crawled pages should solve it at the pipeline layer, not per-extraction. If rs-trafilatura doesn't even expose the flag (the README doesn't show it), the question answers itself.

## 2.3 Keep (the real surface)

- **`mode`** (the `ExtractionMode` enum from `./extraction-mode-research.md`) — the actual quality knob people tune.
- **`includeComments`, `includeTables`, `includeImages`, `includeLinks`** — content shape, all confirmed in rs-trafilatura's README example, all things users genuinely toggle for their downstream pipeline.
- **`outputFormat`** — limited to what rs-trafilatura actually emits: `txt` and `markdown` (plus `html` if `content_html` is exposed). Don't list `xml`, `xmltei`, `csv`, `json` as options when rs-trafilatura doesn't produce them.
- **`targetLanguage`** — *if* rs-trafilatura supports it. The README doesn't show it; verify against the `Options` struct source. If absent, drop.
- **`url`** — passthrough for relative-link resolution. Confirmed in rs-trafilatura's README.

## 2.4 The shape this leaves you with

```ts
export type ExtractionMode = "precision" | "balanced" | "recall";
export type OutputFormat   = "txt" | "markdown" | "html";

export interface ExtractInput {
  mode?: ExtractionMode;          // default: "balanced"
  outputFormat?: OutputFormat;    // default: "markdown" (matches contextractor-ts positioning)
  includeComments?: boolean;      // default: true
  includeTables?: boolean;        // default: true
  includeImages?: boolean;        // default: false  (experimental upstream)
  includeLinks?: boolean;         // default: false  (experimental upstream)
  url?: string;
  // targetLanguage?: string;     // only if rs-trafilatura exposes it
}
```

That's 6–7 fields plus `url`. Compare to Trafilatura Python's 20+ kwargs. Each one cut is a documentation page you don't have to write, a test case you don't have to maintain, and a footgun a user can't pull.

## 2.5 Verification step before committing to this drop list

The honest blocker: the rs-trafilatura README shows ~8 fields explicitly but claims "28 options." The other 20 are dark matter to this review. Before finalizing the drop list, grep the actual `Options` struct in the rs-trafilatura source — `find . -name "*.rs" -path "*options*"` in the crate — and any flag visible there that's recommended for dropping deserves a second look. The verdict above is right *given the published surface*; it may need one round of correction once the actual struct is visible.
