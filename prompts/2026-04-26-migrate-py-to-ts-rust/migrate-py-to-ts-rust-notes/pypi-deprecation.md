# PyPI deprecation — what to remove vs. keep

## In `/Users/miroslavsekera/r/contextractor-ts/`

Greenfield: no PyPI mention currently exists in `docs/`, `apps/`, `packages/`, `README.md`, or `CLAUDE.md` (audited 2026-04-26 with `grep -rli pypi`). The migration replaces Python source with Rust+TS source; no follow-up cleanup needed in this repo for PyPI strings.

PyPI mentions only exist in `prompts/` (raw prompt and prior planning docs), which is out of scope.

## In `/Users/miroslavsekera/r/tools/` (sibling prompt scope)

Audit findings (2026-04-26):

- `apps/contextractor-site/content/automatic/help/pypi/pypi.md` — **modify**, do not delete. Mark the PyPI package as no longer supported. Keep the page so existing inbound links don't 404.
- `apps/contextractor-site/content/automatic/help/help.md` — links to PyPI help page. Remove the link.
- `apps/contextractor-site/content/automatic/help/help-blurb.md` — same.
- `apps/contextractor-site/content/automatic/help/web/web.md` — same.
- `apps/contextractor-site/content/automatic/help/npm/npm.md` — same.
- `apps/contextractor-site/content/automatic/trafilatura/trafilatura.md` — same.
- `apps/contextractor-site/content/automatic/trafilatura-vs-readability-vs-newspaper/trafilatura-vs-readability-vs-newspaper.md` — same.
- `apps/contextractor-site/content/automatic/trafilatura-vs-jina-readerlm/trafilatura-vs-jina-readerlm.md` — same.

## Source-of-truth removal

- `apps/contextractor-apify/.actor/actor.json` description field in source repo says "Also available as PyPI ... and npm packages." — drop the PyPI clause when propagating to target.
- Distributed wheel `distributed-packages/contextractor-engine/contextractor_engine-0.3.12-py3-none-any.whl` — sibling prompt decides whether to keep the artefact, delete it, or replace it with a Rust crate / TS package re-export.
