# Test USER_INTENT — final cross-check against `entry-initial-prompt.md`

## TLDR

Read the user's six-line raw prompt verbatim and verify each line maps to a concrete change in the implementation. Autofix any gap or contradiction.

## Inputs

- `../user-entry-log/entry-initial-prompt.md` — the user's verbatim words (six lines)
- All implementation step diffs (in both repos)
- All five Q&A answers captured in the AskUserQuestion exchange (Tools scope, PyPi page, skill-creator, historical refs)

## Map every requirement to a covering step

| User line | Covered by |
|---|---|
| "this repo must no longer use python. remove any python code if exists - replace" | `step-purge-contextractor-ts-python` (the only `.py` files in this repo were skill-creator scripts; no replace per Q3) |
| "remove any mython emntions from docs" (typo: Python) | Skipped for lineage/parity references per user clarification; only "current Python use" framing was removed (covered by no specific step in this repo because every Python mention in this repo is lineage, except `skill-creator/SKILL.md` which is covered by step-purge-contextractor-ts-python). Verify by re-reading the inventory note |
| "remove unecessary python mentions from \[update-markdown-prompt.md\]" | `step-edit-zod-prompt` |
| "avoid modyfing other files in the \[contextractor-ts/prompts\] except \[update-markdown-prompt.md\]" | Verify `git status` shows no other prompt-file changes |
| "no PyPi package" | `step-purge-tools-python-source` (deletes the wheel residue) + `step-delete-pypi-page` (deletes the help page) |
| "update related docs in /Users/miroslavsekera/r/tools" | `step-update-tools-docs` + `step-deprovision-contextractor-api` (Dockerfile/supervisord are infrastructure docs in spirit) + `step-delete-pypi-page` |

## Cross-check the four Q&A answers

- Q1 answer "Docs + delete dead Python code": verify both kinds of Python source in tools were deleted (api `python/`, distributed wheel residue) and no TS replacement stub was added
- Q2 answer "Delete the page entirely": verify `apps/contextractor-site/content/automatic/help/pypi/` does not exist and a 301 redirect is in place
- Q3 answer "Keep skill, drop only Python scripts": verify `.claude/skills/skill-creator/SKILL.md` survives in both repos and no longer references the deleted `.py` files
- Q4 answer "keep all the notes that ts-trafilatura is ported from Python package": run `grep -rnE 'mirrors the Python|Python source supported|ports Python|Python port|Rust port of Python' /Users/miroslavsekera/r/contextractor-ts/{README.md,CLAUDE.md,docs/,packages/,apps/,.claude/agents/}` and confirm at least the original count of lineage statements remains (compare against inventory note)

## Cross-check the explicit "do not" list from `../implementation/master.md`

- No edits to any prompt file other than `update-markdown-prompt.md`
- No edits to `tools/.claude/commands/projects/contextractor/sync-{docs,gui}.md`
- No edits to `apify-actor-development` / `apify-actorization` / `apify-ops` skill content
- The `'python'` editor-enum string in `packages/contextractor-schema/src/apify-meta.ts` is unchanged
- No edits to `apps/pythonescaper-redir/`
- No `dist/`, `dist-content/`, or `.next/` files were hand-edited

## Final smoke

- `pnpm -r build && pnpm -r test && pnpm -r lint` succeed in both repos
- `cargo clippy --workspace --all-targets -- -D warnings` succeeds in `contextractor-ts`
- `pnpm -F contextractor-site build` succeeds in tools

## Autofix

- For any uncovered user requirement, run the relevant implementation step's instructions until the requirement is met
- For any contradiction (e.g., a lineage reference accidentally stripped), restore the exact original text via `git checkout` and re-apply the intended narrower change
- For any prohibited file that was edited, `git checkout` it back

## Done when

Every row in the requirement table is covered, every Q&A answer is reflected in the diff, the do-not list is satisfied, and all builds/tests/lints pass in both repos.
