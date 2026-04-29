# Step RENAME-APPS: Rename apps and schema package

## TLDR

Renames `apps/contextractor-apify` → `apps/apify-actor`, `apps/contextractor-standalone` → `apps/standalone`, and `packages/contextractor-schema` → `packages/schema` (npm package name `@contextractor/schema` unchanged). Updates all cross-references. Notes the manual Apify Console git path update.

**Q&A**: [`../user-entry-log/entry-qa-branch-strategy.md`](../user-entry-log/entry-qa-branch-strategy.md)

**Skills/agents**: `ts-pro`, `apify-actor-development`

---

## Step RENAME-DIRS: Rename directories

```
git mv apps/contextractor-apify apps/apify-actor
git mv apps/contextractor-standalone apps/standalone
git mv packages/contextractor-schema packages/schema
```

## Step UPDATE-REFS: Update all internal references

**`apps/apify-actor/package.json`**: update `name` field if it uses the old directory name

**`apps/standalone/package.json`**: update `name` field if it uses the old directory name

**`packages/schema/package.json`**: directory renamed, but `name` field stays `@contextractor/schema` (unchanged)

**All `package.json` files** in the workspace: grep for `contextractor-apify`, `contextractor-standalone`, `contextractor-schema` and update references. Common places:
- `devDependencies`, `dependencies` referencing other workspace packages
- `workspace:*` references
- `turbo.json` pipeline keys if named by package

**`.actor/actor.json`** in `apps/apify-actor/`: verify no paths reference old directory name

**`CLAUDE.md`** project structure section: update to show new directory names

## Step MANUAL-APIFY-CONSOLE: Apify Console git path

**MANUAL STEP** (cannot be done in code): after merging this branch, update the Apify Console git-connected build configuration to point to `apps/apify-actor` instead of `apps/contextractor-apify`. Document this in the PR description.

## Step VERIFY: Build, lint, test

Run `pnpm build`. Run `pnpm test`. Run `pnpm lint`. Fix any broken imports. All must pass.

Commit message: `refactor: rename apps to apify-actor/standalone; rename schema package dir`
