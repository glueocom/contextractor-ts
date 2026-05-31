# Contextractor over MCP — Research & Integration Guide

> Goal: make **contextractor** (HTML → clean main-content text in `txt` / `markdown` / `json` / `html`)
> callable through the **Model Context Protocol (MCP)** so LLM clients — Claude Code, Claude Desktop,
> claude.ai, and the Claude **Messages API MCP connector** — can use it as a tool.
>
> Scope: research + recommendation + implementation outline. No production code is written by this
> document; the implementation outline (see [Recommended path](#recommended-path--implementation-outline))
> is the handoff for a follow-up task.
>
> Date: 2026-06-01. Versions cited (MCP spec `2025-11-25`, TS SDK `~1.29.0`, connector beta
> `mcp-client-2025-11-20`, Apify MCP server `~0.9.x`) are current as of this date — re-confirm at
> implementation time.

---

## TL;DR

There are **four** routes. They are complementary, not mutually exclusive.

| # | Route | What it is | Effort | Works with Claude **connector** (remote API)? |
|---|-------|-----------|--------|-----------------------------------------------|
| A | **New stdio MCP package** (`@contextractor/mcp`) | A small MCP server wrapping `@contextractor/extraction` (+ `@contextractor/crawler`), launched via `npx` | Medium (new package) | ❌ stdio is local-only |
| B1 | **Apify hosted** `https://mcp.apify.com` | The actor `glueo/contextractor` is callable as an MCP tool with **no server code** | Low — un-deprecate + redeploy¹ | ✅ remote HTTPS + token |
| B2 | **Apify local bridge** `@apify/actors-mcp-server --actors glueo/contextractor` | Local stdio/HTTP server fronting the cloud actor | Low (config only) | ❌ (stdio) / ✅ if run as HTTP |
| B3 | **Actor-as-MCP-server** (Apify Standby) | Make contextractor *itself* a branded remote MCP endpoint | High (new actor) | ✅ remote HTTPS |

**`mcpc`** ([github.com/apify/mcpc](https://github.com/apify/mcpc)) is a **client** — used to *test/consume*
any of the above from the shell. It does **not** build a server.

¹ The prod actor is currently deprecated and its deployed schema is stale vs `main` — see
[Important finding](#important-finding--production-actor-is-deprecated--schema-stale). So B1 is "redeploy +
un-deprecate," not literally zero-touch.

### Recommendation (dual-track)

1. **Now, lowest effort — reach every Claude surface via Apify (B1).** `glueo/contextractor` already exists
   and `mcp.apify.com` exposes it as a remote, token-authenticated, Streamable-HTTP MCP tool that works with
   the Messages-API **MCP connector**, claude.ai, Claude Desktop, and Claude Code — no engineering.
   ⚠️ One catch the live check found: the prod actor is currently **deprecated and its deployed schema is
   stale** vs `main`, so this path is "un-deprecate + redeploy," not literally zero-touch — see
   [Important finding](#important-finding--production-actor-is-deprecated--schema-stale).
2. **For local/offline dev DX — ship `@contextractor/mcp` (A).** A thin stdio server reusing the existing
   extraction + crawler packages, registered with `claude mcp add`. Runs natively (no Apify account, no
   network round-trip to the platform), and reuses `@contextractor/schema` as the single source of truth
   for tool inputs.
3. **Optional later — branded remote endpoint (B3)** via Actor Standby, if a contextractor-branded MCP URL
   (and per-tool monetization) is wanted independent of the generic Apify server.
4. **Verify all of it with `mcpc` (D).**

---

## Important finding — production actor is deprecated & schema stale

The live read-only check on 2026-06-01 (see [Verification](#verification)) surfaced two facts that
**gate Route B1** and should be resolved before promoting the hosted path to users:

- **`glueo/contextractor` is marked DEPRECATED on the platform.** `fetch-actor-details` returned
  *"This Actor is deprecated and may not be maintained anymore."* (title on Apify: "contextractor -
  Trafilatura based", categories "Developer Tools, News"). A deprecated actor still runs and is still
  callable as an MCP tool, but it is hidden from Store discovery and signals "do not use" to clients. **Un-deprecate
  it (or designate the canonical actor) before pointing users/the connector at it.**
- **The deployed prod input schema is STALE vs this repo.** The live schema still uses the *old* field
  names — `globs`, `excludes`, `maxPagesPerCrawl`, `maxCrawlingDepth` — whereas the current repo
  (`apps/apify-actor/.actor/input_schema.json`, generated from `packages/schema`) uses
  `includeUrlGlobs`, `excludeUrlGlobs`, `maxCrawlPages`, `maxCrawlDepth`. So the **MCP tool contract a
  client sees today does not match `main`.** A fresh Git-connected build is needed to align them; until
  then, any connector/`call-actor` example must use the *deployed* field names, not the repo's.

Implication for the recommendation: Route B1 is still the lowest-effort path, but it is **"redeploy +
un-deprecate," not literally zero-touch.** The current `dev`→`glueo/contextractor-test` actor reflects the
new schema and is the safe target for verification today.

---

## Background: what we are exposing

Contextractor is a pnpm + Cargo monorepo with several consumption surfaces
(`/Users/miroslavsekera/r/contextractor-ts/`):

- **`@contextractor/extraction`** (`packages/extraction`, `private: true`) — pure **HTML → content**.
  Backed by `rs-trafilatura` through the napi-rs binding `@contextractor/extraction-native` (prebuilt
  `.node` for darwin-arm64/x64, linux-x64/arm64, shipped via `optionalDependencies` — no Rust toolchain at
  runtime). Public API (`packages/extraction/src/index.ts`):
  - `class ContentExtractor` → `extract(html, { url?, format? }): ExtractionResult | null`,
    `extractMetadata(html, url?): Metadata`,
    `extractAllFormats(html, { url?, formats? }): Record<OutputFormat, ExtractionResult>`.
  - `type OutputFormat = 'txt' | 'markdown' | 'json' | 'html'`; `DEFAULT_CONFIG`; `getDefaultConfig()`.
  - **Important:** input is **HTML, not a URL** — no network. A useful "give me a URL, get clean content"
    tool must fetch first.
- **`@contextractor/crawler`** (`packages/crawler`) — Crawlee + Playwright; fetches/crawls URLs and feeds
  extraction. This is the fetch half the extraction package lacks.
- **Standalone CLI `@contextractor/standalone`** (`apps/standalone`, `private: true`, `bin: contextractor`)
  — URLs/files → crawl/fetch → extract → output (`txt|markdown|json|html|original|all`). Built on
  `commander`. **Not published to npm** (`private: true`, no `publishConfig`), so it cannot be `npx`-run by
  end users today.
- **Apify actor** (`apps/apify-actor`, `@contextractor/apify`) — `glueo/contextractor` (prod, `main`
  branch) / `glueo/contextractor-test` (test, `dev` branch), Git-built from `glueocom/contextractor-ts`.
  Input contract = `apps/apify-actor/.actor/input_schema.json` (44 fields: `startUrls` required, plus
  crawler/extraction/output/proxy/performance options), **generated** from the Zod schema
  `ContextractorInput` in `packages/schema`.
- **`@contextractor/schema`** (`packages/schema`) — single source of truth: `ContextractorInput`
  (Zod 4 object) + `toApifyInputSchema()`/`writeApifyInputSchema()` codegen that emits the `.actor/*.json`
  files. This schema is directly reusable as an MCP tool input schema (see implementation outline).

### Existing MCP wiring in this repo

- `.mcp.json` registers one server — the generic Apify platform server:
  ```json
  { "mcpServers": { "apify": { "type": "http", "url": "https://mcp.apify.com" } } }
  ```
- `CLAUDE.md` mandates the **`mcpc` CLI** as the interface to that server ("never the native MCP surface").
- `packages/schema/src/apify/apify-meta.ts` has an unused `mcpServers?: unknown` forward-compat field in
  the Apify input-schema descriptor (and `mcpServers` is in `PROPERTY_KEY_ORDER`). Not used today.
- **There is no contextractor-specific MCP server today.** The actor is, however, already reachable through
  `mcp.apify.com`'s generic `call-actor` tool.

### MCP in one paragraph

MCP is an open JSON-RPC protocol (latest spec `2025-11-25`) that lets an LLM client call **tools** (plus
resources/prompts) exposed by a **server**. Two transports matter here: **stdio** (server is a local child
process; client launches it via a command — used by Claude Desktop/Code) and **Streamable HTTP** (server is
a remote HTTPS endpoint — required by the Messages-API connector; SSE is the legacy variant). The official
TypeScript SDK is **`@modelcontextprotocol/sdk`** (`~1.29.0`).
Sources: [modelcontextprotocol.io spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25),
[transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports),
[TS SDK](https://github.com/modelcontextprotocol/typescript-sdk).

---

## Question 1 — How can the NPM package / standalone be accessed through an MCP server?

The standalone CLI/library is **not** itself an MCP server, and it is `private` (unpublished). The standard
way to expose it is to build a **small, dedicated MCP server package** with the official SDK that imports
the existing workspace packages and registers tools. Ship it with a `bin` so clients launch it via `npx`.

### Tool design

Two tools cover both halves of the codebase:

- **`extract_html`** — pure library (`@contextractor/extraction`), no network. Input: `html: string`,
  `format?: 'txt'|'markdown'|'json'|'html'`, optional `url` (improves metadata/relative-link resolution),
  plus extraction toggles (`includeComments`, `includeTables`, `includeImages`, `includeLinks`, `mode`, …).
  Output: extracted content + metadata.
- **`extract_url`** — full pipeline (`@contextractor/crawler` → `@contextractor/extraction`). Input: a URL
  (or `startUrls`) + the crawler/extraction options from `ContextractorInput`. Output: clean content per
  page. This is the high-value tool for agents ("fetch this page as markdown").

### Canonical stdio server skeleton (correct SDK import paths)

```ts
// src/server.ts  — @contextractor/mcp
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ContentExtractor, type OutputFormat } from "@contextractor/extraction";

const server = new McpServer({ name: "contextractor", version: "0.1.0" });

// registerTool's `inputSchema` is a ZodRawShape (object of zod types), NOT z.object(...)
server.registerTool(
  "extract_html",
  {
    title: "Extract main content from HTML",
    description: "Extract clean main-content text from an HTML string.",
    inputSchema: {
      html: z.string().describe("Raw HTML to extract from"),
      format: z.enum(["txt", "markdown", "json", "html"]).default("markdown"),
      url: z.string().url().optional().describe("Source URL — improves metadata/links"),
    },
  },
  async ({ html, format, url }) => {
    const result = new ContentExtractor().extract(html, { format: format as OutputFormat, url });
    return { content: [{ type: "text", text: result?.content ?? "" }] };
  },
);

await server.connect(new StdioServerTransport()); // stdio: local child-process transport
```

`extract_url` is the same pattern with a Crawlee run inside the handler (reuse the standalone's
crawl→extract path in `apps/standalone/src`).

### Ship + register

`package.json` of the new server:

```json
{
  "name": "@contextractor/mcp",
  "type": "module",
  "bin": { "contextractor-mcp": "dist/server.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^4",
    "@contextractor/extraction": "workspace:*",
    "@contextractor/crawler": "workspace:*",
    "@contextractor/schema": "workspace:*"
  }
}
```

Register with Claude Code:

```bash
claude mcp add --transport stdio contextractor -- npx -y @contextractor/mcp
claude mcp list   # verify
```

Or Claude Desktop (`claude_desktop_config.json`):

```json
{ "mcpServers": { "contextractor": { "command": "npx", "args": ["-y", "@contextractor/mcp"] } } }
```

### Transport choice & the connector caveat

- **stdio** (above) is correct for local clients (Claude Code/Desktop, IDEs). It is **local only**.
- For the Messages-API **MCP connector** (Question 3), a stdio server does **not** qualify — you'd need to
  also expose a **Streamable HTTP** transport (`@modelcontextprotocol/sdk/server/streamableHttp.js`) on a
  public HTTPS URL with auth. That is real ops work; for a remote endpoint, B1/B3 (Apify) are lighter.
- **stdio pitfall:** never write to **stdout** in a stdio server (no `console.log`) — stdout *is* the
  JSON-RPC channel, and any stray write corrupts the stream. Log to **stderr** instead. (The repo's
  TypeScript logging is `pino`; route it to stderr in MCP mode.)
- **SDK version:** target the stable **v1.x** line (`@modelcontextprotocol/sdk`, import paths
  `@modelcontextprotocol/sdk/server/*.js` as shown). A **v2** line exists in alpha that splits into
  `@modelcontextprotocol/server` / `@modelcontextprotocol/client` — do not target it yet; pin the SDK in
  production since the spec/transports move fast.

> Publishing note: the existing `@contextractor/standalone` is `private: true`. The MCP server should be a
> **new** package (`@contextractor/mcp`) that depends on the workspace packages — do not flip the CLI to
> public just to MCP-enable it.

Sources: [TS SDK README](https://github.com/modelcontextprotocol/typescript-sdk),
[SDK server docs](https://ts.sdk.modelcontextprotocol.io/),
[Claude Code MCP](https://code.claude.com/docs/en/mcp).

---

## Question 2 — How can the Apify actor be accessed through an MCP server?

Three sub-routes, increasing in effort.

### B1 — Apify hosted server `https://mcp.apify.com` (zero build) ✅ recommended first step

`mcp.apify.com` is Apify's **remote Streamable-HTTP MCP server**. It exposes generic helper tools
(`search-actors`, `fetch-actor-details`, `call-actor`, `get-actor-run`, `get-actor-output`,
`search-apify-docs`, …) and can call **any actor you have access to** — including a private actor like
`glueo/contextractor` — as a tool. The server loads the actor's input schema and validates calls against it.

- **Auth:** OAuth 2.0 (one-click in claude.ai / Desktop / Cursor) **or** `Authorization: Bearer <APIFY_TOKEN>`
  for headless/API use. It respects your account permissions, so your private actor is reachable with your
  token.
- **Pin contextractor as a first-class tool:** the hosted server accepts a query parameter to preload
  specific actors as dedicated tools, e.g. `https://mcp.apify.com/?tools=glueo/contextractor` (an `?actors=`
  alias has also been used — confirm the current parameter against
  [docs.apify.com/platform/integrations/mcp](https://docs.apify.com/platform/integrations/mcp) at impl
  time). This is the cleanest way to surface *just* contextractor to a client/connector instead of the full
  generic toolset — Apify advises keeping the exposed tool count small (~10–15 max) for reliable routing.
- **Generic call (no pinning):** `call-actor` with `actor:="glueo/contextractor"` and the JSON input
  (`{ "startUrls": [...] }`).
- **Transport note:** Apify is **removing SSE on 2026-04-01** in favor of Streamable HTTP — target the
  Streamable-HTTP base URL, not an `/sse` path.

This requires **no new code** in this repo. It is the path of least resistance and the only route that
works out-of-the-box with the Claude connector (Question 3).

### B2 — Local bridge `@apify/actors-mcp-server` (config only)

Run the actor as a local MCP server backed by cloud runs:

```bash
claude mcp add --transport stdio --env APIFY_TOKEN=*** contextractor-apify \
  -- npx -y @apify/actors-mcp-server --actors glueo/contextractor
```

Good for local clients that want only contextractor (not the whole Apify Store), pinned versions, or
air-gapped-from-the-generic-server setups. Still executes the real cloud actor (needs `APIFY_TOKEN`).

### B3 — Make the actor *itself* an MCP server (Apify Standby) — branded remote endpoint

Apify supports MCP servers that run **as actors** (templates `ts-mcp-empty` / `python-mcp-server`) in
**Standby** mode, giving a stable branded endpoint like
`https://glueo--contextractor-mcp.apify.actor/mcp` (Streamable HTTP). Supports Pay-Per-Event monetization.
Highest effort (a new actor that re-implements the crawl+extract tools), but yields a contextractor-branded
remote MCP URL independent of the generic Apify server. The `mcpServers` placeholder already present in
`apify-meta.ts` is the schema hook aligned with this direction.

Sources: [Apify MCP docs](https://docs.apify.com/platform/integrations/mcp),
[apify/apify-mcp-server](https://github.com/apify/apify-mcp-server),
[@apify/actors-mcp-server](https://www.npmjs.com/package/@apify/actors-mcp-server),
[Apify MCP templates / Standby blog](https://blog.apify.com/build-and-deploy-mcp-servers-typescript/).

---

## Question 3 — Can the Claude MCP connector be utilised? (platform.claude.com/.../mcp-connector)

**Yes — against a remote endpoint.** The [MCP connector](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)
is a **Messages API** feature: Anthropic's backend acts as the MCP client and calls remote MCP servers you
declare inline. You do not run a client yourself.

### Requirements (from the docs)

- **Remote HTTPS only.** "The server must be publicly exposed through HTTP (supports both Streamable HTTP
  and SSE transports). **Local STDIO servers cannot be connected directly.**" `url` must start with
  `https://`.
- **Beta header (current):** `anthropic-beta: mcp-client-2025-11-20`. *(The older `mcp-client-2025-04-04`
  is deprecated; the new version moves tool config out of the server block and into a `tools` →
  `mcp_toolset` entry.)*
- **Tool calls only** — MCP resources/prompts are not supported via the connector.
- **Auth:** optional `authorization_token` (an OAuth/Bearer access token you obtain & refresh yourself).
- **Availability:** Claude API, Claude on AWS, Microsoft Foundry. *Not* Bedrock/Vertex. Not ZDR-eligible.

### Request shape (targeting contextractor via `mcp.apify.com`)

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: mcp-client-2025-11-20" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-opus-4-8",
    "max_tokens": 1024,
    "messages": [{ "role": "user",
      "content": "Fetch https://example.com and give me the article as markdown." }],
    "mcp_servers": [{
      "type": "url",
      "url": "https://mcp.apify.com/?tools=glueo/contextractor",
      "name": "apify",
      "authorization_token": "APIFY_TOKEN"
    }],
    "tools": [{ "type": "mcp_toolset", "mcp_server_name": "apify" }]
  }'
```

Restrict to just the contextractor tool with an allowlist:

```json
{
  "type": "mcp_toolset",
  "mcp_server_name": "apify",
  "default_config": { "enabled": false },
  "configs": { "glueo-slash-contextractor": { "enabled": true } }
}
```

When Claude calls the tool, the response carries `mcp_tool_use` / `mcp_tool_result` blocks; the backend
executes the call (no client round-trip on your side).

### Conclusion

- The connector **cannot** use the local stdio package from Question 1 directly.
- The connector **can** use any remote contextractor endpoint: **`mcp.apify.com` (B1) satisfies every
  requirement today** (remote HTTPS, Streamable HTTP, Bearer/OAuth, actor-as-tool). A self-hosted
  Streamable-HTTP server or Actor-Standby MCP (B3) is the alternative.

Source: [MCP connector docs](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)
(docs.claude.com / docs.anthropic.com redirect here).

---

## Question 4 — Can apify/mcpc be utilised? (github.com/apify/mcpc)

**Yes — as the client/verification tool, not to build a server.** `mcpc` is "a command-line client for the
Model Context Protocol … for interactive shell use, scripting, and AI agents." It connects to existing MCP
servers and calls their tools/resources/prompts/tasks; it does **not** author or host servers.

```bash
npm install -g @apify/mcpc

mcpc login mcp.apify.com                       # OAuth, saved in OS keychain
# or bearer:
mcpc connect https://mcp.apify.com @apify --header "Authorization: Bearer ${APIFY_TOKEN}"

mcpc @apify tools-list                          # confirm contextractor tool is present
mcpc @apify tools-get call-actor                # inspect a tool's schema
mcpc @apify tools-call call-actor actor:="glueo/contextractor" \
  input:='{"startUrls":[{"url":"https://example.com"}],"save":["markdown"]}'
```

Argument syntax: `key:=value` pairs auto-parse as JSON (no spaces around `:=`); inline JSON or stdin also
accepted. This is exactly the convention `CLAUDE.md` already mandates for this repo's Apify server. `mcpc`
is the **developer-side** counterpart to the production-side MCP connector — use it to verify Questions 1–3.

Sources: [github.com/apify/mcpc](https://github.com/apify/mcpc),
[mcpc launch blog](https://blog.apify.com/introducing-mcpc-universal-mcp-cli-client/),
[@apify/mcpc on npm](https://www.npmjs.com/package/@apify/mcpc).

---

## Decision matrix

| Route | Build effort | Local / Remote | Transport | Auth | Claude **connector** | Reuses existing code | Best for |
|-------|-------------|----------------|-----------|------|----------------------|----------------------|----------|
| **A. `@contextractor/mcp` (stdio)** | Medium (new pkg) | Local | stdio | none (runs locally) | ❌ (stdio) | ✅ extraction + crawler + schema | Claude Code/Desktop, offline dev, no Apify acct |
| **A′. same pkg + Streamable HTTP** | High (host + auth) | Remote | Streamable HTTP | you implement | ✅ | ✅ | Self-hosted remote endpoint |
| **B1. `mcp.apify.com`** | **None** (config) | Remote | Streamable HTTP | OAuth / Bearer `APIFY_TOKEN` | ✅ | ✅ (existing actor) | Fastest reach to all Claude surfaces |
| **B2. `@apify/actors-mcp-server`** | Low (config) | Local | stdio (or HTTP) | `APIFY_TOKEN` | ❌ stdio / ✅ HTTP | ✅ (existing actor) | Local client, only contextractor, pinned |
| **B3. Actor-as-MCP (Standby)** | High (new actor) | Remote | Streamable HTTP | Apify | ✅ | partial (re-impl tools) | Branded URL, monetization |
| **D. `mcpc`** | n/a (client) | — | client of any | OAuth / Bearer | — (it's a client) | — | Testing/verifying A, B1–B3 |

---

## Recommended path & implementation outline

Pursue two tracks; they serve different audiences and share the same extraction core.

### Track 1 — Hosted via Apify (B1): ship documentation, not code

`glueo/contextractor` is already MCP-reachable. Deliverables are mostly **docs + config** — plus the two
platform fixes from [Important finding](#important-finding--production-actor-is-deprecated--schema-stale):

- **Un-deprecate `glueo/contextractor`** (or pick the canonical actor) and **trigger a fresh Git-connected
  build of `main`** so the deployed input schema matches the repo (`includeUrlGlobs`/`excludeUrlGlobs`/
  `maxCrawlPages`/`maxCrawlDepth`, not the stale `globs`/`excludes`/`maxPagesPerCrawl`/`maxCrawlingDepth`).
- Add a short "Use Contextractor via MCP" section to user-facing docs showing:
  - claude.ai / Claude Desktop: connect `https://mcp.apify.com` (OAuth), or pin
    `https://mcp.apify.com/?tools=glueo/contextractor`.
  - Messages-API connector: the request from [Question 3](#question-3--can-the-claude-mcp-connector-be-utilised-platformclaudecommcp-connector).
  - `mcpc` verification snippet from [Question 4](#question-4--can-apifymcpc-be-utilised-githubcomapifymcpc).
- Confirm the exact `?actors=`/`?tools=` query syntax and the Streamable-HTTP base path against current
  Apify docs before publishing.
- Respect repo conventions: keep deploy/internal notes out of the public Actor README
  (`.claude/rules/user-facing-docs.md`); the actor-id mapping (`glueo/contextractor` vs `-test`) stays in
  `SPEC.md`/`CLAUDE.md`.

### Track 2 — Local stdio package `@contextractor/mcp` (A): new workspace package

- **Location:** `apps/mcp-server` (an app, like `apps/standalone`) or `packages/mcp`. Prefer `apps/` since
  it is a runnable binary, mirroring `apps/standalone`.
- **`package.json`:** `name: @contextractor/mcp`, `type: module`, `bin: { "contextractor-mcp":
  "dist/server.js" }`; deps on `@modelcontextprotocol/sdk` `^1.29.0`, `zod` `^4`, and workspace
  `@contextractor/extraction`, `@contextractor/crawler`, `@contextractor/schema`. *(Adding deps requires
  the user's OK per `.claude/rules/apify-production.md`.)* If end-users will `npx` it, drop `private` and add
  `publishConfig` (decision point — the rest of the monorepo is private).
- **Tools:** `extract_html` (pure `ContentExtractor`) and `extract_url` (Crawlee fetch → extract, reusing
  the crawl path from `apps/standalone/src`).
- **Single source of truth for inputs:** derive each tool's zod `inputSchema` from `ContextractorInput`
  (`@contextractor/schema`) — e.g. `.pick()` the relevant fields — so the MCP tool contract, the CLI, and
  the Apify input schema never drift. This mirrors the existing codegen philosophy in `packages/schema`.
- **Transport:** `StdioServerTransport` for v1. Optionally add a `--http` mode
  (`StreamableHTTPServerTransport`) later to make Track 2 connector-compatible (becomes route A′).
- **Tests:** per `.claude/rules/test-maintenance.md`, add `*.test.ts` exercising each tool handler
  (fixture HTML → expected extraction) in the same change.
- **Docs/spec:** add `apps/mcp-server/SPEC.md` and wire it into root `SPEC.md`
  (`.claude/rules/spec-maintenance.md`); add registration instructions
  (`claude mcp add --transport stdio contextractor -- npx -y @contextractor/mcp`).

### Track 3 (optional, later) — Actor-as-MCP (B3)

Only if a contextractor-branded remote MCP URL or per-call monetization is desired. Scaffold an Apify MCP
server actor (`ts-mcp-empty`), implement `extract_url`/`extract_html` reusing the extraction package, enable
Standby. Larger effort; defer until Tracks 1–2 are validated.

---

## Verification

> **Verified live on 2026-06-01** (read-only, no actor run triggered): `mcpc @apify tools-list` returned
> 10 tools from `apify-mcp-server` v0.10.11 — including `call-actor` — and
> `mcpc @apify tools-call fetch-actor-details actor:="glueo/contextractor" output:={"inputSchema":true,…}`
> resolved `fullName: glueo/contextractor`, title "contextractor - Trafilatura based", categories
> "Developer Tools, News", last modified 2026-05-26, and returned the full input schema. **The actor is
> reachable as an MCP tool through `mcp.apify.com` today** — Route B1 needs no engineering, only docs/config.
> See the two caveats this check surfaced in [Important finding](#important-finding--production-actor-is-deprecated--schema-stale).

- **Hosted (B1), read-only — works today with this repo's `.mcp.json` + `mcpc`:**
  ```bash
  mcpc @apify tools-list                                   # confirm connectivity (done above)
  mcpc @apify tools-call fetch-actor-details \
    actor:="glueo/contextractor" output:='{"inputSchema":true}'   # read-only: inspect the tool contract
  # End-to-end smoke (actually runs the actor) — use the -test actor, never prod:
  mcpc @apify tools-call call-actor \
    actor:="glueo/contextractor-test" \
    input:='{"startUrls":[{"url":"https://example.com"}],"save":["markdown"],"maxCrawlPages":1}'
  ```
  Use the **`-test`** actor for any run smoke test; never trigger prod from a smoke test.
- **Connector (C):** issue the [Question 3](#question-3--can-the-claude-mcp-connector-be-utilised-platformclaudecommcp-connector)
  request with a real `APIFY_TOKEN`; confirm `mcp_tool_use`/`mcp_tool_result` blocks and extracted markdown.
- **Local package (A), once built:**
  ```bash
  claude mcp add --transport stdio contextractor -- npx -y @contextractor/mcp
  mcpc connect "npx -y @contextractor/mcp" @ctx     # or via an mcp.json reference
  mcpc @ctx tools-call extract_url url:="https://example.com" format:=markdown
  ```
- **Doc review:** all four research questions answered; every external claim cited; tool input contracts
  match `packages/extraction/src/index.ts` and `apps/apify-actor/.actor/input_schema.json`.

---

## References

- MCP spec `2025-11-25` — https://modelcontextprotocol.io/specification/2025-11-25
- MCP transports — https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- MCP TypeScript SDK — https://github.com/modelcontextprotocol/typescript-sdk · docs https://ts.sdk.modelcontextprotocol.io/
- Claude Code MCP — https://code.claude.com/docs/en/mcp
- Claude MCP connector — https://platform.claude.com/docs/en/agents-and-tools/mcp-connector
- Apify MCP server (hosted + local) — https://docs.apify.com/platform/integrations/mcp
- apify/apify-mcp-server — https://github.com/apify/apify-mcp-server
- @apify/actors-mcp-server — https://www.npmjs.com/package/@apify/actors-mcp-server
- Apify MCP / Standby blog — https://blog.apify.com/build-and-deploy-mcp-servers-typescript/ · https://blog.apify.com/how-to-use-mcp/
- apify/mcpc — https://github.com/apify/mcpc · blog https://blog.apify.com/introducing-mcpc-universal-mcp-cli-client/ · npm https://www.npmjs.com/package/@apify/mcpc

### Local source files cited

- `packages/extraction/src/index.ts` — extraction public API
- `apps/apify-actor/.actor/input_schema.json` — actor input contract (44 fields, `startUrls` required)
- `apps/apify-actor/.actor/actor.json` — actor identity (`name: contextractor-test`, title `Contextractor`)
- `apps/standalone/package.json` — `@contextractor/standalone`, `bin: contextractor`, `private: true`
- `packages/schema` — `ContextractorInput` Zod source of truth + Apify schema codegen
- `.mcp.json` — existing `apify` server registration

### Companion document

- [`ressearch-by-claude-desktop.md`](./ressearch-by-claude-desktop.md) — an earlier independent research
  pass (Claude Desktop). It reaches the same four conclusions as this doc and adds extra implementation
  color (FastMCP as a boilerplate-cutting alternative, `structuredContent`/`outputSchema` client-support
  caveats, the npm/CLI-vs-actor field-name divergence). This document is the repo-grounded, live-verified
  version; read that one for the broader ecosystem survey.
