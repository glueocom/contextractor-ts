# Test UPDATE_TOOLS_DOCS

## TLDR

Verify `tools/CLAUDE.md` and `tools/docs/contextractor.md` no longer frame contextractor as a Python service while preserving port-lineage facts. Autofix any deviation. Confirm `tools/.claude/commands/projects/contextractor/sync-{docs,gui}.md` were **not** edited.

## Inputs

- `../implementation/step-update-tools-docs.md`
- `../purge-python-notes/tools-repo-python-inventory.md`

## Checks

- `grep -inE 'python extraction engine|wrapping python|when working on python' /Users/miroslavsekera/r/tools/CLAUDE.md /Users/miroslavsekera/r/tools/docs/contextractor.md` returns zero results
- `git diff --name-only` does **not** include `tools/.claude/commands/projects/contextractor/sync-docs.md` or `tools/.claude/commands/projects/contextractor/sync-gui.md`
- `git diff --name-only` does **not** include any file under `apps/contextractor-site/content/automatic/{trafilatura,markdown,trafilatura-vs-*}/`
- `tools/CLAUDE.md` no longer has a "When working on Python code" section
- `tools/docs/contextractor.md` line near 64 describes `apps/contextractor-api/` without the words "Python extraction engine"
- Lineage statements still present somewhere in tools docs:
  - `grep -rnE 'rs-trafilatura.*Rust port|ports Python|Rust port of Python' /Users/miroslavsekera/r/tools/docs/ /Users/miroslavsekera/r/tools/CLAUDE.md` returns at least one match (or, if originally absent, the absence is not a regression)
- `pnpm -F contextractor-site build` succeeds (link checks would catch any broken cross-doc links)

## Autofix

- If a "Python extraction engine" or similar phrase survived, Edit-tool the file to use TS-only framing
- If the sync command files were edited, `git checkout` them (they belong to `prompts/2026-04-27-zod-schema-unification/`)
- If a public-facing article was edited, `git checkout` it
- If a port-lineage statement was inadvertently removed during this step, restore it from the original file

## Done when

All checks pass; `git diff` for tools repo is limited to `CLAUDE.md` and `docs/contextractor.md` (plus the diffs from earlier steps).
