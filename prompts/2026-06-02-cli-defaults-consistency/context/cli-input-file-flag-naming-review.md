# CLI `--input-file` flag naming review

Scope: rename the standalone CLI flag `--input-file <file>` to a name that clearly means **"start URLs
supplied from a file"**, and make the path/file-valued flags (notably `-c, --config <path>`) consistent.
Authority order for this review mirrors the repo's locked policy: **Crawlee → extraction wrapper →
internal consistency**, with general CLI conventions and the wider crawler/scraper ecosystem as
*tertiary* inspiration only (per `prompt.md:25-33`). Research date: 2026-06-03.

## RECOMMENDATION

Rename **`--input-file <file>` → `--start-urls-file <path>`** (Commander prop `startUrlsFile`), and
**keep `-c, --config <path>` unchanged**. This closes the single real placeholder outlier and makes all
four path-valued flags uniform on `<path>`:

| Flag | Before | After |
|---|---|---|
| start-URLs file | `--input-file <file>` | `--start-urls-file <path>` |
| config | `-c, --config <path>` | `-c, --config <path>` (unchanged) |
| storage dir | `--storage-dir <path>` | unchanged |
| output dir | `--output-dir <path>` | unchanged |

Why this over the alternatives: it directly answers the framing ("*something like `startUrls` but indicate
it is from a file*"), it mirrors the locked schema key `startUrls` / title **"Start URLs"**, and it conveys
**both** load-bearing meanings at once — *which* URLs (crawl seeds) and *from where* (a file). The strong
runner-up is the more concise **`--urls-file <path>`**; the trade-off is discussed under
[Options](#options-ranked) and [Open questions](#open-questions--follow-ups).

This is a **CLI-only flag rename — no Zod/schema change** (the flag has no backing schema key; its content
merges into the existing `startUrls` array).

---

## TL;DR

- **`--input-file` is misleading and actively collides with Apify's own vocabulary.** The Apify CLI's
  `--input-file` / `-f` passes the *entire Actor INPUT JSON document* (`apify run --input-file`,
  `apify call -f`), **not** a URL list. Keeping `--input-file` here means the same flag name means two
  different things across the Apify toolchain the repo lives in — a reason to rename, not keep.
- **`--start-urls-file <path>`** is the most self-documenting, repo-consistent choice; **`--urls-file
  <path>`** is the concise runner-up favored by the idiomatic-short-form rule.
- **Keep `-c, --config <path>`.** It is the dominant config-flag convention (curl `-K/--config`, docker
  `--config`, wget `--config`) and a sibling CLI-only orchestration flag. The only consistency defect is
  the lone `<file>` placeholder on `--input-file`; fix it by giving the renamed flag `<path>` (the repo's
  de-facto convention: 3 of 4 path flags already use `<path>`).
- Two **orthogonal follow-ups** (not part of the rename): add stdin `-` support, and optionally keep
  `--input-file` as a hidden deprecation alias for one release.

---

## The question

`--input-file <file>` reads URLs one-per-line from a file and merges them into the `startUrls` array. It
should be renamed to indicate it feeds **start URLs from a file**, and the result should be consistent with
the sibling path flag `-c, --config <path>` (which currently uses a different placeholder).

---

## Current state (codebase facts — cited)

- **`--input-file <file>`** — CLI-only flag, not in the schema. `readFile(inputFile, 'utf8')`, split on
  `\n`, trim, skip blank/`#`-comment lines, append to the positional `[urls...]`
  (`apps/standalone/src/cliProgram.ts:640`, handler `:447-458`).
- **`-c, --config <path>`** — CLI-only flag, not in the schema. Loads a JSON file via
  `loadConfigFile(opts.config)` → `JSON.parse` (`cliProgram.ts:139`, `config.ts:152-165`). Always a file,
  never a directory.
- **`startUrls`** — schema key, `z.array(z.object({ url }).loose()).min(1)`, title **"Start URLs"**, Apify
  editor `requestListSources` (`packages/schema/src/source-of-truth/input.ts:24-34`). Listed as a
  **KEEP / do-not-rename** key (`prompt.md:95`).
- **Merge precedence** — positional `[urls...]` + `--input-file` lines concatenate, then
  `{ ...fromFile, ...fromCli }` so CLI sources **overwrite** `--config.startUrls`; error if the total is
  empty (`cliProgram.ts:447-465`). This precedence is correct and **must not change** during the rename.
- **Placeholder inventory** — every path-valued flag uses `<path>` **except** `--input-file`:
  `-c, --config <path>` (`:139`), `--storage-dir <path>` (`:255`, `:668`), `--output-dir <path>` (`:665`),
  vs the lone `--input-file <file>` (`:640`). Named-resource flags correctly use `<name>`
  (`--dataset`/`--key-value-store`/`--request-queue`); `--proxy <url>` and `--cookies <json>` are out of
  scope.
- **Lineage** — `--input-file <file>` was introduced in commit `1ac52ce` ("add Crawlee storage layer and
  CLI subcommands") and **never revisited**. The big Crawlee-alignment pass (`b11692a`) renamed ~14
  crawler flags but deliberately left `--input-file` and `--config` untouched as *CLI-only orchestration
  flags*. So the current name and its `<file>` placeholder are **legacy, not a locked decision**.

## Repo naming philosophy & constraints (cited)

- **Flag-mirrors-schema-key** — CLI flags mirror the camelCase schema key in kebab-case, diverging only for
  a short idiomatic spelling where one exists (`prompt.md:25-28, 113`).
- **CLI-only orchestration flags have no key to mirror** — `--config`, `--storage-dir`, `--output-dir`,
  `--verbose`, `--clean`, `--input-file`, and `--save all` are explicitly listed as living *outside* the
  schema (`meta/meta-prompt.md:20`). So `--input-file` **cannot mechanically derive** its name from a key
  the way `--globs` derives from `globs`; it must read clearly on its own as a source for `startUrls`.
- **Idiomatic-short-form rule** — flags may be shorter/more idiomatic than their key; the repo **rejected**
  `--max-retries → --max-request-retries` and `--respect-robots-txt → --respect-robots-txt-file` as
  "length without clarity" (`prompt.md:105, 113`). This is the main argument *against* a long name.
- **Enum/casing discipline** — CLI surface is uniformly kebab-case (`prompt.md:38-40`); any rename stays
  kebab-case.
- **Crawlee is NOT the authority for orchestration flags** — Crawlee governs crawler-layer params only
  (`prompt.md:25-33`). *(Inference, labeled):* the nearest Crawlee analog, `requestsFromUrl`, does **not**
  appear anywhere in the repo (grep-verified) and is a JS-API source descriptor, not an input-field name —
  so it is **not** a repo precedent and should not be cited as one.

---

## Industry & ecosystem research (cited)

### Crawler / scraper / HTTP CLIs — "list of URLs from a file"

| Tool | Flag (file-of-URLs) | Placeholder | Config flag | Source (fetched 2026-06-03) |
|---|---|---|---|---|
| wget | `-i, --input-file` | `file` | `--config=FILE` | man7.org wget.1 |
| curl | `--url @file` (v8.13.0+, 2025) | `@filename` | `-K, --config <file>` | curl.se/docs, everything.curl.dev |
| yt-dlp | `-a, --batch-file` | `FILE` | `--config-locations PATH` | yt-dlp README / man |
| nuclei | `-l, -list` | `string` | `-config` | docs.projectdiscovery.io |
| httpx | `-l, -list` | `string` | `-config` | docs.projectdiscovery.io |
| subfinder | `-dL, -list` | `string` | `-config` | docs.projectdiscovery.io |
| katana | `-list` (also `-u`) | `string[]` | `-config` | docs.projectdiscovery.io |
| gospider | `-S, --sites` (list) / `-s, --site` | `string` | — | gospider README |
| gau | stdin / positional | — | `--config` | gau README |
| hakrawler | stdin only | — | — | hakrawler README |
| feroxbuster | `--stdin` / `-u, --url` | `URL` | auto `ferox-config.toml` | feroxbuster README |
| ffuf | `-w` (wordlist, not URLs) | `wordlist` | `-config <file>` | ffuf README |

Patterns: (1) **`-i/--input-file`** — the GNU/Unix download classic (wget); (2) **`-l/--list`** — the
entire ProjectDiscovery crawler/HTTP suite; (3) **stdin-only** (hakrawler, gau) as a pipeline idiom. No
modern crawler uses `--input-file`; ProjectDiscovery's `-l/--list` is the strongest **same-domain**
precedent, but it names the *value* (a list), not the *source* (a file), and is **tertiary authority** here.

### Apify / Crawlee

- **`startUrls`** is the canonical Apify Actor input field name for crawl seeds (Apify input-schema spec
  v1; `actor-crawler-cheerio` INPUT_SCHEMA.json; Website Content Crawler), paired with the
  `requestListSources` editor — exactly what this repo's schema uses (`input.ts:29-31`).
- **`requestsFromUrl`** is the Crawlee JS-API property (inside a `RequestList` `sources` object) that loads
  URLs from a remote text file. It is **not** an Actor input-field name and **never** appears as a
  top-level field; no Apify actor surfaces "URL list from file" as a named input field
  (crawlee.dev RequestList docs).
- **The Apify CLI's `--input-file` / `-f`** passes the **whole Actor INPUT JSON** (`apify run`,
  `apify call`, `apify actors:start`) — a *different* meaning. ⚠️ Reusing `--input-file` for a URL list in
  contextractor therefore **clashes** with the surrounding Apify toolchain. (apify-cli reference.)

### General CLI conventions

- **clig.dev**: support `-` for stdin on file flags; config precedence flags > env > config; no canonical
  `--input-file`/`--config` name prescribed.
- **Config-flag norm**: `--config` (short `-c`/`-K`) dominates (curl `-K/--config <file>`, docker
  `--config`, wget `--config`, git `-c name=value`). `--config-file` only when `--config` is taken or the
  value may be a directory.
- **Placeholder norm**: lowercase `<file>` for a file (gh `--body-file <file>`, curl `<file>`, wget
  `file`), `<path>` when the value may be a file *or* directory (yt-dlp `--config-locations PATH`, ripgrep
  `--ignore-file PATH`). docopt treats `<file>` and `FILE` as equivalent; Google style mandates UPPERCASE.
  *(Note: under a strict file-vs-dir reading, both `--start-urls-file` and `--config` are file-only and
  would take `<file>`; the repo's actual de-facto convention is `<path>` everywhere — see
  [Open questions](#open-questions--follow-ups).)*

---

## Options (ranked)

| # | Candidate | Pros | Cons | Precedent |
|---|---|---|---|---|
| **1** | **`--start-urls-file <path>`** | Mirrors locked key `startUrls` + title "Start URLs"; conveys *both* "start URLs" and "from a file"; answers the user's "something like startUrls" framing; kebab-case | Longest; in mild tension with the idiomatic-short-form rule | Echoes Apify `startUrls`; no exact tool uses it (descriptive compound) |
| 2 | `--urls-file <path>` | Concise; best fits idiomatic-short-form rule; avoids the verbose-rename trap | Drops the "start" qualifier (these are seeds, not arbitrary URLs); weaker key mirror | Descriptive compound; no exact tool match |
| 3 | `--url-file <path>` | Shortest semantic form | Singular understates "a list (one per line)"; drops "start" | None direct |
| 4 | `-l, --url-list <path>` | Strongest same-domain precedent (ProjectDiscovery `-l/--list`); `-l` free | ProjectDiscovery is *tertiary* authority here; names the value not the source; ignores `startUrls` | nuclei/httpx/subfinder/katana |
| 5 | `-i, --input-file <file>` (keep) | Zero churn; wget precedent | **Fails the goal** (generic); **clashes with Apify CLI's `--input-file`**; legacy `<file>` outlier | wget; Apify CLI (different meaning) |
| 6 | `--start-urls <path>` (overload) | Names the key; short | **Ambiguous** with positional `[urls...]` — users expect inline URLs, not a file path | None |

**Verdict: Option 1, `--start-urls-file <path>`.** Although the idiomatic-short-form rule (Option 2's
argument) is real, the repo rejected those earlier shortenings only because a shorter form was *also
clearer*; here no shorter form conveys both "start URLs" **and** "from a file" (`--urls-file` drops "start";
`--list` drops "file"). The user's explicit framing ("something like `startUrls`") and the self-documenting
mirror of the locked key tip the balance to Option 1. *(This last paragraph is a judgment call, not a cited
fact.)*

---

## Placeholder consistency & the `--config` decision

- **Keep `-c, --config <path>`** in both name and placeholder. It is a sibling CLI-only flag
  (`meta-prompt.md:20`), matches the dominant config-flag convention, and is already shipped. The short
  `-c` differs from git's `-c name=value` but conflicts with nothing in the crawler/scraper space.
- **The only real outlier is the `<file>` placeholder on `--input-file`.** Give the renamed flag the
  repo-dominant `<path>` → all four path flags (`--config`, `--storage-dir`, `--output-dir`,
  `--start-urls-file`) become uniform. Do **not** flip everything to a `<file>`/`<path>` file-vs-dir split
  mid-rename — that would *invent* a new convention rather than apply the existing one (see Open questions).

---

## Implementation touchpoints (CLI-only; no schema change)

1. `apps/standalone/src/cliProgram.ts:640` — `extract.option('--start-urls-file <path>', 'Read start URLs
   (one per line) from a file')`.
2. `cliProgram.ts:651, 654` — rename the destructured `opts.inputFile` → `opts.startUrlsFile` and the
   third arg passed to `runExtractAction`.
3. `cliProgram.ts:449-458` — rename the local `inputFile` param in `runExtractAction`; **leave the merge
   precedence at `:447-460` unchanged**.
4. Regenerate the `@generated:cli-flags` region in `apps/standalone/README.md` via `pnpm docs:update`;
   update the hand-written README examples (~`:42, 46, 49`) and `apps/standalone/SPEC.md` if it documents
   the flag (`spec-maintenance` rule).
5. Update any CLI-parser test referencing `--input-file` (`test-maintenance` rule).
6. `ExtractOpts` (`cliProgram.ts:735-784`) has **no** `inputFile` property to change — it is handled
   outside the interface.

---

## Open questions / follow-ups

1. **Placeholder rule (team decision).** If the team prefers the well-precedented file-only `<file>` vs
   file-or-dir `<path>` distinction (yt-dlp `--batch-file FILE` / `--config-locations PATH`; ripgrep
   `-f PATTERNFILE` / `--ignore-file PATH`), the choice flips to `--start-urls-file <file>` **and**
   `--config <file>`, reserving `<path>` for the true directories `--storage-dir` / `--output-dir`. This
   review defers to the repo's current `<path>`-everywhere convention to avoid inventing a rule mid-change.
2. **Deprecation alias.** `--input-file` has shipped since `1ac52ce`. If scripts depend on it, keep it as a
   hidden Commander alias for one release rather than a hard break. The task framing implies a clean rename;
   flag if an alias is wanted.
3. **stdin `-` support (orthogonal).** clig.dev + wget/yt-dlp/curl/apify-cli all support `-` for stdin; the
   current handler does a plain `readFile` (`cliProgram.ts:450`) and does not. Recommend as a separate
   enhancement — do not block the rename on it.
4. **Short form.** None recommended now. If wanted later, `-i` is free (only `-c`/`-v` are taken) and
   matches wget; `-l` matches ProjectDiscovery but is subordinate authority here.
