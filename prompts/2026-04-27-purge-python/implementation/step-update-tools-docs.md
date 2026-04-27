# Step UPDATE_TOOLS_DOCS: Tools-repo doc cleanup

## TLDR

Update `tools/CLAUDE.md` and `tools/docs/contextractor.md` (plus a stray reference in `tools/docs/notes/`) to drop "Python extraction engine" framing while preserving port-lineage facts. Do **not** edit `tools/.claude/commands/projects/contextractor/sync-{docs,gui}.md` — those belong to the zod-schema-unification prompt.

## Skills

- `ts-pro` not required — pure Edit-tool surgery on markdown

## Files to update

### `tools/CLAUDE.md`

- Line 7 mentions `apps/contextractor-api` and `apps/contextractor-site` in a comma-separated list. The list itself stays; only drop the `Python` qualifier if any
- Line 40 begins a section titled "When working on Python code" that points at `apps/contextractor-api/python/` and `distributed-packages/contextractor-engine/`. Both targets are gone after the previous steps. Delete the entire section, including its bullet list

### `tools/docs/contextractor.md`

- Line 64: `- \`apps/contextractor-api/\` — API service wrapping Python extraction engine (this monorepo)` — rewrite to drop "Python" wording. After deprovision, the API's purpose is open (see the follow-up note). Conservative replacement: `- \`apps/contextractor-api/\` — Next.js API service (this monorepo); see \`apps/contextractor-api/README.md\` for current scope.`

If the doc has a longer "How extraction works" section that describes the Python pipeline, rewrite the technical description to point at `@contextractor/engine` (npm) and `rs-trafilatura` (the Rust engine) instead. Keep one sentence noting that `rs-trafilatura` is a Rust port of Python `trafilatura` — that is a port-lineage fact and stays.

### `tools/docs/notes/contextractor-download-extension-fix.md`

Line 39 mentions `.py` → `text/x-python` as one of several MIME mappings in a download-extension fix story. This is a generic MIME mapping, not contextractor Python. Leave alone.

### `tools/.cspell.json`

If "python", "pypi", or related terms are listed in the project dictionary, leave them — the words still appear in port-lineage statements and third-party library descriptions. Only remove a dictionary entry if the corresponding word is truly absent from the post-cleanup repo.

## Lineage stays

Every public-facing article under `apps/contextractor-site/content/automatic/` that describes third-party Python libraries (`trafilatura.md`, `markdown.md`, `trafilatura-vs-readability-vs-newspaper.md`, `trafilatura-vs-jina-readerlm.md`) is **out of scope**. Do not edit them.

## Verify

- `grep -inE 'python extraction engine|wrapping python|when working on python' /Users/miroslavsekera/r/tools/CLAUDE.md /Users/miroslavsekera/r/tools/docs/contextractor.md` returns no results
- `git -C /Users/miroslavsekera/r/tools diff -- CLAUDE.md docs/` shows only the listed edits
- Lineage statements about `rs-trafilatura` being a Rust port of Python `trafilatura` remain present where they were
- `pnpm -F contextractor-site build` succeeds in tools repo
