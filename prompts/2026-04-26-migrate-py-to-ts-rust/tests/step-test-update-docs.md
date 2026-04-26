# Test — update-docs

## TLDR

Review the diff from `implementation/step-update-docs.md`. Verify docs are propagated, app/package READMEs reflect the TS reality, and there are zero PyPI/`pip install`/help-pypi-link references outside `prompts/`. Auto-fix any deviation.

## Inputs

- `../implementation/step-update-docs.md`
- `../user-entry-log/entry-qa-xml-formats.md`
- `/r/contextractor/docs/`

## Review

- `docs/spec/`, `docs/troubleshooting/`, `docs/unit-test-cases/`, `docs/notes/` are present and reflect source content with PyPI/npm scrubbed and Python code blocks replaced with TS/CLI equivalents where they exemplify usage.
- `docs/pypi-trusted-publishing.md` was **not** propagated.
- `apps/contextractor-apify/README.md`, `apps/contextractor-standalone/README.md`, `packages/contextractor-engine/README.md` exist and document the TS reality.
- Root `README.md` exists; no PyPI/npm sections.
- Format tables list only `txt`, `markdown`, `json`, `html`. xml/xmltei mentioned at most once as a known gap.

## Verify

- `grep -rni 'pypi\\|/help/pypi\\|pip install' --include='*.md' --include='*.json' --include='*.toml' . | grep -v '^./prompts/' | grep -v node_modules` returns nothing.
- `find docs -name 'pypi-trusted-publishing.md'` returns nothing.

## Auto-fix

For any straggler PyPI reference outside `prompts/`, remove it with the minimal edit. Rerun the grep.
