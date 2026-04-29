# Engine Rearchitecture — Review Master

## TLDR

Reviews all code changes from the engine rearchitecture against the implementation steps and original user intent. All review steps automatically fix issues they find. No tests executed here.

## Agents and Skills

- `code-reviewer` — primary reviewer for Rust and TypeScript correctness, hygiene, security
- `ts-pro` — TypeScript autofix
- `rust-pro` — Rust autofix

## Steps (execute in order)

- [`step-review-create-extraction.md`](./step-review-create-extraction.md) — Review package rename, native binding rename, moved pure functions
- [`step-review-create-crawler.md`](./step-review-create-crawler.md) — Review crawler package creation, Ghostery integration, entry-point shrink
- [`step-review-rename-apps.md`](./step-review-rename-apps.md) — Review app and schema directory renames, cross-reference updates
- [`step-review-autoconsent.md`](./step-review-autoconsent.md) — Review autoconsent lazy-load implementation
- [`step-review-docs-sweep.md`](./step-review-docs-sweep.md) — Review documentation accuracy and completeness
- [`step-review-user-intent.md`](./step-review-user-intent.md) — Review complete implementation against original user intent and Q&A decisions
