- there is newer functionality and schemas in `/Users/miroslavsekera/r/contextractor/`, we need to propagate into this repo `/Users/miroslavsekera/r/contextractor-ts/` we will use different stack, instead of Python, there will be used Typescript for all the app logic, and we will switch from Python Trafilatura to Trafilatura's port in Rust (`https://github.com/Murrough-Foley/rs-trafilatura` `https://crates.io/crates/rs-trafilatura`)
- these schemas and config `/Users/miroslavsekera/r/contextractor/apps/contextractor-apify/.actor` must be propagated to `/Users/miroslavsekera/r/contextractor-ts/apps/contextractor/.actor`
- propagate `/Users/miroslavsekera/r/contextractor/packages/contextractor_engine` to `/Users/miroslavsekera/r/contextractor-ts/packages/contextractor-engine` (renamed to `contextractor-engine` per TypeScript naming conventions) and let it use the `rs-trafilatura` instead of the Python one. The `contextractor-engine` package itself must be TypeScript — only `rs-trafilatura` is the Rust part

- rename `/Users/miroslavsekera/r/contextractor-ts/apps/contextractor` to `/Users/miroslavsekera/r/contextractor-ts/apps/contextractor-apify`, propagate new functionality from `/Users/miroslavsekera/r/contextractor/apps/contextractor-apify` to the newly renamed `/Users/miroslavsekera/r/contextractor-ts/apps/contextractor-apify`
- propagate `/Users/miroslavsekera/r/contextractor/apps/contextractor-standalone` to `/Users/miroslavsekera/r/contextractor-ts/apps/contextractor-standalone`

- propagate all markdown files, docs (but note the Python Trafilatura is newly used in Rust form, so no Python in this target repo)
- propagate `/Users/miroslavsekera/r/contextractor/tools` to `/Users/miroslavsekera/r/contextractor-ts/tools`

- there won't be the python library deployed to PyPI anymore (`https://pypi.org/project/contextractor/`). Remove all the PyPI lib mentions in the docs from all docs in `/Users/miroslavsekera/r/contextractor-ts/`

- do all the tests, local and Apify (`glueo/contextractor-test`), but in scope in this prompt, do not deploy anything except to the Apify test actor (`glueo/contextractor-test`)

- run `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/sync/docs.md` and `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/sync/gui.md`

- this prompt output will include creation of another prompt in `/Users/miroslavsekera/r/tools/prompts` that will propagate all the changes to `/Users/miroslavsekera/r/tools/apps/contextractor-site` `/Users/miroslavsekera/r/tools/apps/contextractor-api` `/Users/miroslavsekera/r/tools/distributed-packages/contextractor-engine` `/Users/miroslavsekera/r/tools/.claude/commands/projects/contextractor`, run `/Users/miroslavsekera/r/tools/.claude/commands/projects/contextractor/sync-all.md`. Do not delete (`https://www.contextractor.com/help/pypi/` only modify it and tell the PyPI package is no longer supported. Remove links to `https://www.contextractor.com/help/pypi/` from any docs and .md files)
