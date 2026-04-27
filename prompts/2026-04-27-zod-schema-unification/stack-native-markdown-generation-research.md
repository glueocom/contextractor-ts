# Stack-native markdown generation research

Companion research to `markdown-region-templating-research.md`. The earlier note answered "what tool fills marked regions in markdown" (answer: `markdown-magic`). This note answers a follow-up: **does anything in the stack already chosen for the Zod 4 + Commander 12 unification ship the equivalent natively, so a third-party tool wouldn't be needed at all?**

## Why this question matters here

The Zod-schema-unification work in `prompt.md` collapses three drifting input definitions into one Zod 4 schema. Once that lands, the same schema becomes the obvious source of truth for:

- the regenerated `apps/contextractor-apify/.actor/input_schema.json` (already in scope of `prompt.md`)
- a CLI flag table inside the standalone `README.md`
- an INPUT_SCHEMA field table inside the Apify `README.md`
- a future MCP tool listing once `@modelcontextprotocol/sdk` registration is wired (Phase 3)

If a library already in the stack ships a markdown emitter, dropping it in is cheaper than introducing `markdown-magic`. If nothing does, the question is whether a ~60-line custom emitter beats the third-party tool — and which marker convention to adopt for cross-tool consistency.

## Findings

**Nothing in the stack ships a markdown-region templater.** Zod 4, Commander 12, Crawlee, the MCP TypeScript SDK, and the Apify CLI all stop short of emitting README content from a source of truth. The single first-party precedent in the broader ecosystem is **oclif's `readme` command** — and although the Apify CLI is oclif-based, Apify itself does not run it for Actor docs, and Commander is not oclif. So the practical answer is: **borrow oclif's marker convention, write ~30–60 lines of generator, and skip `markdown-magic` entirely.**

### Zod 4 has introspection but no markdown

Zod 4 (current `zod@4.3.6`, MIT, ~133M weekly downloads) exposes `z.toJSONSchema()` and a metadata system, but no markdown export. The only docs-related endpoint on `zod.dev` is the `llms.txt` + MCP server that serves Zod's *own* library docs to LLMs — orthogonal to this need. Open issue [colinhacks/zod#5383](https://github.com/colinhacks/zod/issues/5383) tracks adding markdown URLs and confirms none exist today. The monorepo's `packages/` directory contains `zod`, `mini`, `core`, `docs`, `docs-v3`, `tsc` — no `@zod/docs`.

For hand-rolled introspection, the public surface in v4 is `schema.shape` (record of field → child type), `.meta()` (reads the entry registered in `z.globalRegistry` — id/title/description/examples plus your augmented `GlobalMeta` keys), `.describe()`, and `instanceof` checks against `ZodOptional`/`ZodDefault`/`ZodString`/etc. **Defaults remain semi-internal**: the v4 changelog renamed `._def` to `._zod.def` and explicitly tells library authors the structure may change. A walker will touch `_zod.def.defaultValue` and `_zod.def.innerType` to unwrap defaulted/optional fields — accept the lock-in or pin Zod minor versions.

The single actively-maintained third-party generator is **[`zod2md@0.3.3`](https://github.com/matejchalk/zod2md)**, released April 1, 2026, MIT, with explicit `zod/v4` support and `$ZodFunction` handling. It reads `.meta({ title })` keys to render section headings. `zod-to-markdown`, `zod-doc`, and `zod-to-md` are stale; `@jackdbd/zod-to-doc` last shipped in 2024 and targets v3. `@asteasolutions/zod-to-openapi` and `samchungy/zod-openapi` produce OpenAPI JSON only — no markdown emitter; you'd need Redoc or widdershins downstream.

### Commander 12 ships only string help

`commander.helpInformation()` returns the rendered help block as a plain-text string, and `configureHelp()` lets you override formatters, but there is **no JSON or structured emitter and no markdown export**. The auto-generate feature request, [tj/commander.js#756](https://github.com/tj/commander.js/issues/756), has been open since 2018. The community package `commander-to-markdown` is in the `b12-archive` org — explicitly archived. Nothing else is maintained. To produce structured output: walk `program.commands`, then per-command iterate `cmd.options` (each `Option` carries `flags`, `description`, `defaultValue`, `required`, `optional`, `variadic`, `argChoices`) and `cmd.registeredArguments`. That walk is ~30 lines.

### Apify and Crawlee: nothing relevant

The Apify CLI is oclif-based but its command set (`create`, `init`, `run`, `push`, `actors`, `builds`, `validate-schema`, …) contains **no `readme`, `docs`, or `generate`**. `apify actors info` has `--readme` and `--input` flags, but those *fetch* an existing Actor's metadata from the platform — they don't generate one. There is no published Apify package that converts `INPUT_SCHEMA.json` to a markdown table: `@apify/input_schema` (v3.14.0) is parsing/validation only, `apify/input-schema-editor-react` is a visual editor, and no `@apify/actor-form` exists on npm. Spot-checks of `apify/web-scraper`, `apify/website-content-crawler`, and `apify/actor-scraper` READMEs show prose-only input descriptions with no marker comments — the Apify Store's input tab is rendered server-side at runtime from the committed `INPUT_SCHEMA.json`, never written back as markdown. Issue [apify/actor-scraper#122](https://github.com/apify/actor-scraper/issues/122) explicitly treats README and `INPUT_SCHEMA.json` as separate manual maintenance.

The Crawlee monorepo's root `package.json` devDependencies show lerna, turbo, vitest, tsx — **no `markdown-magic`, no `jsdoc-to-markdown`, no `oclif`**. The docs site is Docusaurus; `@crawlee/cli` is a yargs+inquirer scaffolder with no docs command.

### The MCP SDK is also DIY territory

`@modelcontextprotocol/sdk` (currently v1.29.x, with v2 alphas splitting into `@modelcontextprotocol/server` and `@modelcontextprotocol/client`) ships transports, OAuth, and an Inspector debugger — but **no `tools/list` → markdown helper**. Searches for `mcp-to-markdown`, `mcp-server-readme`, and `mcp-tools-doc` find no maintained tool as of April 2026. `markdownify-mcp` and `mcp-docs-service` are adjacent (markdown-related MCP servers, not server-doc generators). Since the tool inputs will be Zod schemas registered with `.meta({ title, description })`, the same Zod walker that builds the Apify input table will trivially produce the MCP tool list — one emitter, two outputs.

### oclif's `readme` command, exactly

Despite the name, the source lives in the **`oclif` dev CLI**, not `@oclif/core`: [`oclif/oclif/src/commands/readme.ts`](https://github.com/oclif/oclif/blob/main/src/commands/readme.ts). MIT, works against `@oclif/core` v4 ESM and CJS plugins, ~119 LOC. The literal markers are exactly three pairs — copy-paste verbatim:

```
<!-- usage -->        <!-- usagestop -->
<!-- commands -->     <!-- commandsstop -->
<!-- toc -->          <!-- tocstop -->
```

The replace regex is ``<!-- ${tag} -->(.|\n)*<!-- ${tag}stop -->``. There is **no `<!-- description -->`**. `usage` injects a `$ npm install -g <cli>` block plus the `<n>/<version> <platform>-<arch> node-v<node>` version line. `commands` produces an H2 per command with description, a fenced `--help` block, and a `_See code: [src/commands/foo.ts](repo-link)_` reference; `--multi` splits it into per-topic files in `--output-dir`. `toc` rebuilds a table of contents from headings.

Flag set as of April 2026: `--[no-]aliases`, `--dry-run`, `--multi`, `--nested-topics-depth`, `--output-dir` (default `docs`), `--plugin-directory`, `--readme-path` (default `README.md`), `--repository-prefix` (or set `oclif.repositoryPrefix` in `package.json`), `--[no-]source-links`, `--tsconfig-path`, `--version`. Most oclif CLIs invoke it from `prepack`: `"prepack": "npm run build && oclif manifest && oclif readme"`. The Apify CLI's auto-generated H2-per-command sections in its README match this output verbatim, confirming it's the same machinery.

## Verdict — write ~60 lines, skip `markdown-magic`

| Option | Verdict |
|---|---|
| **`markdown-magic` v4.8.0** | Works, but it's a third-party orchestrator that pulls in 30+ deps to do what ~60 lines of custom code can do, and the plugin ecosystem isn't needed here. |
| **`oclif readme` directly** | Not applicable — Commander, not oclif. Even if it were, it generates *command* docs, not Zod/Apify input tables. |
| **`zod2md`** | Reasonable for the Zod side alone (Zod-v4-native, MIT, fresh April 2026 release), but it emits a standalone file, not a region inside an existing README. A region templater is still needed on top. |
| **DIY ~60 lines** | Best fit. One Zod walker (~30 LOC) emits both the Apify INPUT_SCHEMA table *and* the MCP tool list from `.shape` + `.meta()`. One Commander walker (~30 LOC) emits the CLI options table. One region-replacer (regex for ~20 LOC, or `mdast-zone@6.1.0` for ~30 LOC and AST correctness) drops them between markers. |

**Concrete recommendation:** adopt oclif's marker syntax even though Contextractor is on Commander — write `<!-- input -->`/`<!-- inputstop -->`, `<!-- cli -->`/`<!-- clistop -->`, `<!-- mcp-tools -->`/`<!-- mcp-toolsstop -->` to stay visually consistent with the conventions Apify CLI users already see. For the replacer, use **`mdast-zone@6.1.0`** (MIT, ESM, ~3.8k weekly, last published ~1 year, 9 dependents — quietly stable in the unified ecosystem) over regex: it parses HTML comments as proper `html` nodes, survives fenced code blocks, and round-trips through Prettier. The async pipeline is `remark-parse@11` → `mdast-zone` → `remark-stringify@11`. Wire it into a `prepack` or `pre-commit` hook the same way oclif does.

Net new code beyond the existing `zod-to-apify-input-schema` shim: roughly **40 additional lines** for the markdown-table emitter and ~30 for the region replacer. That's smaller than a `markdown-magic` config file would be, with no third-party docs tool to track across major versions — and the same Zod walker feeds the INPUT_SCHEMA.json, the README input table, and the future MCP tool listing.

## Implications for `prompt.md`

This research is **not in scope for the current `prompt.md`**. The current prompt's Phase-2/3 deferrals (CrawlConfig deduplication, MCP wiring, `zod-to-apify-input-schema` npm publish) leave room for a Phase-4 follow-up: a separate prompt that wires the README region templating once the Zod schema is stable. Adding it to the current prompt would expand scope and risk the snapshot test. Defer.

If a follow-up prompt is written, it should:

- live as a sibling dated subfolder in `prompts/`, not as an edit to this one
- reuse the Zod walker built for `to-apify-schema.ts` rather than introducing a parallel one
- adopt the oclif marker convention (`<!-- input --> ... <!-- inputstop -->`)
- depend on `mdast-zone@6.1.0` + `remark-parse@11` + `remark-stringify@11` (all MIT)
- ship a `docs:check` script that re-runs the generator and `git diff --exit-code -- '**/*.md'` to gate drift in CI, mirroring the snapshot-test pattern from this prompt

## Sources

- Zod 4 metadata + introspection: `https://zod.dev/metadata`, `https://zod.dev/v4/changelog`
- `zod2md`: `https://github.com/matejchalk/zod2md`
- Commander structured-help feature request: `https://github.com/tj/commander.js/issues/756`
- Apify CLI command reference: `https://docs.apify.com/cli/docs/reference`
- `@apify/input_schema` (parsing/validation, no markdown): `https://www.npmjs.com/package/@apify/input_schema`
- oclif `readme` source: `https://github.com/oclif/oclif/blob/main/src/commands/readme.ts`
- oclif `readme` docs: `https://github.com/oclif/oclif/blob/main/docs/readme.md`
- `mdast-zone`: `https://github.com/syntax-tree/mdast-zone`, `https://www.npmjs.com/package/mdast-zone`
- MCP TypeScript SDK: `https://www.npmjs.com/package/@modelcontextprotocol/sdk`
