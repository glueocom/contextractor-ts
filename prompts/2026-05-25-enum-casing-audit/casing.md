# Enum Value Casing — Audit and Auto-Fix

> **TLDR**: Audits every enum value in the Zod source-of-truth and generated `input_schema.json` against the Apify casing convention (SCREAMING_SNAKE_CASE for runtime/operational modes; lowercase / kebab-case / colon-namespaced for content selection, format identifiers, engine identifiers, and Apify resource identifiers). Auto-fixes any violation found — updates the Zod enum, regenerates the JSON schema, and updates every downstream reference (CLI parser, config translation, tests, READMEs). Trafilatura's API casing is explicitly NOT a consideration — see the note below.

> **Note:** This is a greenfield project — no backward compatibility requirements.

Companion research:
- `prompts/2026-05-19-cli-proxy-config-consolidation/context/enum-casing-research-2026-05.md` — primary report, dual-convention rule derivation
- `prompts/2026-05-19-cli-proxy-config-consolidation/context/enum-casing-unified-research-2026-05.md` — full-unification alternative (rejected)

## Skills and Agents

- `apify-schemas` skill — schema field inspection and gen-input-schema
- `ts-pro` — TypeScript edits to Zod source, CLI parser, config translation, and tests

---

## The Apify casing convention

Apify's first-party actors follow a consistent dual pattern. This is not formally documented in any spec, but it is observable across every first-party actor and is the convention `contextractor` targets.

**SCREAMING_SNAKE_CASE** — actor-internal operational / runtime mode. Examples from `apify/playwright-scraper`, `apify/web-scraper`, `apify/cheerio-scraper`, `apify/puppeteer-scraper`:

- `proxyRotation`: `RECOMMENDED | PER_REQUEST | UNTIL_FAILURE`
- `runMode`: `PRODUCTION | DEVELOPMENT`
- `breakpointLocation`: `NONE | BEFORE_GOTO | BEFORE_PAGE_FUNCTION | AFTER_PAGE_FUNCTION`

**lowercase / kebab-case / colon-namespaced** — content selection, format identifiers, engine identifiers, Apify resource identifiers. Examples:

- `apify/website-content-crawler.crawlerType`: `playwright:adaptive | playwright:firefox | playwright:chrome | cheerio | jsdom`
- `apify/website-content-crawler.htmlTransformer`: `readableText | readableTextIfPossible | extractus | defuddle | none`
- `apify/playwright-scraper.waitUntil`: `load | domcontentloaded | networkidle`
- `apify/playwright-scraper.launcher`: `chromium | firefox`
- `apify/rag-web-browser.outputFormats`: `markdown | text | html`
- `apify/rag-web-browser.scrapingTool`: `raw-http | browser-playwright`
- `apify/instagram-scraper.resultsType`: `posts | comments | details | mentions | reels | stories`

The distinguishing factor: runtime/operational *control* → SCREAMING; content/format/engine/resource *selection* → lowercase.

---

## Note on Trafilatura-originated fields

The fields `mode` (corresponds to Trafilatura's `Extractor.focus`) and `save` (corresponds to Trafilatura's `--format` output) have analogs in the Trafilatura Python library. **Their casing in this schema is decided by the Apify convention and by project-internal consistency with the schema's other content-selection fields — not by Trafilatura's API casing.**

If the Apify pattern or project consistency ever required a casing that differed from Trafilatura's lowercase values, the project's casing would win, and a small translation map at the Python sidecar boundary would be acceptable. As it happens, both `mode` and `save` resolve to lowercase under Apify rules, which incidentally coincides with Trafilatura's lowercase — but the coincidence is not the reason for the choice. Do not cite "matches Trafilatura" as a justification anywhere in this prompt's output; cite the Apify precedent and the project's lowercase majority instead.

---

## Step ANALYZE: Read every file that touches an enum

Read all of these before making any edits:

- `packages/schema/src/source-of-truth/input.ts` — Zod source of truth
- `apps/apify-actor/.actor/input_schema.json` — generated Actor schema
- `apps/apify-actor/src/config.ts` — schema → crawler translation; any remaining `*_MAP` constants
- `apps/apify-actor/src/config.test.ts` — config translation tests
- `apps/standalone/src/cliProgram.ts` — full file; `parse*` helpers; CLI flag definitions
- `apps/standalone/README.md` — user-facing flag docs
- `apps/standalone/SPEC.md` — flag spec
- `packages/crawler/src/createCrawler.ts` — programmatic types

Confirm the Zod source and generated JSON agree on enum values for every field. If they diverge, regenerate the JSON before continuing (`pnpm --filter @contextractor/gen-input-schema start`).

---

## Step AUDIT: Per-field compliance check

For each enum field below, record the current casing in the Zod source and the verdict against the Apify convention. The project's lowercase majority (`crawlerType`, `deduplication`, `mode`, `save`, `saveDestination`, `waitUntil`) is the project-internal reference; `proxyRotation` is the documented SCREAMING exception.

| Field | Apify pattern | Expected casing | Apify precedent | Project-internal alignment |
|---|---|---|---|---|
| `crawlerType` | engine identifier | lowercase + colon | `apify/website-content-crawler.crawlerType` | matches lowercase majority |
| `deduplication` | content-selection mode | lowercase | `apify/instagram-scraper.resultsType` style | matches lowercase majority |
| `mode` | content-quality selection | lowercase | `apify/website-content-crawler.htmlTransformer` style | matches lowercase majority |
| `save` | file-format identifiers | lowercase | `apify/rag-web-browser.outputFormats` | matches lowercase majority |
| `saveDestination` | Apify resource-type identifier | lowercase kebab | Apify REST paths `/v2/key-value-stores/...`, `/v2/datasets/...` | matches lowercase majority |
| `proxyRotation` | runtime/operational mode | SCREAMING_SNAKE | `apify/playwright-scraper.proxyRotation` | documented SCREAMING exception |
| `waitUntil` | engine setting | lowercase | `apify/playwright-scraper.waitUntil` | matches lowercase majority |

For each row, mark ✅ if the current casing matches the expected pattern, ❌ if it does not.

If any *new* enum field exists in the schema but is not listed in the table above, classify it using the convention's distinguishing factor (runtime/operational → SCREAMING; content/format/engine/resource → lowercase) and add it to the audit. Do not consider any upstream library's preferred casing when classifying a new field; classify it purely against the Apify pattern and project-internal lowercase majority.

---

## Step FIX: Auto-apply corrections

For each ❌ violation from the audit, apply the fix using the procedure that matches the field type. Do all edits with the `str_replace` / Edit tool — never use Write on an existing file. Use the `minimal-diff` rule: change only what is needed to flip the casing, leave surrounding code, formatting, and unrelated lines untouched.

### Procedure A — field whose value is consumed only inside this repo

Use this procedure for `proxyRotation`, `deduplication`, `mode`, `save`, `saveDestination`, `crawlerType`. These values flow from CLI / JSON input → Zod parse → internal switch / object construction; they are not forwarded as raw strings to a third-party API.

1. **Update the Zod enum** in `packages/schema/src/source-of-truth/input.ts`. Change values and the `.default(...)` literal.
2. **Update any internal `switch` / equality check** in `apps/apify-actor/src/config.ts`, `apps/standalone/src/cliProgram.ts`, and `packages/crawler/src/createCrawler.ts` that branches on the old literal. The Zod type now narrows to the new literal; TypeScript will error on the stale comparison.
3. **Update tests** in `apps/apify-actor/src/config.test.ts` and any package-level tests that reference the old literal.
4. **Update READMEs and SPEC.md** in `apps/standalone/` and `apps/apify-actor/` where the old literal appears.
5. **Regenerate the JSON schema**: `pnpm --filter @contextractor/gen-input-schema start`. Confirm `apps/apify-actor/.actor/input_schema.json` reflects the new enum values.

### Procedure B — field whose value is forwarded verbatim to a third-party library

Use this procedure for `waitUntil` (forwarded to Playwright `page.goto({waitUntil})`).

1. **Update the Zod enum** in `packages/schema/src/source-of-truth/input.ts`. New values and new `.default(...)` must match the upstream library's accepted strings exactly.
2. **Remove any translation map** (e.g. `WAIT_UNTIL_MAP`) in `apps/apify-actor/src/config.ts`. The schema value now passes through verbatim: `waitUntil: input.waitUntil`.
3. **Simplify any CLI parser** in `apps/standalone/src/cliProgram.ts` (e.g. `parseWaitUntil`) — it no longer needs to transform case, only validate.
4. **Update tests** in `apps/apify-actor/src/config.test.ts`.
5. **Update READMEs and SPEC.md** in `apps/standalone/` and `apps/apify-actor/` where the old literal appears.
6. **Repo-wide grep** for stale literals:

   ```bash
   grep -rnE "NETWORKIDLE|DOMCONTENTLOADED|WAIT_UNTIL_MAP" --include="*.ts" --include="*.md" .
   ```

   Replace every match with the new lowercase literal or remove the reference if obsolete.
7. **Regenerate the JSON schema**: `pnpm --filter @contextractor/gen-input-schema start`.

### Procedure C — field whose value is forwarded to the Trafilatura Python sidecar

Use this procedure for `mode` and `save` *if* they ever require a casing that differs from Trafilatura's lowercase values. Today they do not (both resolve to lowercase under Apify rules, which coincides with Trafilatura), so Procedure A applies. Procedure C is documented here only for future fields where the project's casing wins over Trafilatura's.

1. Follow Procedure A.
2. Add a small translation map at the Python sidecar boundary (e.g. inside `packages/extractor-python-sidecar/` or wherever the subprocess invocation lives) that maps the project's enum value to Trafilatura's expected string. Keep the map next to the subprocess call, not in the schema layer.
3. Cover the map with a unit test in the sidecar package.

### Step coverage of any current ❌

Based on the audit table, the only field expected to be ❌ at the time this prompt runs is `waitUntil` — and only if SCHEMA-REVIEW (`global-schema-cli-review.md`) has not yet executed. If SCHEMA-REVIEW has already run, every field should be ✅ and Step FIX is a no-op. If SCHEMA-REVIEW has not run, apply Procedure B for `waitUntil` here; in that case do not also run SCHEMA-REVIEW's `waitUntil` change (the fix has already happened).

---

## Step VERIFY: Mechanical checks

Run these greps after Step FIX. Every check must pass.

```bash
# 1. SCREAMING enum values in the Zod source — only proxyRotation should match.
grep -nE "z\.enum\(\[\s*'[A-Z_]+'" packages/schema/src/source-of-truth/input.ts
# Expected: exactly one match, on the proxyRotation line.

# 2. Confirm waitUntil is lowercase in the generated schema.
grep -A6 '"waitUntil"' apps/apify-actor/.actor/input_schema.json | grep -i '"enum"'
# Expected: ["load", "domcontentloaded", "networkidle"] (order may vary)

# 3. Confirm proxyRotation remains SCREAMING in the generated schema.
grep -A6 '"proxyRotation"' apps/apify-actor/.actor/input_schema.json | grep -i '"enum"'
# Expected: ["RECOMMENDED", "PER_REQUEST", "UNTIL_FAILURE"]

# 4. Confirm WAIT_UNTIL_MAP is gone from the schema-translation layer. A
#    small translation map at the Python sidecar boundary for Trafilatura is
#    acceptable and not checked here.
grep -rnE "WAIT_UNTIL_MAP" apps/apify-actor/src/ packages/schema/
# Expected: no matches.

# 5. Confirm Zod source and generated JSON agree on enum values per field.
node -e "
const j = require('./apps/apify-actor/.actor/input_schema.json');
for (const [k, v] of Object.entries(j.properties)) {
  if (v.enum) console.log(k, JSON.stringify(v.enum));
  if (v.items && v.items.enum) console.log(k + '[items]', JSON.stringify(v.items.enum));
}
"
# Expected: prints each enum field; values must match the audit table above.
```

If any check fails, return to Step FIX and apply the missing edit. Do not exit Step VERIFY with any ❌.

---

## Step TEST-LOCAL: Build and test

```bash
pnpm build
pnpm fix
pnpm lint
pnpm test
```

Fix any TypeScript errors (most likely: stale enum literals in tests or in switch statements that the compiler now flags). Re-run until clean.

After build, spot-check the CLI:

```bash
CLI="apps/standalone/dist/cli.js"
node "$CLI" extract --wait-until networkidle --help            # confirm accepted
node "$CLI" extract --wait-until NETWORKIDLE https://example.com  # confirm clear error
node "$CLI" extract --proxy-rotation RECOMMENDED --help           # confirm accepted (SCREAMING preserved)
```

---

## Step REPORT: Print the final state

Print one of the following:

**On full compliance (initial audit was ✅ for all fields, or Step FIX brought everything to ✅):**

```
✅ PASS — all enum fields match the Apify casing convention.

Fields audited: crawlerType, deduplication, mode, save, saveDestination, proxyRotation, waitUntil
Fixes applied: <list, or "none" if initial audit was already PASS>
```

**On failure (Step FIX could not bring every field to ✅, e.g. due to test failures or build errors):**

```
❌ FAIL — auto-fix incomplete.

Remaining violations:
  - <field>: current=<current values>, expected=<expected casing>, blocker=<reason>
  - ...
```

In a FAIL state, leave the working tree in whatever partial state the fix reached so the user can inspect.

Leave any commit / branch operations to the caller — this prompt does not commit.
