# Surgical edits to `prompts/2026-04-27-zod-schema-unification/update-markdown-prompt.md`

User instruction: *"remove unnecessary python mentions"*. The prompt itself is in scope; **all other files under `/Users/miroslavsekera/r/contextractor-ts/prompts/` are out of scope.**

## Edit 1 — drop the PyPi page from the manual prose pass list

`update-markdown-prompt.md` line 60:

```markdown
- `apps/contextractor-site/content/automatic/help/help.md`, `apify/apify.md`, `npm/npm.md`, `docker/docker.md`, `pypi/pypi.md`, `web/web.md`
```

`pypi/pypi.md` is being deleted by this purge-python prompt. Drop it from the list:

```markdown
- `apps/contextractor-site/content/automatic/help/help.md`, `apify/apify.md`, `npm/npm.md`, `docker/docker.md`, `web/web.md`
```

## Edit 2 — condense the "defunct Python repo" mapping table

`update-markdown-prompt.md` lines 87-93 currently spell out a five-row file-by-file mapping from the legacy Python repo (`apps/contextractor-standalone/src/contextractor_cli/main.py` → `cli.ts`, etc.) plus a contingent paragraph about whether `import:contextractor-engine` still pulls a Python wheel.

The mapping rows are pre-migration archaeology that no longer earns its place — by the time these sync commands run after the zod work, the legacy Python repo is fully deleted. Replace the bullet block with a single instruction that names the canonical TS sources without the per-file mapping table. Keep the `sync-gui.md`-specific guidance about defaults (`TrafilaturaConfig.balanced()` → Zod `.default(...)`) because that still describes a real change to the GUI sync workflow. Drop the wheel contingency — the wheel no longer exists.

Suggested replacement (preserve surrounding markdown):

```markdown
- `.claude/commands/projects/contextractor/sync-docs.md` and `.claude/commands/projects/contextractor/sync-gui.md` — both still reference legacy paths from the retired Python repo. Repoint every source path to its TypeScript replacement under `/Users/miroslavsekera/r/contextractor-ts/`; the canonical *field* source is `packages/contextractor-schema/src/input.ts`, the Commander program is `apps/contextractor-standalone/src/cli.ts`, and `apps/contextractor-apify/.actor/input_schema.json` is now a generated artifact — flag any "edit input schema" step in the command as obsolete.
- In `sync-gui.md` specifically, defaults no longer come from a `TrafilaturaConfig.balanced()` factory — they come from the Zod schema's `.default(...)` calls; update the EXTRACT inventory step accordingly. The `pnpm run import:contextractor-engine` step stays.
```

## Out of scope — line 87 still names "the Python repo"

The phrase "legacy paths from the retired Python repo" stays. It is the minimum context needed to explain why these commands' source-of-truth list is being repointed at all. Calling the Python repo "retired" (a one-word tag) is shorter than the original "**defunct Python repo** at `/Users/miroslavsekera/r/contextractor/`" and removes the dangling absolute path.
