# Step EDIT_ZOD_PROMPT: Trim unnecessary Python mentions from `update-markdown-prompt.md`

## TLDR

Two surgical Edit-tool changes to `prompts/2026-04-27-zod-schema-unification/update-markdown-prompt.md`. Drop the deleted `pypi/pypi.md` from the manual-prose-pass list and condense the verbose "defunct Python repo" file-by-file mapping table down to one paragraph. No other prompts under `prompts/` are touched.

## Skills

- `ts-pro` not required — pure markdown surgery via the Edit tool

## Apply edits

Use the Edit tool. Read the file first if not already in conversation context.

### Edit 1 — drop `pypi/pypi.md`

`prompts/2026-04-27-zod-schema-unification/update-markdown-prompt.md` line 60.

- `old_string`: `- \`apps/contextractor-site/content/automatic/help/help.md\`, \`apify/apify.md\`, \`npm/npm.md\`, \`docker/docker.md\`, \`pypi/pypi.md\`, \`web/web.md\``
- `new_string`: `- \`apps/contextractor-site/content/automatic/help/help.md\`, \`apify/apify.md\`, \`npm/npm.md\`, \`docker/docker.md\`, \`web/web.md\``

### Edit 2 — condense the Python-path mapping table

Replace the entire bullet block that begins `- \`.claude/commands/projects/contextractor/sync-docs.md\` and \`.claude/commands/projects/contextractor/sync-gui.md\` — both currently reference the **defunct Python repo**…` and ends with `…flag for a separate follow-up rather than fixing here.`

Use the exact replacement spelled out in `../purge-python-notes/update-markdown-prompt-edits.md` (Edit 2). Preserve the surrounding markdown bullet indentation and the empty line that follows the block.

The replacement keeps one short paragraph mapping legacy paths to TS canonical sources, plus the `sync-gui.md`-specific guidance about defaults moving from `TrafilaturaConfig.balanced()` to Zod `.default(...)`. The wheel-contingency clause is dropped because the wheel is being deleted in `step-purge-tools-python-source`.

## Verify

- `git diff -- prompts/2026-04-27-zod-schema-unification/update-markdown-prompt.md` shows exactly two hunks: one on the file list, one replacing the mapping bullet block
- No other files under `prompts/` show in the diff
- The phrase "ports Python `trafilatura`" or any other lineage statement elsewhere in the prompt remains untouched
