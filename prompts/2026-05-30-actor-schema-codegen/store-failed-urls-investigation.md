# Investigation: should there be a `storeFailedUrls` toggle (symmetry with `storeSkippedUrls`)?

> **Question (2026-05-31):** the Actor input has `storeSkippedUrls` but no equivalent switch for storing URLs that errored. Should there be one? (Investigation only — no code changed.)

## TL;DR

There is a **deliberate, documented asymmetry**: **skipped** records are opt-in (`storeSkippedUrls`, default `false`), **failed** records are pushed **unconditionally**. It is intentional, not a bug — failed records are diagnostically essential, bounded in volume, and (in the CLI) drive exit code 2; skipped records are non-errors and can be enormous in volume, so they are opt-in. This matches the Apify/WCC ecosystem norm (failed/error records are normally always included).

A `storeFailedUrls` toggle (default **`true`**) would be a reasonable, low-risk enhancement **only if** users want a clean success-only dataset. It is feasible without breaking the CLI's exit-code-2, because that uses a separate in-memory array, not the dataset push.

## Current behaviour — the asymmetry (with evidence)

- **Skipped → gated** by `storeSkippedUrls` (default `false`):
  - Input field: `packages/schema/src/source-of-truth/input.ts:322` (`storeSkippedUrls: z.boolean().default(false)`); generated `apps/apify-actor/.actor/input_schema.json:256`.
  - Wiring: `apps/apify-actor/src/run.ts:72` and `apps/standalone/src/cliProgram.ts:621` wrap the `onSkippedUrl` callback in `...(storeSkippedUrls ? { onSkippedUrl: … } : {})`.
  - `skipReason` enum (non-errors): `robotsTxt | limit | enqueueLimit | filters | redirect | depth`.
- **Failed → always pushed** (no toggle):
  - `apps/apify-actor/src/run.ts:69-70` — `onFailedRequest: async (info) => { await dataset.pushData(buildFailedRecord(info)); }` (unconditional).
  - `apps/standalone/src/cliProgram.ts:611-619` — `onFailedRequest` pushes `buildFailedRecord(info)` unconditionally.

## CLI exit-code-2 is independent of the failed dataset push

In the standalone CLI, `onFailedRequest` does **two separate things** (`cliProgram.ts:611-619`):
1. `failedRecords.push({…})` — an **in-memory** array (`cliProgram.ts:557`) used **only** for `if (failedRecords.length > 0) process.exit(2)` (`cliProgram.ts:633`).
2. `ds.pushData(buildFailedRecord(info))` — the **dataset** record.

So a `storeFailedUrls` toggle would gate **only (2)**; (1) stays, and `exit 2` is preserved. (The Apify Actor has no exit-code concept; its `onFailedRequest` only does the dataset push, so the whole callback can be gated there.)

## History (recent weeks)

- `storeSkippedUrls` + the failed/skipped record feature were introduced **together** in **`f276f74`** ("feat: implement all 9 CC improvements — crawler type, **failed/skipped URLs**, …"). In that commit the asymmetry already exists: `onFailedRequest` pushes unconditionally; `onSkippedUrl` is wrapped in `...(input.storeSkippedUrls ? … : {})`.
- The dataset-design spec **`prompts/2026-05-16-cli-help-reference/1-cli-unified-dataset.md`** states it explicitly:
  - "**Failed record** (new — **always pushed**, regardless of `--save-destination`)"
  - "**Skipped record** (new — pushed **only when** `storeSkippedUrls: true`)"
  - and keeps `failedRecords.push(…)` with the comment "**keep — used by exit code 2 check**".
- The original skipped-feature brief `prompts/2026-05-12-cc-improvements/store-skipped-urls.md` (deleted in `a0306c0`, superseded by the unified-dataset approach; first wrote a `SKIPPED_URLS` KVS record). The crawler-callback implementation lived in `prompts/2026-05-12-cc-improvements/failed-and-skipped-urls.md`.
- `git log -S "storeFailedUrls" --all` → **no results**: a failed-URL toggle has **never** existed or been proposed.

## Why the asymmetry is defensible

| | **skipped** | **failed** |
|---|---|---|
| Meaning | URLs intentionally **not fetched** (filtered: globs, robots.txt, depth, max-results/enqueue limits, redirect) | URLs **fetched and errored** after all retries (network/proxy/server) |
| Volume | Potentially **huge** (every excluded link on every page) | **Bounded** (only URLs actually attempted) |
| Error? | No — the crawler doing its job | Yes — diagnostically important (`errors` + `crawledTime`) |
| Default | **opt-in** (`storeSkippedUrls=false`, "auditing only") | **always on** (also drives CLI exit 2) |

Ecosystem: apify/website-content-crawler and most Apify scrapers **always include** failed/error records (e.g. `#error` / error-message markers). The opt-in skip toggle is the less common one; failed-always-on is the norm — so the current design is ecosystem-aligned.

## If a toggle is wanted anyway — scope

Add `storeFailedUrls: boolean` with **default `true`** (preserves today's behaviour; existing users see no change). Blast radius mirrors `storeSkippedUrls`:
- `packages/schema/src/source-of-truth/input.ts` — new field (Output-storage section, default `true`).
- Regenerate the four `.actor/*.json` (full `pnpm build`) + the `@generated` README input table.
- `apps/apify-actor/src/run.ts` — wrap `onFailedRequest` in `...(input.storeFailedUrls ? { onFailedRequest: … } : {})`.
- `apps/standalone/src/cliProgram.ts` — **keep** `failedRecords.push(…)` (exit code), gate **only** `ds.pushData(buildFailedRecord(info))`. Add a `--store-failed-urls`/`--no-store-failed-urls` flag + config wiring (`config.ts`, `buildSchemaOverrides`).
- Tests + SPEC/README. Default `true` ⇒ no test-behaviour change unless a suppression test is added.

Naming: `storeFailedUrls` is the symmetric, discoverable choice next to `storeSkippedUrls`.

## Recommendation

Not a bug — the always-on failed record is intentional, documented, and ecosystem-aligned. **Add `storeFailedUrls` (default `true`) only if** there's a concrete user need to suppress failed records (e.g. a "successful extractions only" dataset). It is low-risk and exit-code-safe. Otherwise leave as-is.
