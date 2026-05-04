# Sync Docs Report

**Run date:** 2026-05-03

## READMEs scanned

- `README.md` (repo root)
- `apps/apify-actor/README.md`
- `apps/standalone/README.md`
- `packages/extraction/README.md`
- `packages/schema/README.md`
- `packages/crawler/README.md`
- `tools/gen-input-schema/README.md`

## Markdown regions regenerated

`pnpm docs:update` reported **0 file(s) updated** — all generated regions were already in sync with the source. No regions were rewritten.

Regions verified current:
- `input-type` in `README.md` and `packages/schema/README.md`
- `apify-input-schema` in `apps/apify-actor/README.md`
- `cli-flags` in `apps/standalone/README.md`
- `enum-values` in `apps/standalone/README.md` and `packages/schema/README.md`

## README prose edits

None required.

## Docs version

Timestamp unchanged — no markdown regions were regenerated and no README prose was edited.

## Inconsistencies found and fixed

None.

## Cross-check results

| Check | Result |
|-------|--------|
| All READMEs say "built on rs-trafilatura and Crawlee" | ✅ All 7 READMEs + actor.json |
| Output format set is exactly `txt \| markdown \| json \| html` | ✅ Consistent across all surfaces |
| No `xml`/`xmltei` in public docs | ✅ Only gap note in `packages/extraction/README.md` |
| napi-rs `TrafilaturaConfig` matches TS interface | ✅ All 15 fields match (snake_case → camelCase) |
| CLI flags table matches `cliProgram.ts` | ✅ All 44 flags accounted for |
| Apify input schema table matches Zod schema (35 fields) | ✅ All fields present |
| `TrafilaturaConfig` table in extraction README matches TS | ✅ All 15 fields with correct types and defaults |
| JSON config only in docs | ✅ No YAML references |
| Local prerequisites in applicable READMEs | ✅ Present where needed |

## Issues requiring human review

None.
