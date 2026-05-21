# Spelling Autofix — Fix Plan

> Full analysis and rationale: [`context/research.md`](context/research.md)

All 205 cspell flags from the 2026-05-20 run are false positives — no genuine typos were found. Root cause: `cspell.json` does not exist at the repo root, so cspell uses only the default English dictionary and flags every Rust crate name, domain term, and proper noun in the codebase.

Three actions fix this permanently.

## Action DEPS: Install cspell Dictionaries

```bash
pnpm add -D cspell @cspell/dict-rust @cspell/dict-git @cspell/dict-bash @cspell/dict-en-gb
```

## Action CONFIG: Create cspell.json

Create `cspell.json` at the repo root. This configuration covers all 205 false positive categories:

- `"language": "en,en-GB"` — activates both English dialects; suppresses `behaviour`, `initialises`, and all other intentional British spellings without listing them individually
- `"enableGlobDot": true` — enables scanning `.claude/**/*.md`; without this, the entire `.claude/` directory is silently skipped
- `generated-region` pattern — suppresses `DOMCONTENTLOADE` inside `<!-- @generated:start -->` ... `<!-- @generated:end -->` blocks
- `apify-actor-id` pattern — suppresses substrings of external IDs like `nXCKPalCKnRAQSG5S` (e.g. `RAQSG`) by ignoring runs of 16+ alphanumeric characters
- `"prompts/**"` in `ignorePaths` — excludes archived historical prompts containing legacy Python library names and author names

```json
{
  "version": "0.2",
  "language": "en,en-GB",
  "enableGlobDot": true,
  "useGitignore": true,
  "minWordLength": 4,
  "dictionaries": [
    "en_US",
    "en-gb",
    "typescript",
    "node",
    "npm",
    "softwareTerms",
    "git",
    "bash",
    "rust"
  ],
  "words": [
    "trafilatura",
    "napi",
    "crawlee",
    "apify",
    "contextractor",
    "vitest",
    "biome",
    "turbo",
    "rustup",
    "thiserror",
    "reqwest",
    "nextest",
    "mockall",
    "proptest",
    "insta",
    "ahash",
    "callgrind",
    "dhat",
    "rlib",
    "doctest",
    "frontmatter",
    "worktree",
    "worktrees",
    "dedup",
    "codegen",
    "microbenchmarks",
    "roundtrips",
    "webscraping",
    "subreddits",
    "newtype",
    "println",
    "eprintln",
    "mcpjson",
    "lxml",
    "langid",
    "pdfplumber",
    "mnda",
    "miroslavsekera",
    "barbaresi",
    "unrequested",
    "autofix",
    "napi-rs"
  ],
  "ignoreWords": [
    "RAQSG",
    "OOXML",
    "DOMCONTENTLOADE",
    "Zscript"
  ],
  "flagWords": [
    "hte",
    "teh",
    "recieve",
    "seperate"
  ],
  "ignorePaths": [
    "node_modules/**",
    "target/**",
    "dist/**",
    ".pnpm-store/**",
    "pnpm-lock.yaml",
    "Cargo.lock",
    "**/*.node",
    "autonomous-task-output/**",
    "temp/**",
    "prompts/**"
  ],
  "patterns": [
    {
      "name": "generated-region",
      "pattern": "<!--\\s*@generated[\\s\\S]*?@generated[^>]*-->"
    },
    {
      "name": "apify-actor-id",
      "pattern": "[a-zA-Z0-9]{16,}"
    }
  ],
  "ignoreRegExpList": [
    "generated-region",
    "apify-actor-id",
    "Urls",
    "Email",
    "HexValues",
    "UUID",
    "Base64"
  ],
  "overrides": [
    {
      "filename": "**/test/fixtures/**",
      "enabled": false
    },
    {
      "filename": "**/*.node",
      "enabled": false
    }
  ],
  "languageSettings": [
    {
      "languageId": "rust",
      "dictionaries": ["rust", "softwareTerms"]
    },
    {
      "languageId": "markdown",
      "language": "en,en-GB"
    },
    {
      "languageId": "typescript,javascript",
      "dictionaries": ["typescript", "node", "npm"]
    }
  ]
}
```

## Action PROMPT: Rewrite `.claude/commands/autonomous/maintenance/test/spelling-autofix.md`

Seven structural flaws in the current prompt (see [`context/research.md`](context/research.md) §Q3 for full details):

- No BOOTSTRAP step — runs cspell without verifying `cspell.json` exists; guaranteed 100% false positives when config is absent
- `head -100` truncation — hides lines 101–205; model never saw most of the run's output
- REVIEW step classifies what the config should suppress — lists 14 domain terms inline instead of delegating to `cspell.json`
- Inline word list is incomplete — 14 terms vs 40+ actual false positives
- No `--dot` flag — silently skips `.claude/**/*.md`
- Missing `**/*.toml` — Cargo.toml files are not checked
- `model: haiku` is appropriate once config is in place, but REVIEW requires judgment when false positives remain

Rewritten step structure for the command:

- **BOOTSTRAP** — verify `cspell.json` exists at repo root; if absent, write error to report and exit (do not run without config)
- **COUNT** — run `npx cspell "**/*.ts" "**/*.md" "**/*.json" "**/*.toml" --no-progress --words-only --unique --dot 2>&1` and count lines with `wc -l`; if 0, skip to REPORT
- **REVIEW** (only if count > 0) — for each flagged word: fix if genuine prose typo; add to `cspell.json words` if a valid domain term not yet in config; add to `ignoreWords` if an external identifier or proper noun
- **FIX** — apply in-place edits for genuine typos; record file, line, original word, and corrected word
- **REPORT** — save standard report with: files scanned, unique flagged words pre/post fix, words added to `cspell.json`, words fixed as typos, words deferred for human review

---

## False Positives Reference

Full table of the 205 false positives from the 2026-05-20 run. All are covered by the `cspell.json` above.

### `.claude/` — agents, commands, rules, skills

| Word(s) | File(s) | Reason |
|---------|---------|--------|
| `frontmatter`, `Frontmatter` | multiple agent/command/skill files | Standard term for YAML metadata block at the top of markdown files; universally understood in the static-site and prompt-engineering tooling ecosystem |
| `miroslavsekera` | multiple agent/command/skill files | GitHub username embedded in paths (e.g. `github.com/miroslavsekera/...`); not a word to spell-check |
| `thiserror`, `reqwest` | `rust-pro.md`, `rust-testing-patterns/SKILL.md` | Rust crate names |
| `println`, `eprintln` | `code-reviewer.md`, `cargo-scripts.md` | Rust macros |
| `nextest` | multiple | `cargo-nextest` test runner |
| `mockall`, `proptest`, `insta` | `rust-pro.md`, `rust-testing-patterns/SKILL.md`, `rust/SKILL.md` | Rust testing crates |
| `Newtype` | `rust-pro.md`, `rust/SKILL.md` | Rust newtype pattern |
| `dhat`, `callgrind` | `rust-performance-optimization/SKILL.md` | Heap profiler (DHAT) and Valgrind profiler tool names |
| `ahash` | `rust-performance-optimization/SKILL.md` | Rust `ahash` crate (fast hash implementation) |
| `codegen` | `rust-performance-optimization/SKILL.md` | Standard engineering abbreviation for "code generation" |
| `Microbenchmarks` | `rust-performance-optimization/SKILL.md` | Compound of "micro" + "benchmarks"; recognised engineering term |
| `rlib` | `cargo-workspace.md` | Rust library output type |
| `doctest` | `rust/SKILL.md` | Rust documentation test |
| `Zscript` | `cargo-scripts.md`, `rust/SKILL.md` | Refers to `-Z script` Rust nightly flag |
| `worktree`, `worktrees`, `WORKTREE` | `add-worktree.md`, `squash-merge-to-dev.md` | Standard `git worktree` command terminology |
| `Mcpjson` | `meta/setup.md`, `autonomous/meta/setup.md` | Fragment of camelCase identifier `enabledMcpjsonServers` (a Claude Code `settings.json` field) |
| `webscraping` | `web-research-specialist.md` | Reddit subreddit name `r/webscraping` — a URL path component, not free-form text |
| `subreddits` | `web-research-specialist.md` | Plural of "subreddit" — common informal compound |
| `roundtrips` | `rust-testing-patterns/SKILL.md` | Compound of "round" + "trips"; standard engineering term (serialisation/deserialisation round-trips) |
| `unrequested` | `prompt-modifier.md` | Valid English adjective ("not requested") |
| `pdfplumber`, `OOXML` | `skill-creator/SKILL.md` | Python PDF library and Office Open XML format names |
| `mnda` | `skill-creator/SKILL.md` | Internal reference acronym; not user-facing text |

### `apps/`, `packages/`, `tools/`

| Word(s) | File(s) | Reason |
|---------|---------|--------|
| `DOMCONTENTLOADE` | `apps/apify-actor/README.md:82` | Inside `<!-- @generated:start name="apify-input-schema" -->` region (lines 35–90); truncation of `DOMCONTENTLOADED` with trailing `…`. Must not be hand-edited — regenerated by `pnpm docs:update` |
| `dedup` | `apps/standalone/SPEC.md:37`, `packages/crawler/SPEC.md:53`, `packages/crawler/src/handler.test.ts:33,75,116`, `packages/schema/SPEC.md:19`, `packages/schema/src/source-of-truth/input.ts:120` | Intentional shorthand for "deduplication". Used consistently throughout the codebase in informal/explanatory contexts (test descriptions, spec parentheticals, CLI help text). The full term `deduplication` is used for all identifiers and titles |
| `behaviour` | `packages/crawler/SPEC.md:41` | British English spelling; used intentionally (see also `initialises`). Consistent with British English used throughout `prompts/` |
| `initialises` | `packages/crawler/SPEC.md:53` | British English spelling; used intentionally alongside `behaviour` |
| `RAQSG` | `tools/platform-test-runner/src/apify-client.ts:4` | Substring of the Apify Actor ID `nXCKPalCKnRAQSG5S` in a comment; external identifier, not a word |

### `prompts/` — archived historical documents

| Word(s) | Reason |
|---------|--------|
| `miroslavsekera` | GitHub username in paths |
| `Adrien`, `Barbaresi` | Author name (Adrien Barbaresi, creator of trafilatura) |
| `lxml`, `langid` | Python library names |
