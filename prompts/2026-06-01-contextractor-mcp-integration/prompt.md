# Make Contextractor Available Through an MCP Server

> **TLDR**: Build a new `@contextractor/mcp` workspace package that exposes two tools — `extract_html`
> (pure HTML → content) and `extract_url` (fetch + extract) — over **stdio** and **Streamable HTTP**,
> reusing `@contextractor/extraction`, `@contextractor/crawler`, and `@contextractor/schema`. Then make the
> Apify actor itself an MCP endpoint via **Actor Standby**. Finally, run a real **test step** that exercises
> the local server (stdio + HTTP) and the Apify actor through MCP. The Apify production actor
> `glueo/contextractor` is currently **deprecated and its deployed schema is stale**, so all Apify MCP
> testing targets `glueo/contextractor-test` only — never production.

Run the steps in order. Each step must build and pass before the next begins. Read every referenced file in
full before editing it. Make the smallest diff that satisfies each step.

## Background

Research is already done — read both before starting:

- `prompts/2026-06-01-contextractor-mcp-integration/context/ressearch-by-claude-code.md` — repo-grounded,
  live-verified; the authoritative route map and tool design.
- `prompts/2026-06-01-contextractor-mcp-integration/context/ressearch-by-claude-desktop.md` — broader
  ecosystem survey (FastMCP alternative, `structuredContent`/`outputSchema` client caveats).

This builds the routes the research labelled **A** (local stdio), **A′** (Streamable HTTP), and **B3**
(Actor-as-MCP via Standby). Routes **B1** (hosted `mcp.apify.com`) and **D** (`mcpc`) need no code — they
are the test/verify mechanism in Step TEST.

## Skills and Agents

Skills:

- `apify-actor-development`, `apify-ops`, `apify-schemas` — Actor Standby, `.actor/*.json`, runtime ops.
- `autonomous-task` — run end-to-end without confirmation prompts; defer only genuine blockers.

Agents:

- `ts-pro` — primary: the new package, tools, transports, vitest tests.
- `code-reviewer` — per-step diff review.
- `test-runner` — local format, lint, unit, smoke.
- `web-research-specialist` — fallback for unexpected MCP SDK or Apify Standby behavior.

Steps TOOL-HTML, TOOL-URL, and TRANSPORT-STDIO can be developed in parallel after SCAFFOLD and SCHEMA land;
TRANSPORT-HTTP and ACTOR-STANDBY depend on the tool handlers existing.

## Rules

- [Minimal diff](../../.claude/rules/minimal-diff.md) — Edit existing files surgically; Write only new files.
- [Test maintenance](../../.claude/rules/test-maintenance.md) — add tests in the same step as the code.
- [Spec maintenance](../../.claude/rules/spec-maintenance.md) — add/update SPEC.md in the same step.
- [Apify production protection](../../.claude/rules/apify-production.md) — never push or run production; test
  actor only; `apify push` does not work for this monorepo — use `/platform:deploy-and-test`.
- [Native addon boundary](../../.claude/rules/native-addon-boundary.md) — keep `txt`/format names as-is.
- [JSON config only](../../.claude/rules/json-config-only.md) — document config as JSON only.
- [User-facing docs](../../.claude/rules/user-facing-docs.md) — no deploy/internal notes in any public README.
- [Security](../../.claude/rules/security.md) — treat scraped HTML as untrusted; redact secrets; never log
  tokens or full request bodies.
- [Task completion](../../.claude/rules/task-completion.md) — finish every step end-to-end.

**Ask the user before**: adding any dependency (`@modelcontextprotocol/sdk`, `zod`, any HTTP-server dep),
changing the Dockerfile, or any proxy/deploy action — per `apify-production.md`.

## Reusable entry points (do not reinvent)

- `@contextractor/crawler` (`packages/crawler/src/index.ts`):
  - `createContextractorCrawler(opts: ContextractorCrawlerOptions)` — returns a configured Crawlee crawler.
  - `buildRequests(startUrls: string[], keepUrlFragments = false)` — URL strings → Crawlee `Request[]`.
  - `memorySink<ExtractionResult>()` → the `Sink` function itself with a `.results: ExtractionResult[]`
    property attached (call it, pass it as `sink`, then read `sink.results`) — in-memory collector.
  - `type Sink<T> = (result: T) => Promise<void>`; `ExtractionResult` has `url`, `loadedUrl`, `html`,
    `metadata`, `formats: Partial<Record<OutputFormat,string>>`, `rawHtmlHash`, `rawHtmlLength`,
    `crawlDepth`, `referrerUrl`.
  - Mapping reference: `apps/standalone/src/cliProgram.ts` `runExtractAction` (the
    `createContextractorCrawler({ startUrls, sink, formats, mode, … })` then
    `crawler.run(buildRequests(...))` flow).
- `@contextractor/extraction` (`packages/extraction/src/index.ts`):
  - `class ContentExtractor` → `extract(html, { url?, format? }): ExtractionResult | null`,
    `extractMetadata(html, url?): Metadata`, `extractAllFormats(html, { url?, formats? })`.
  - `type OutputFormat = 'txt' | 'markdown' | 'json' | 'html'`; `DEFAULT_CONFIG`.
- `@contextractor/schema` (`packages/schema/src/source-of-truth/input.ts`):
  - `ContextractorInput` (Zod **4.4.3**; `.pick()`/`.partial()`/`.shape` available), `ContextractorInputType`.
- Template: `apps/standalone` (package.json, tsconfig.json, vitest `*.test.ts` patterns, `sinks.ts`).
- MCP SDK: `@modelcontextprotocol/sdk` `^1.29.0` (stable v1 line — not the v2 alpha). Imports:
  `@modelcontextprotocol/sdk/server/mcp.js` (`McpServer`), `.../server/stdio.js` (`StdioServerTransport`),
  `.../server/streamableHttp.js` (`StreamableHTTPServerTransport`). `registerTool`'s `inputSchema` is a
  ZodRawShape (an object of zod types), **not** `z.object(...)`.

## Workspace facts

- `pnpm-workspace.yaml` includes `apps/*` → a new `apps/mcp-server/` is picked up automatically.
- Root `turbo.json`: `build` dependsOn `^build` (outputs `dist/**`); `test` dependsOn `^build`.
- Root `tsconfig.json`: ES2022, `module`/`moduleResolution` NodeNext, `strict`. Apps extend it with
  `outDir: dist`, `rootDir: src`, `noEmit: false`.
- `biome.json`: single quotes, semicolons, trailing commas, 100-col, `useImportType`/`useExportType` errors,
  `noUnusedImports` error.
- Build/test/lint from root: `pnpm build`, `pnpm test`, `pnpm lint`.

## Step SCAFFOLD: Create the package

Create `apps/mcp-server/` mirroring `apps/standalone`:

- `package.json`: `name: "@contextractor/mcp"`, `version: "0.1.0"`, `type: "module"`,
  `bin: { "contextractor-mcp": "dist/server.js" }`, `main: "dist/server.js"`. Scripts `build`/`fix`/`start`/
  `test`/`lint` copied from `apps/standalone`. Workspace deps: `@contextractor/extraction`,
  `@contextractor/crawler`, `@contextractor/schema` (all `workspace:*`). Runtime deps:
  `@modelcontextprotocol/sdk` `^1.29.0`, `zod` `^4`. DevDeps mirror standalone (`@biomejs/biome`,
  `@types/node`, `tsx`, `typescript`, `vitest`). **Ask the user before installing the two new runtime deps.**
- `tsconfig.json`: extends `../../tsconfig.json` with `outDir: dist`, `rootDir: src`, `noEmit: false`,
  `include: ["src/**/*"]`.
- Decide publish posture: keep `private: true` like the rest of the monorepo unless the user wants public
  `npx`; if public, add `publishConfig` and `files: ["dist"]`. Default to `private: true` and note the
  decision in SPEC.

Verify `pnpm install` links the workspace deps and `pnpm -F @contextractor/mcp build` compiles an empty
`src/server.ts`. Commit when complete.

## Step SCHEMA: Derive tool inputs from the source of truth

In `apps/mcp-server/src/`, derive both tools' zod input shapes from `ContextractorInput` so the MCP contract
never drifts from the CLI and actor schema:

- `extract_url` input: `.pick()` the crawl/extract fields that make sense for a single URL (e.g. `crawlerType`,
  `mode`, `includeComments`, `includeTables`, `includeImages`, `includeLinks`, `targetLanguage`, `save`,
  `waitUntil`, `pageLoadTimeoutSecs`, `headless`) plus a required `url: z.string().url()`. Keep
  `maxCrawlPages` defaulted to `1` for the tool.
- `extract_html` input: a required `html: z.string()`, optional `url`, `format` (the four `OutputFormat`s),
  and the same extraction toggles where they apply to pure-HTML extraction.

Pass the ZodRawShape (the `.shape` object) to `registerTool`, not a wrapped `z.object`. Commit when complete.

## Step TOOL-HTML: `extract_html`

Implement a pure, no-network tool: build a `ContentExtractor` from the toggles, call
`extract(html, { url, format })`, optionally attach `extractMetadata(html, url)`. Return an MCP result with a
text `content` block (the extracted string) and `structuredContent` (content + metadata) — but only declare
an `outputSchema` if you reliably return matching `structuredContent` (see the desktop research caveat).
Handle `null` extraction as an explicit, non-throwing error message. Add a vitest test using a fixture HTML
string asserting non-empty output for each format. Commit when complete.

## Step TOOL-URL: `extract_url`

Implement the fetch+extract tool by reusing the crawler, following `runExtractAction` in
`apps/standalone/src/cliProgram.ts`:

- Parse input through the picked schema; build options for `createContextractorCrawler` (`startUrls: [url]`,
  `sink`, `formats` = saved formats minus `original`, `mode`, the include* toggles, `headless`,
  `maxPages: 1`, mapped timeouts/waitUntil).
- `const sink = memorySink<ExtractionResult>();` pass it as `sink`; run
  `await crawler.run(buildRequests([url]))`; read `sink.results`.
- Return the extracted formats + projected metadata as the MCP result (text + optional structuredContent).
- Bound it: enforce `maxPages: 1` and a sane timeout so a tool call can't run unbounded.

Add a vitest test that drives `extract_url` against a local fixture page (serve a fixture or stub the crawl
boundary; do not hit the public internet in unit tests). Commit when complete.

## Step TRANSPORT-STDIO: stdio server

Wire `McpServer` + `StdioServerTransport` in `src/server.ts`; register both tools. **stdout is the JSON-RPC
channel** — never `console.log`; route all logging (`pino`, matching the repo) to **stderr**. The `bin`
(`contextractor-mcp`) launches this by default. Commit when complete.

## Step TRANSPORT-HTTP: Streamable HTTP server

Add a `--http [port]` mode that serves the same tools over `StreamableHTTPServerTransport` (this is route A′
— the only local-built path the Claude Messages-API **MCP connector** can reach, since the connector requires
a remote HTTPS URL and cannot use stdio). Document that the connector needs the beta header
`anthropic-beta: mcp-client-2025-11-20` and a Bearer `authorization_token`, and that exposing this publicly
requires TLS + auth in front (out of scope to host here). Add a test that starts the HTTP server on an
ephemeral port and lists tools over it. Commit when complete.

## Step ACTOR-STANDBY: Apify actor as an MCP endpoint (B3)

Make the actor itself a branded remote MCP server via Apify **Standby**, reusing the same tool handlers:

- Read `apps/apify-actor/.actor/actor.json` and the Apify Standby + MCP-server-actor docs (use the
  `apify-actor-development` / `apify-schemas` skills and `mcpc @apify search-apify-docs`).
- Enable Standby and a Streamable-HTTP MCP path (`usesStandbyMode`, `webServerMcpPath` — confirm exact keys
  against current Apify docs; the `mcpServers` placeholder in `packages/schema/src/apify/apify-meta.ts` is
  the aligned schema hook). Wire the actor's standby entry to serve the same `extract_html`/`extract_url`
  handlers so there is one implementation, not two.
- Build only. **Do not deploy to production.** If a live deploy is needed, use `/platform:deploy-and-test`
  against the test actor (`dev` → `glueo/contextractor-test`). Commit when complete.

## Step DOCS-SPEC: Docs and specs

- Add `apps/mcp-server/SPEC.md` (tools, inputs/outputs, transports, the publish-posture decision) and wire it
  into the root `SPEC.md`.
- Add registration instructions to the appropriate developer doc (not a public README): `claude mcp add
  --transport stdio contextractor -- npx -y @contextractor/mcp`, a Claude Desktop `mcpServers` block, and the
  connector request shape from the research doc.
- Keep all deploy/internal notes out of the public Actor README per `user-facing-docs.md`. Commit when complete.

## Step TEST: Verify everything

This is the required test step. Run all of it; report results plainly.

- **Local checks**: `pnpm build`, `pnpm test`, `pnpm lint` all green (delegate to `test-runner`).
- **Local stdio MCP**: build, then with `mcpc` (already installed and configured per `CLAUDE.md`) connect the
  stdio binary and confirm both tools and a real call:
  - `mcpc connect "node apps/mcp-server/dist/server.js" @ctx` (or via an `mcp.json` reference).
  - `mcpc @ctx tools-list` shows `extract_html` and `extract_url`.
  - `mcpc @ctx tools-call extract_html html:='"<html><body><article>hi</article></body></html>"' format:=markdown`.
  - `mcpc @ctx tools-call extract_url url:="https://example.com" format:=markdown`.
- **Local HTTP MCP**: start `node apps/mcp-server/dist/server.js --http 8765` and
  `mcpc connect http://127.0.0.1:8765 @ctxhttp` then `mcpc @ctxhttp tools-list`. Stop the server after.
- **Apify actor through MCP (read-only + one bounded run, test actor only)**:
  - `mcpc @apify tools-list` (confirm connectivity).
  - `mcpc @apify tools-call fetch-actor-details actor:="glueo/contextractor-test" output:='{"inputSchema":true}'`
    (read-only contract check).
  - ONE bounded live run: `mcpc @apify tools-call call-actor actor:="glueo/contextractor-test"
    input:='{"startUrls":[{"url":"https://example.com"}],"save":["markdown"],"maxCrawlPages":1}'`.
  - **Never** call `glueo/contextractor` (production) — it is deprecated and its deployed schema is stale.
- Record pass/fail per check. If `mcpc`'s `@apify` session is expired, run `mcpc @apify restart` first.
  Commit when complete.

## Step REVIEW: Diff review

Run `code-reviewer` over the full diff (correctness, security of the HTTP transport, no secret logging,
schema-drift checks). Fix every finding, re-run Step TEST's local checks, and commit.

## Out of scope

- Hosting the Streamable-HTTP server on a public URL with TLS/OAuth (documented, not provisioned).
- Un-deprecating or redeploying the production actor (a separate, user-authorized action).
- Publishing `@contextractor/mcp` to npm unless the user opts in during Step SCAFFOLD.
