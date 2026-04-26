# Step RENAME_APP: Rename `apps/contextractor` → `apps/contextractor-apify`

## TLDR

Rename the existing actor directory and update every reference in code, docs, schemas, and `.claude/` so the repo stays internally consistent.

## Skills and agents

- `rust`, `apify-actor-development`, `apify-schemas` — references that must move.
- `general-purpose` agent — codebase grep.

## Step MOVE: Move directory

Run `git mv apps/contextractor apps/contextractor-apify` from repo root. Verify history is preserved with `git log --follow apps/contextractor-apify/`.

## Step UPDATE_REFS: Update every reference

Find every match for the old path:

```bash
grep -rln "apps/contextractor[^-]" \
  --include="*.md" --include="*.json" --include="*.toml" \
  --include="*.rs" --include="*.ts" --include="*.js" \
  --include="Dockerfile" --include="*.yaml" --include="*.yml" \
  /Users/miroslavsekera/r/contextractor-ts/
```

Update each hit to `apps/contextractor-apify` **except** matches inside `prompts/` (that directory is historical and is left untouched). Known sites:

- `CLAUDE.md` — Project Structure block, Commands block, Production Protection, MCP Servers, Resources.
- `.claude/commands/sync/docs.md` and `.claude/commands/sync/gui.md` — every Source-of-Truth path.
- `.claude/commands/platform/push-and-get-working.md` (verify in file).
- `.claude/commands/local-tests/prompt.md` and `.claude/commands/platform-tests/*.md` (verify).
- `.claude/skills/apify-actor-development/SKILL.md` (if it cites a path).
- Root `README.md`.
- Root `Dockerfile` (`COPY` paths).
- Workspace `Cargo.toml` once the Rust scaffolding lands (added in `step-engine-port.md`).

## Step VERIFY: Verify

- `git status` shows only the rename and the reference updates.
- `grep -rn "apps/contextractor[^-]" --include="*.md" --include="*.json" --include="*.toml" --include="Dockerfile" /Users/miroslavsekera/r/contextractor-ts/ | grep -v '^prompts/'` returns zero matches.
- The `.actor/actor.json` `name` field stays `contextractor` (the *Apify Actor* name; the *directory* changed, not the published Actor name).
