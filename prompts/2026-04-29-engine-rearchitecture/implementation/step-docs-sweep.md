# Step DOCS-SWEEP: Update all documentation

## TLDR

Sweeps every README, `.actor/` spec, `INPUT_SCHEMA.json` description strings, and `CLAUDE.md` project structure to reflect the new package names, directory layout, and API surface. Removes all references to deleted symbols.

**Skills/agents**: `ts-pro`

---

## Step SWEEP-READMES: Update README files

Find all `README.md` files in `apps/`, `packages/`, and root. For each:
- Replace old package names: `@contextractor/engine` → `@contextractor/extraction`, `@contextractor/crawler` (new)
- Replace old directory paths: `apps/contextractor-apify` → `apps/apify-actor`, `apps/contextractor-standalone` → `apps/standalone`, `packages/contextractor-engine` → `packages/extraction`, `packages/contextractor-schema` → `packages/schema`
- Remove references to `COOKIE_DISMISS_SCRIPT`, `idcac-playwright`, `closeCookieModals()`, manual scroll loop
- Add brief mention of `@ghostery/adblocker-playwright` as cookie-dismissal mechanism

## Step SWEEP-ACTOR-SPEC: Update `.actor/` files

In `apps/apify-actor/.actor/`:
- `actor.json`: verify no stale directory paths
- `INPUT_SCHEMA.json` (if generated): regenerate via `pnpm --filter @contextractor/schema generate-input-schema` or equivalent command; verify description strings for `closeCookieModals` field mention Ghostery-based dismissal, not the old script
- `output_schema.json`, `dataset_schema.json`: verify no stale symbol references

## Step SWEEP-CLAUDE-MD: Update CLAUDE.md

In root `CLAUDE.md`, update:
- Project structure section: match the new directory tree (`apps/apify-actor`, `apps/standalone`, `packages/extraction`, `packages/crawler`, `packages/schema`)
- Package names in any reference lists
- Remove any references to `@contextractor/engine` or old paths

## Step SWEEP-PACKAGES: Update package-level docs

Check `packages/extraction/`, `packages/crawler/`, `packages/schema/` for any `README.md` or inline JSDoc. Update package names and API surface descriptions.

## Step VERIFY: Grep for stale refs

Run these greps to confirm no stale references remain (adjust as needed):
- `grep -r "contextractor-apify\|contextractor-standalone\|contextractor-engine\|contextractor-schema" --include="*.md" .`
- `grep -r "COOKIE_DISMISS_SCRIPT\|idcac-playwright\|closeCookieModals" --include="*.md" --include="*.json" .`
- `grep -r "@contextractor/engine[^-]" --include="*.md" --include="*.json" .`

Fix any remaining hits.

Commit message: `docs: sweep READMEs, .actor/ specs, and CLAUDE.md for rearchitecture`
