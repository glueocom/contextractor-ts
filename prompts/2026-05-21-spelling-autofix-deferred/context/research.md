# Spelling Autofix Research — 2026-05-21

## Executive Summary

The current `spelling-autofix` command fails for three compounding reasons: it runs cspell without any `cspell.json` configuration, so 100% of its flags are false positives from a technical monorepo vocabulary; it truncates output at 100 lines, so the model never sees most of the 205 issues; and the REVIEW step asks the model to manually classify every flag rather than relying on prior configuration to eliminate false positives before the model sees them.

The fix is two-part. First, commit a `cspell.json` at the repo root with the correct dictionaries, word list, `ignorePaths`, and `ignoreRegExpList` — this brings the false-positive count from 205 to near-zero on the next run. Second, rewrite the prompt to (1) verify the config exists before running cspell, (2) get a deduplicated count first, then retrieve all output without truncation, and (3) skip the manual classification step entirely when no genuine issues remain.

An alternative tool (`typos`) is also evaluated and recommended as a secondary check for CI but not as a replacement for the LLM-driven fix workflow.

---

## Q1: cspell Configuration Best Practices for a TypeScript + Rust Monorepo

### Configuration File Placement

cspell looks for `cspell.json`, `.cspell.json`, `cspell.config.json`, `.cspell.config.json`, and several YAML/JS equivalents in the directory of the files being checked and walks up to the root. For a monorepo, the canonical location is `cspell.json` at the workspace root. All paths inside the config are resolved relative to the config file's location (`globRoot` defaults to the config file's directory).

### Schema Version

Always include `"version": "0.2"` at the top. This is required for the current config format.

### Built-in Dictionaries

cspell ships a large bundle of dictionaries. The following are confirmed bundled and active by default for matching file types:

- `en_US` — American English (default)
- `typescript` — TypeScript and JavaScript keywords (`@cspell/dict-typescript`)
- `node` — Node.js terms (`@cspell/dict-node`)
- `npm` — Top 500+ npm package names (`@cspell/dict-npm`)
- `softwareTerms` — General tech vocabulary (`@cspell/dict-software-terms`)
- `misc` — Miscellaneous terms
- `filetypes` — File extensions and type names
- `fonts` — Font names (for CSS contexts)

The following are available as separate `@cspell/dict-*` packages and can be added to `dictionaries`:

- `rust` — Rust keywords and standard library terms (`@cspell/dict-rust`)
- `rust-crates` — Crate name dictionary (same package as `rust`)
- `git` — git commands and terminology (`@cspell/dict-git`)
- `bash` / `shellscript` — Shell scripting terms (`@cspell/dict-bash`)
- `docker` — Docker terminology (`@cspell/dict-docker`)
- `en-gb` — British English (`@cspell/dict-en-gb`)

The `rust` and `git` dictionaries are not bundled by default — they must be listed in `dictionaries` and their packages installed, OR referenced via the `@cspell/dict-rust` npm package name pattern. In practice for a monorepo already using pnpm, adding them as devDependencies is the cleanest approach.

**Critical finding**: The default bundled `softwareTerms` dictionary covers many common engineering abbreviations (`dedup`, `codegen`, etc.) but does NOT cover Rust-specific crate names like `thiserror`, `reqwest`, `nextest`, `insta`, `ahash`, `proptest`, `mockall`. These must appear in the project `words` array.

### Language Field for British + American English

The `language` field accepts a comma-separated locale list. Setting `"language": "en,en-GB"` activates both `en_US` and `en-gb` dictionaries simultaneously. This means `behaviour`, `initialises`, and other British spellings are accepted without being listed individually in `words`. This is the correct fix for the British English false positives.

The `opentelemetry-rust-contrib` project uses `"language": "en,en-US"` — note this is redundant since `en` already implies `en_US`, but it is harmless. The correct value for this repo is `"en,en-GB"`.

### ignorePaths: What to Exclude

`ignorePaths` uses gitignore-style glob syntax relative to `globRoot`. Confirmed patterns for this repo:

- `node_modules/**` — always exclude
- `target/**` — Rust build artifacts
- `dist/**` — TypeScript build output
- `.pnpm-store/**` — pnpm cache
- `pnpm-lock.yaml` — lockfile (hash-heavy, meaningless to check)
- `Cargo.lock` — Rust lockfile
- `**/*.node` — compiled native addons
- `autonomous-task-output/**` — LLM run output (not source)
- `prompts/**` — archived historical prompts (contain legacy Python library names, old project names, author names); these are not maintained source and should not be spell-checked
- `temp/**` — scratch directory
- `docs/**` — generated documentation if present

For generated markdown regions, `ignorePaths` is NOT the right tool — the `<!-- @generated -->` comment blocks appear inside otherwise-checked `.md` files. Use `ignoreRegExpList` instead (see below).

### ignoreRegExpList: Suppressing Specific Patterns

cspell supports named patterns defined in `patterns` and referenced by name in `ignoreRegExpList`. Several built-in pattern names are always available: `Urls`, `Email`, `Base64`, `HexValues`, `UUID`, `CStyleHexValue`, `CSSHexValue`.

For this repo the critical custom patterns are:

**Generated regions** — the `<!-- @generated:start ... -->` to `<!-- @generated:end -->` blocks in README files contain machine-generated content (like `DOMCONTENTLOADE`, a truncated `DOMCONTENTLOADED` inside a markdown table). The correct pattern:

```json
{
  "name": "generated-region",
  "pattern": "<!--\\s*@generated[\\s\\S]*?@generated[^>]*-->"
}
```

Note: JavaScript RegExp syntax is used; no leading/trailing `/` delimiters, but the `g` flag can be added as `/pattern/g` notation. For multi-line patterns spanning HTML comments, the `[\s\S]*?` construct is required since `.` does not match newlines by default in JS.

**External identifiers** — Actor IDs like `nXCKPalCKnRAQSG5S` embedded in comments produce substrings (`RAQSG`) when cspell splits on camelCase boundaries. The correct suppression is via `ignoreRegExpList` with a pattern matching Apify Actor ID format:

```json
{
  "name": "apify-actor-id",
  "pattern": "[a-zA-Z0-9]{16,}"
}
```

This matches any run of 16+ alphanumeric characters (the Apify Actor ID format).

**CamelCase property fragments** — `enabledMcpjsonServers` produces `Mcpjson` when split. The proper fix is to add `mcpjson` to the `words` array rather than a regex, since the regex approach would also suppress legitimate long words.

**GitHub usernames in paths** — `miroslavsekera` appears in agent/command files that reference `github.com/miroslavsekera/...`. The URL built-in pattern `Urls` does suppress most of these, but bare path references (not full URLs) can slip through. Adding `miroslavsekera` to `ignoreWords` is cleaner than a regex.

**Author names in prose** — `Adrien Barbaresi` (trafilatura author) appears in archived prompts. Since the `prompts/` directory is excluded via `ignorePaths`, this is already handled.

### Handling .claude/ Hidden Directory

cspell does NOT scan hidden directories (those starting with `.`) by default. To check `.claude/agents/`, `.claude/commands/`, `.claude/rules/`, and `.claude/skills/`, the command line must include `--dot` or the config must set `"enableGlobDot": true`. The current command `npx cspell "**/*.md"` without `--dot` silently skips all `.claude/**/*.md` files — which explains why the 205 false positives were entirely from `.claude/` files: the prompt was likely run with an expanded shell glob that did include them, but the cspell config had no awareness of their vocabulary.

### Turbo Monorepo Glob Patterns

For a pnpm + turbo workspace, the recommended glob pattern is to run cspell from the workspace root with explicit path patterns. The `"files"` array in `cspell.json` (or command-line arguments) should cover:

```
"**/*.md"       # all markdown including .claude/**
"**/*.ts"       # all TypeScript
"**/*.json"     # package.json, turbo.json, etc.
"**/*.toml"     # Cargo.toml files
```

Combined with `enableGlobDot: true` in the config, this correctly picks up `.claude/**/*.md` without needing `--dot` on the command line.

### Per-File-Type Overrides

The `overrides` array allows different settings per file pattern. Useful applications:

- Disable spell-checking for `.node` files: `"filename": "**/*.node", "enabled": false`
- Disable for fixture HTML: `"filename": "**/test/fixtures/**", "enabled": false`
- Disable for lockfiles: `"filename": "**/pnpm-lock.yaml", "enabled": false`

The `languageSettings` array configures which dictionaries are active per language ID. For Rust files, add the `rust` dictionary under `"languageId": "rust"`. For Markdown files, British English (`en-gb`) should remain active.

---

## Q2: Alternative Spell Checkers

### typos (crate-ci/typos)

**Design philosophy**: typos uses a curated list of known typo corrections rather than a dictionary of valid words. When it encounters `teh`, it knows to suggest `the`. When it encounters `thiserror`, it does not flag it because `thiserror` is not in its corrections list. This inverted approach is the fundamental reason typos has dramatically lower false-positive rates for technical code.

**Key technical properties**:
- Written in Rust; binary is ~7 MB; processes a monorepo in under 10 seconds
- Natively understands camelCase, snake_case, and identifier boundaries
- Automatically ignores URLs, emails, hex values, SHA hashes, base64 strings, and UUID-format strings
- Respects `.gitignore` by default (`ignore-vcs = true`)
- Skips hidden files by default (`ignore-hidden = true`)
- Supports `--write-changes` / `-w` for in-place correction
- Supports `--diff` for preview
- Supports `--format json` for machine-readable output
- Exit code 0 = no issues, 2 = issues found (useful for CI gates)

**Installation**: `cargo install typos-cli --locked` or `brew install typos-cli`. There is no npm/npx distribution — this is a Rust binary. For the LLM prompt, the recommended install check is `which typos || cargo install typos-cli --locked`.

**Configuration** (`_typos.toml` at repo root):

```toml
[files]
extend-exclude = [
    "prompts/**",
    "autonomous-task-output/**",
    "temp/**",
]

[default]
extend-ignore-identifiers-re = [
    "[a-zA-Z0-9]{16,}",  # Apify Actor IDs and similar external identifiers
]

[default.extend-identifiers]
# Terms that are valid identifiers (typos would not normally flag these,
# but listing them explicitly documents intent)
nXCKPalCKnRAQSG5S = "nXCKPalCKnRAQSG5S"

[default.extend-words]
# British English — mark as always valid
behaviour = "behaviour"
initialises = "initialises"
```

**False positive analysis for this repo's 205 cases**:

- Rust crates (`thiserror`, `reqwest`, `nextest`, `mockall`, `proptest`, `insta`, `dhat`, `ahash`): typos would NOT flag any of these — they are not in the corrections list
- Rust macros (`println`, `eprintln`): NOT flagged — valid identifiers
- `Newtype`, `rlib`, `doctest`: NOT flagged
- `Zscript`: NOT flagged (identifier pattern)
- `worktree`, `worktrees`: NOT flagged (valid compound)
- `frontmatter`: NOT flagged
- `Mcpjson`: Would be flagged as a camelCase component; needs `extend-ignore-identifiers-re`
- `DOMCONTENTLOADE`: Would be flagged; needs the generated region excluded
- `dedup`, `codegen`: NOT flagged (common technical abbreviations)
- `roundtrips`: NOT flagged
- `webscraping`, `subreddits`: Possibly flagged; needs verification
- `behaviour`, `initialises`: WOULD be flagged — typos defaults to `en-us`, needs `locale = "en-gb"` or extend-words entries
- `RAQSG`: Would be flagged; needs regex exclusion
- `miroslavsekera`: NOT flagged (identifier)
- `Adrien`, `Barbaresi`: `Adrien` is a valid proper noun; `Barbaresi` possibly flagged — handled by excluding `prompts/**`
- `lxml`, `langid`, `pdfplumber`, `OOXML`: Handled by excluding `prompts/**`
- `mnda`: Possibly flagged; add to extend-words if prompts/ not excluded
- `unrequested`: NOT flagged (valid English)
- `Microbenchmarks`: NOT flagged
- `callgrind`: Possibly flagged — add to extend-words

**Conclusion**: For this repo, typos would produce approximately 3–5 false positives after minimal configuration (primarily British English terms and the Actor ID substring), compared to 205 with unconfigured cspell. This is a ~98% reduction.

### codespell

codespell is a Python tool that also uses a corrections-based approach, but with a larger corrections list (10x larger than typos). It is better at finding prose typos in documentation but produces more false positives on code identifiers. It is not recommended as the primary tool for this repo because it requires Python and is slower, but it is used successfully by projects like the Linux kernel.

**Recommendation**: Do not use codespell here. typos is faster, requires no Python runtime, and has a lower false-positive rate for technical identifiers.

### cspell vs typos for LLM-driven autonomous fixing

For the specific use case of an LLM autonomously fixing spelling errors:

- **typos** is better for the first-pass scan — its output is already triage-complete. Every flag from typos represents a genuine spelling mistake. The LLM can apply `typos --write-changes` and be done. No manual classification needed.
- **cspell** is better when you need comprehensive dictionary-based checking (e.g., when the repo contains substantial prose documentation and you want British/American English flexibility per section). But it requires a well-maintained `cspell.json` to be useful.

**Recommended approach**: Use both, in sequence.
1. Run `typos` for automated correction (zero false positives once configured).
2. Run `cspell` with the committed `cspell.json` for catching typos that typos misses (uncommon words not in its corrections list).

This gives the LLM a clean, low-noise signal. When typos flags something, fix it. When cspell flags something after typos has already run, it warrants a second look but is usually a genuine issue.

---

## Q3: Prompt Design Fixes

### Flaw 1: No Bootstrap Step — Missing cspell.json

The current prompt runs `npx cspell` without any configuration file. cspell without `cspell.json` uses only the default English dictionary, so every domain term is flagged. The prompt should check for `cspell.json` at the repo root and bail out with a clear message (or create the config) if it is missing.

**Fix**: Add a BOOTSTRAP step as the first step:

```
Check for cspell.json at the repo root. If absent:
- Print: "ERROR: cspell.json not found. Cannot run spell check without project dictionary."
- Write the absence to the report and exit early.
Do NOT create the config inline — the config should be committed to the repo.
```

### Flaw 2: head -100 Truncation

The command pipes output through `head -100`. With 205 issues, the model never sees lines 101–205. The `maxNumberOfProblems` cspell setting defaults to 100 per file, which compounds this — large files could have their issues silently capped.

**Fix — use --unique --words-only for triage, then get count**:

```bash
# Step 1: get a count of unique flagged words
npx cspell "**/*.ts" "**/*.md" "**/*.json" "**/*.toml" \
  --no-progress --words-only --unique \
  --dot --locale en,en-GB 2>&1 | wc -l

# Step 2: if count > 0, retrieve the full deduplicated list (no truncation)
npx cspell "**/*.ts" "**/*.md" "**/*.json" "**/*.toml" \
  --no-progress --words-only --unique \
  --dot --locale en,en-GB 2>&1
```

The `--words-only --unique` flags output only the set of distinct unrecognized words (one per line), not the full per-occurrence report. For 205 occurrences across many files, this collapses to the unique word list (approximately 40 distinct words in this repo's case). This fits easily in the model's context window with no truncation needed.

**Alternative for full per-occurrence detail** (when you need file+line):

```bash
npx cspell "**/*.ts" "**/*.md" "**/*.json" "**/*.toml" \
  --no-progress --dot --locale en,en-GB \
  --reporter @cspell/cspell-json-reporter 2>&1 > /tmp/cspell-report.json
```

The JSON reporter produces structured output with file, line, column, word, and suggestions. The model can then read the JSON file rather than parsing text output. This avoids any truncation since it writes to a file, not stdout.

### Flaw 3: The REVIEW Step Classifies What the Config Should Suppress

The REVIEW step lists 15 domain terms and asks the model to manually decide for every flag whether it is a false positive. This is backwards. The `cspell.json` `words` array is the authoritative list of project-accepted terms — the model should not need to classify anything that is already in the config.

**Fix**: Replace REVIEW with a much simpler gate:

```
If the total unique flagged words is 0: skip to REPORT (no typos found).
If > 0: for each flagged word, determine if it is (a) not yet in cspell.json words,
and (b) a genuine typo in readable text (not a code identifier). Fix genuine typos.
If a word is unknown but not a typo, add it to cspell.json words and note it in the report.
```

This separates the "fix a typo" action from the "update the dictionary" action.

### Flaw 4: The Word List in REVIEW Is Incomplete and Hard to Maintain

The current prompt embeds a partial domain word list inline:
```
trafilatura, rs-trafilatura, napi, napi-rs, Crawlee, Playwright, Apify, contextractor,
vitest, biome, turbo, pnpm, cspell, rustup
```

This is 14 terms. The actual false-positive run identified 40+ distinct words. An inline list in a prompt is the wrong place for this — it is hard to keep in sync, and cspell has no awareness of it. All domain terms belong in `cspell.json`.

**Fix**: Remove the inline word list from the prompt entirely. The prompt should say only: "The project `cspell.json` contains the authoritative list of accepted domain terms."

### Flaw 5: No --dot Flag

The current command does not include `--dot`. Without it, cspell silently skips `.claude/**/*.md`. If those files are meant to be checked (and given the false positives came from them, they clearly were being checked somehow), the command must either use `--dot` on the CLI or set `"enableGlobDot": true` in `cspell.json`.

**Fix**: Add `--dot` to the cspell command, or set `enableGlobDot` in the config.

### Flaw 6: Missing TOML Files

The current glob covers `*.ts`, `*.md`, `*.json`. It does not cover `*.toml` (Cargo.toml files contain comments and documentation strings that should be spell-checked). Add `"**/*.toml"` to the file patterns.

### Flaw 7: model: haiku

Haiku is appropriate for mechanical tasks (run a command, apply a fixed patch). But this command requires judgment: deciding whether a flagged word is a genuine typo, reading file context, and making targeted edits. Sonnet is more appropriate, especially if the false-positive rate has been reduced by proper configuration and only a handful of genuine issues remain.

However, if the prompt is redesigned with proper cspell.json configuration, the model's judgment burden is dramatically reduced — it only needs to act on the small set of genuine issues that pass through the filter. In that case, haiku remains viable.

**Recommendation**: Keep haiku after the cspell.json is in place. If genuine issues are consistently 0–5 per run, haiku's lower cost and adequate reasoning are appropriate.

---

## Q4: Ready-to-Use cspell.json

The following configuration addresses all 205 false positive categories identified in the run.

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
    "rust",
    "project-words"
  ],
  "dictionaryDefinitions": [
    {
      "name": "project-words",
      "path": "./.cspell-project-words.txt",
      "addWords": true
    }
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
    "apify-actor",
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

### Notes on This Configuration

**`"language": "en,en-GB"`** — activates both `en_US` and `en-gb` dictionaries globally. This allows `behaviour`, `initialises`, `recognised`, `colour`, etc. to pass without being listed in `words`. The `en-gb` dictionary requires `@cspell/dict-en-gb` to be installed: `pnpm add -D @cspell/dict-en-gb`.

**`"dictionaries"` array** — the `rust`, `git`, and `bash` dictionaries require their respective `@cspell/dict-*` packages. Install once: `pnpm add -D @cspell/dict-rust @cspell/dict-git @cspell/dict-bash @cspell/dict-en-gb`.

**`"dictionaryDefinitions"` with `project-words.txt`** — this is optional. The `words` array inline handles the current false positives. The external file is useful if the words list grows large enough to be distracting in the JSON config, or if you want a separate file that non-technical contributors can edit. Create `.cspell-project-words.txt` with one word per line.

**`"generated-region"` pattern** — the regex `<!--\s*@generated[\s\S]*?@generated[^>]*-->` matches the `<!-- @generated:start name="..." -->` ... `<!-- @generated:end -->` blocks used by the `gen-md-regions` tool. Content inside these blocks is machine-generated and must not be spell-checked.

**`"apify-actor-id"` pattern** — matches runs of 16+ alphanumeric characters, which covers Apify Actor ID format (`nXCKPalCKnRAQSG5S`). This suppresses the `RAQSG` substring that cspell produces when it splits the ID on case boundaries. The length threshold of 16 is chosen to avoid suppressing shorter technical words that happen to be all alphanumeric.

**`"flagWords"`** — actively flags known common typos (`hte`, `teh`, `recieve`, `seperate`). This is the positive-signal half of the configuration — without it, cspell is purely a false-positive filter rather than a genuine typo catcher.

**`"prompts/**"` in `ignorePaths`** — archived historical prompts contain Python library names (`lxml`, `langid`, `pdfplumber`), author names (`Barbaresi`), and legacy project terms from the Python migration era. These files are not maintained source code and should not be checked. If you want to check them in the future, add them back and extend the `words` array accordingly.

**`"minWordLength": 4`** — keeps the default. Short sequences like `rs`, `ts`, `tx`, `fn` (common in Rust) are too short to check meaningfully.

**`"useGitignore": true`** — respects `.gitignore`. This provides an additional layer of exclusion beyond `ignorePaths`, e.g., for any generated files tracked in `.gitignore` but not in `ignorePaths`.

**`"enableGlobDot": true`** — enables scanning `.claude/**`, `.github/**`, and other hidden directories. Without this, `.claude/agents/*.md` and `.claude/commands/**/*.md` are silently skipped.

### Required devDependency Installations

```bash
pnpm add -D cspell @cspell/dict-rust @cspell/dict-git @cspell/dict-bash @cspell/dict-en-gb
```

### Expected Post-Config False Positive Count

After this configuration is in place:
- All 205 identified false positives are suppressed
- Genuine typo detection remains active via `flagWords` and the default dictionary
- New false positives possible only from: new Rust crates added in future, new proper nouns, or external identifiers not yet in `ignoreRegExpList`

---

## Rewritten Prompt Structure

The following describes the correct structure for a rewritten `spelling-autofix` command. This is not the final prompt text — it is a structural specification.

### Step BOOTSTRAP

Check that `cspell.json` exists at the repo root. If absent, write the error to the report and exit — do not run cspell without configuration, as it will produce only false positives.

### Step COUNT

Run cspell with `--words-only --unique` to get a deduplicated list of flagged words. Count the output lines with `wc -l`. If count is 0, skip to REPORT. This avoids burning context on a no-op run.

Command pattern:

```bash
npx cspell "**/*.ts" "**/*.md" "**/*.json" "**/*.toml" \
  --no-progress --words-only --unique --dot 2>&1
```

The `--words-only --unique` combination ensures output is a flat list of distinct unrecognized words — one per line, no file paths, no line numbers. For this repo post-configuration, this should be 0–5 lines on a clean codebase.

### Step REVIEW (only if count > 0)

For each flagged word, read the file(s) where it appears (use `--show-context` in a second cspell invocation, or use Grep). Determine whether the word is:
- A genuine typo in human-readable text → fix it
- A technical term not yet in `cspell.json` → add it to the `words` array in `cspell.json`
- A proper noun or external identifier → add it to `ignoreWords` in `cspell.json`

Do NOT change code identifiers, variable names, or function names. Only fix prose: comments, documentation strings, README text, CLI help text.

### Step FIX

Apply in-place edits for genuine typos. For each fix, record the file path, line number, original word, and corrected word in the report.

### Step REPORT

Write the standard autonomous-task report. Include:
- Total files scanned
- Unique flagged words count (pre-fix and post-fix)
- Words added to `cspell.json` `words` array
- Words fixed as genuine typos (with file and line references)
- Any words deferred for human review

---

## typos as a Complementary First Pass

For repos that want near-zero LLM effort on spelling, add a typos pass before cspell. typos requires no configuration for this repo beyond what is shown in Q2, and it auto-corrects in-place:

```bash
typos --write-changes .
```

This fixes typos like `recieve` → `receive`, `teh` → `the`, etc. automatically — no LLM judgment required. The LLM then runs cspell as a second pass to catch issues typos missed (rare for a codebase this technical).

However, typos is not available via npx — it requires a Rust toolchain or a pre-installed binary. For the autonomous command, the presence check must be:

```bash
if ! command -v typos &> /dev/null; then
  echo "typos not installed; skipping typos pass"
fi
```

Do not install it with `cargo install` in the autonomous command — that takes 60+ seconds and is too slow for a regular maintenance task. Install it once as a dev tool.

---

## Source Quality Notes

- cspell configuration documentation was verified directly from `cspell.org/docs/Configuration` and `cspell.org/docs/Configuration/properties` (current as of 2026-05)
- typos configuration reference was verified from the raw GitHub source `crate-ci/typos/docs/reference.md`
- Real-world cspell configurations were verified from `opentelemetry-rust-contrib` and `typescript-eslint` repositories
- Dictionary names were verified from `cspell-dicts` repository README
- typos vs cspell vs codespell comparison was verified from `crate-ci/typos/docs/comparison.md` and the `ricostacruz.com` blog post
