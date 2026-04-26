# Test step update-docs-and-readmes

## TLDR

Reviews `../implementation/step-update-docs-and-readmes.md`. Verifies every README mentions `rs-trafilatura` and Crawlee, no PyPI references survive outside `prompts/`, and `docs/` matches the source repo (minus `pypi-trusted-publishing.md`).

## Inputs

- `../implementation/step-update-docs-and-readmes.md`.
- `../user-entry-log/entry-initial-prompt.md` (Crawlee + rs-trafilatura wording rule).
- `../migrate-py-to-ts-rust-v2-notes/source-repo-inventory.md` (docs propagation list).

## Verification

- `apps/contextractor-apify/README.md`, `apps/contextractor-standalone/README.md`, `packages/contextractor-engine/README.md`, repo-root `README.md` all exist and each contains the substring `rs-trafilatura` AND `Crawlee` (case-sensitive) in the same paragraph.
- Each README lists supported formats `txt | markdown | json | html` and notes XML/XML-TEI are unsupported.
- Each README declares the local prereqs (Rust toolchain, Apify CLI ≥ 1.4, Node 22+, pnpm 10+).
- `docs/` matches `/r/contextractor/docs/` (minus `pypi-trusted-publishing.md`), with Python-stack references replaced.
- `grep -rni 'pypi\|/help/pypi\|pip install' --include='*.md' --include='*.json' --include='*.toml' . | grep -v '^\./prompts/'` returns nothing.
- `grep -rni 'trafilatura>=' --include='*.md' --include='*.json' . | grep -v '^\./prompts/'` returns nothing.

## Auto-fix examples

- README missing the Crawlee mention — insert the canonical "Built on rs-trafilatura and Crawlee" sentence.
- Stale "pip install contextractor" line — delete.
- Missing prereq list — insert.

## Done when

Every README and doc reflects the new TS+napi-rs stack.
