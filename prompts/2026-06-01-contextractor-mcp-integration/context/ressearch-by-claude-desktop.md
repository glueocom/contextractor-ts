# Exposing Contextractor via the Model Context Protocol (MCP)

## TL;DR
- **Ship MCP two ways.** For the npm/CLI distribution, add a built-in MCP server using the official `@modelcontextprotocol/sdk` (a `contextractor mcp` / `serve --mcp` subcommand over stdio) exposing two tools — `extract_url` and `extract_html`. For the Apify distribution, rely on the hosted Apify MCP server at `mcp.apify.com`, which already exposes `glueo/contextractor` as a tool — building a custom in-actor MCP transport is largely redundant for the basic extract case.
- **The Claude MCP connector only works with remote URL-based servers.** It can call contextractor through `mcp.apify.com` (a remote Streamable HTTP server) or a self-hosted remote server, but NOT a local `npx` stdio server.
- **apify/mcpc is a CLI MCP *client*, not a way to expose a server.** It is useful for testing/scripting/agent "code mode" against contextractor's MCP server, and for x402 payments — but it does not help you publish or host an MCP server.

## Key Findings

### Question 1 — npm package / standalone CLI as an MCP server
- The official MCP TypeScript SDK is `@modelcontextprotocol/sdk`, currently **v1.29.0 on the v1.x line** (published ~April 2026; the npm registry lists "51743 other projects" depending on it). A next-generation **v2 line exists** (`2.0.0-alpha`), splitting into `@modelcontextprotocol/server` and `@modelcontextprotocol/client`, with V1 fixes continuing on the long-lived `v1.x` branch. You build a server with `McpServer`, register tools with Zod/Standard-Schema input schemas, and connect a transport.
- Two transports matter: **stdio** (local, spawned as a subprocess via `npx`, ideal for Claude Desktop/Claude Code) and **Streamable HTTP** (remote). Per the official SDK README, the SDK supports "Streamable HTTP for remote servers (recommended)" and "HTTP + SSE for backwards compatibility only" — i.e. the old HTTP+SSE transport is deprecated.
- A CLI typically adds MCP as a subcommand (e.g. `contextractor mcp` or `serve --mcp`) rather than shipping a separate binary, reusing the existing extraction code.
- Contextractor's npm package already exposes `extract(urls, options)` and the engine supports raw-HTML extraction — clean seams for `extract_url` and `extract_html` tools.

### Question 2 — Apify Actor as an MCP server
- `mcp.apify.com` is the hosted, remote (Streamable HTTP, OAuth-capable) Apify MCP server. It exposes any Apify Store actor as an MCP tool, including dynamic discovery (`search-actors`, `add-actor`/`call-actor`) and the ability to pin a specific actor via the `?tools=` query parameter (e.g. `?tools=glueo/contextractor`).
- `@apify/actors-mcp-server` is the open-source npm package for running the same thing locally over stdio (`npx @apify/actors-mcp-server --actors glueo/contextractor`, with `APIFY_TOKEN`).
- Apify also supports **actorized MCP servers**: any actor can run in Standby mode and expose an MCP endpoint (`webServerMcpPath`, Streamable HTTP at `/mcp`). This is how to publish a *custom* MCP server as an actor — but for contextractor, since the actor already shows up through `mcp.apify.com`, building a custom in-actor MCP transport is redundant for the basic extract use case.

### Question 3 — Claude/Anthropic MCP connector
- The MCP connector (Messages API `mcp_servers` parameter) connects Claude directly to **remote URL-based** MCP servers without a separate client. Per the Claude API docs, it "requires the beta header: `anthropic-beta: mcp-client-2025-11-20`" and "The previous version (mcp-client-2025-04-04) is deprecated." It supports **tools only** — "Other MCP features like resources and prompts are not currently supported" — supports OAuth bearer tokens via `authorization_token`, is **not available on Amazon Bedrock or Google Vertex**, and "is not eligible for Zero Data Retention (ZDR)."
- It would work with contextractor via `mcp.apify.com` or a self-hosted remote server, but NOT with a local stdio `npx` server.

### Question 4 — apify/mcpc
- `mcpc` (`npm install -g @apify/mcpc`) is a universal **CLI client** for MCP — persistent sessions, stdio + Streamable HTTP, OAuth 2.1, tasks, JSON "code mode", a proxy mode for AI sandboxes, and experimental x402 payments. Per its GitHub README, "The initial version of mcpc was developed and launched by Jan Curn of Apify with the help of Claude Code, during late nights over Christmas 2025 in North Beach, San Francisco." It is a client, not a server framework or hosting tool. It is relevant for testing and scripting contextractor's MCP server, not for exposing it.

## Details

### 1. Wrapping the npm/CLI as an MCP server

**Architecture.** An MCP server is a thin adapter that exposes contextractor's existing functions as MCP *tools*. Because contextractor is already a TypeScript/Node package whose public API is `extract(urls, options)` (and whose engine can extract from a raw HTML string), the natural design is to wire those functions to MCP tool handlers.

**Official SDK.** With `@modelcontextprotocol/sdk` you create an `McpServer`, register tools with input schemas (Zod is idiomatic; the SDK accepts any Standard-Schema library and ultimately advertises JSON Schema to clients), and connect a transport. A minimal stdio server:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "contextractor", version: "1.0.0" });

server.registerTool(
  "extract_url",
  {
    description: "Fetch a web page and extract clean, readable main content (Trafilatura). Strips nav, ads, boilerplate. Returns Markdown/text/JSON.",
    inputSchema: {
      url: z.string().url().describe("The URL to fetch and extract"),
      format: z.enum(["markdown","text","json","xml","xml-tei"]).default("markdown"),
      precision: z.boolean().optional().describe("Favor precision (less noise)"),
    },
  },
  async ({ url, format, precision }) => {
    const result = await runExtraction(url, { save: format, precision });
    return { content: [{ type: "text", text: result }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Two tools, not one.** Separate `extract_url` (takes a URL, fetches it) from `extract_html` (takes a raw HTML string + optional base URL). Splitting them gives the model clearer schemas and avoids ambiguous "either/or" inputs. `extract_html` maps to the engine's HTML-string extraction path (`ContentExtractor(config=...).extract(html, url=..., output_format=...)` in the Python engine; the same logic underlies the Node package); `extract_url` maps to the `extract()` fetch path.

**stdio vs Streamable HTTP.** stdio runs locally — the client spawns the server as a child process over stdin/stdout; no ports, no URLs; perfect for a locally installed npm CLI. Streamable HTTP runs the server as a network service and is the recommended transport for remote/shared deployments (it replaced the old HTTP+SSE transport in the 2025 spec revisions). A subtle but critical pitfall: in stdio servers you must never write to stdout (e.g. `console.log`) because it corrupts the JSON-RPC stream — log to stderr instead.

**Subcommand vs separate binary.** The cleaner pattern is a subcommand on the existing CLI (`contextractor mcp` or `contextractor serve --mcp`) so the MCP server reuses extraction code and ships in the same package. Many CLIs do exactly this (e.g. `tldx mcp` exposing an MCP server over stdio). Note: contextractor's repo already contains a `.mcp.json` and `.claude` directory, but those are developer tooling for the project's own environment — there is no shipped product MCP server yet.

**Client configuration (Claude Desktop / Claude Code).** Local stdio servers are configured in the `mcpServers` JSON with a command + args, usually via `npx`:

```json
{
  "mcpServers": {
    "contextractor": {
      "command": "npx",
      "args": ["-y", "contextractor", "mcp"]
    }
  }
}
```

For Claude Code you can instead run `claude mcp add` (stdio uses a `--` separator before the command; HTTP uses `--transport http`).

**Best practices.** Write action-oriented tool descriptions; return structured output (`structuredContent` plus an `outputSchema`) in addition to a human-readable `content` text block for backwards compatibility — but be aware client behavior varies: some clients (e.g. Claude Code) read the `content` text and may not surface `structuredContent`, while others (VS Code) prefer `structuredContent`; and per the 2025-06-18 spec, **if you declare an `outputSchema` you MUST return conforming `structuredContent`** (a mismatch causes errors in strict clients like Gemini CLI). Turn raw HTTP/extraction errors into structured, helpful messages rather than stack traces. Pin your SDK version in production since the spec moves quickly.

**Framework alternatives.** FastMCP for TypeScript (`punkpeye/fastmcp`) sits on top of the official SDK and removes boilerplate (decorator-style `addTool`, sessions, auth, multi-transport including httpStream and edge runtimes). It's a reasonable accelerator; the official SDK is the right call when you want maximum control and minimal dependencies. (`mcp-framework` and similar exist in the same niche; FastMCP is the most mature TS option.)

### 2. Apify Actor as an MCP server

**The hosted Apify MCP server (`mcp.apify.com`).** This is a remote Streamable HTTP server that turns the Apify Store into MCP tools. Any actor — including `glueo/contextractor` — can be invoked. Configuration:
- **Pin a single actor:** `https://mcp.apify.com/?tools=glueo/contextractor` exposes just that actor as a tool (recommended to keep the tool list small and routing reliable — Apify advises aiming for ~10–15 tools max).
- **Dynamic discovery:** default tools include `search-actors` and `add-actor`/`call-actor` so a capable client (Claude.ai web, VS Code) can find and load contextractor on the fly.
- **Auth:** OAuth (sign in via browser) or `Authorization: Bearer <APIFY_TOKEN>`. Per Apify's docs, "Server-Sent Events (SSE) transport will be removed on April 1, 2026. The Apify MCP server now uses Streamable HTTP."
- The hosted server also supports output-schema inference: "The hosted Apify MCP server at https://mcp.apify.com supports output schema inference for structured Actor results… The local stdio server does not support this feature."

```json
{
  "mcpServers": {
    "apify-contextractor": {
      "url": "https://mcp.apify.com/?tools=glueo/contextractor",
      "headers": { "Authorization": "Bearer <APIFY_TOKEN>" }
    }
  }
}
```

**Local/standalone `@apify/actors-mcp-server`.** The same server can run locally over stdio: `npx @apify/actors-mcp-server --actors glueo/contextractor` with `APIFY_TOKEN` set. Useful for development, air-gapped/corporate-network setups, or version pinning. Note that rental/dynamic Store actors are only reachable via the hosted endpoint; the local server only exposes actors you explicitly add.

**Actorized MCP / Standby mode.** Apify lets any actor *be* an MCP server by running in Standby mode and setting `webServerMcpPath` in `.actor/actor.json` (`usesStandbyMode: true`), exposing a stable Streamable HTTP endpoint like `https://username--actor.apify.actor/mcp`. Apify's TS/Python MCP templates (`apify create --template ts-mcp-server`) even wrap an existing stdio MCP server and re-host it, with pay-per-event (PPE) monetization (e.g. charge per `tool-request` event). This is how you'd publish a *bespoke* MCP server on Apify.

**Tradeoff for contextractor.** Because the `glueo/contextractor` actor is already reachable through `mcp.apify.com`, building a custom in-actor MCP transport (Standby `/mcp`) duplicates work for the basic extract case. The custom-actor route only earns its keep if you want: (a) bespoke tool names/schemas (e.g. `extract_url`/`extract_html` instead of the generic actor-call tool), (b) custom pay-per-event pricing per tool call, or (c) a branded standalone MCP endpoint independent of the generic Apify gateway. Also note a naming gotcha if you do build custom: the Apify actor input uses `startUrls`/`maxPagesPerCrawl`/`saveExtracted*ToKeyValueStore`/`trafilaturaConfig`, whereas the npm/CLI uses `urls`/`maxPages`/`save`/`trafilaturaConfig` — your tool schema should hide this divergence behind clean tool names.

### 3. The Claude MCP connector

The connector lets the Anthropic Messages API talk to remote MCP servers directly — no separate MCP client process. You pass an `mcp_servers` array and the beta header `anthropic-beta: mcp-client-2025-11-20` (the older `mcp-client-2025-04-04` is deprecated). Structure:

```json
{
  "model": "claude-sonnet-4-5",
  "max_tokens": 1000,
  "messages": [{"role": "user", "content": "Extract the main content of https://example.com"}],
  "mcp_servers": [
    {
      "type": "url",
      "url": "https://mcp.apify.com/?tools=glueo/contextractor",
      "name": "contextractor",
      "authorization_token": "<APIFY_TOKEN_OR_OAUTH_ACCESS_TOKEN>"
    }
  ]
}
```

Requirements/limits: **URL-based remote servers only** (Streamable HTTP or SSE URLs) — a local `npx` stdio server will NOT work; **tools only** (no resources/prompts); OAuth via `authorization_token` (you handle the OAuth flow and pass the access token, refreshing as needed); tool filtering via allowlist/denylist (in the new version, tool config lives in the `tools` array as MCPToolset objects); **not supported on Amazon Bedrock or Google Vertex**; and **not ZDR-eligible**. When Claude uses these tools, the response includes `mcp_tool_use`/`mcp_tool_result` content blocks. For contextractor this means the connector path requires a hosted endpoint — either `mcp.apify.com` or a self-hosted Streamable HTTP server (or a contextractor actor in Standby mode). The local npm stdio server is for desktop clients, not the connector.

(Separately, note the distinction from claude.ai/Claude Desktop "custom connectors": those are also remote MCP servers, but configured in the Claude UI and brokered from Anthropic's cloud — so your server must be reachable from Anthropic's IP ranges over the public internet. Local stdio servers in `claude_desktop_config.json` are a different, local-only mechanism.)

### 4. apify/mcpc

`mcpc` is "a universal CLI client for MCP." It maps MCP operations to shell commands (`mcpc connect`, `mcpc @session tools-list`, `mcpc @session tools-call <tool> arg:=value`), keeps persistent sessions via a lightweight bridge process, supports stdio and Streamable HTTP (SSE deprecated/unsupported), full OAuth 2.1 (PKCE, DCR, CIMD, RFC 8707 resource indicators), async tasks, resources, prompts, a `--json` "code mode" for scripting and AI agents, a `--proxy` mode to expose an authenticated session to sandboxed AI code without leaking credentials, and experimental x402 crypto payments (USDC on Base). It's built on the official MCP TypeScript SDK. It is also the client Apify recommends for x402 payments to its MCP server.

**Relevance to contextractor:** `mcpc` is a *consumer* of MCP servers, not a way to build or host one. It is genuinely useful for (a) manually testing contextractor's MCP server — e.g. `mcpc connect ./.vscode/mcp.json:contextractor @ctx` then `mcpc @ctx tools-call extract_url url:="https://example.com"`; (b) letting CLI agents use contextractor in token-efficient "code mode" with `grep`-based dynamic discovery; and (c) paying for the Apify contextractor actor via x402 without an API token. It does NOT expose contextractor as a server and is not part of the publishing path.

## Recommendations

**Stage 1 — Ship an in-package MCP server in the npm/CLI (highest leverage).** Add a `contextractor mcp` subcommand using `@modelcontextprotocol/sdk` (pin v1.29.x, or evaluate the v2 line) over stdio. Expose exactly two tools:
- `extract_url(url, format?, precision?, …)` → calls `extract()`.
- `extract_html(html, url?, format?, …)` → calls the engine's HTML-string extraction.

Keep schemas tight (Zod), default `format` to `markdown` (offer `text`/`json`/`xml`/`xml-tei`), write strong descriptions, log only to stderr, and return both a text `content` block and (optionally) `structuredContent` with a matching `outputSchema`. Document the Claude Desktop `mcpServers` config using `npx`. This gives privacy-preserving local extraction with zero hosting cost and works in Claude Desktop, Claude Code, Cursor, and VS Code. Optionally use FastMCP to cut boilerplate.

**Stage 2 — For the Apify path, lean on `mcp.apify.com`; don't build a custom in-actor transport yet.** Document the one-line remote config `https://mcp.apify.com/?tools=glueo/contextractor` for hosted/remote use and the Claude MCP connector. Use `@apify/actors-mcp-server --actors glueo/contextractor` for local Apify-backed testing. This is essentially free to provide (it already works) and covers the heavy-duty crawling/JS-rendering use cases the actor is built for.

**Stage 3 — Optionally publish a remote contextractor MCP server** if you want a branded hosted endpoint, bespoke `extract_url`/`extract_html` tool names, or per-tool monetization. The cheapest route is an actorized MCP server in Standby mode (Streamable HTTP `/mcp`, `usesStandbyMode: true`, `webServerMcpPath`) reusing the Stage-1 server code, or self-host the Stage-1 server behind Streamable HTTP. Either makes the Claude MCP connector usable against your own URL and unlocks Apify's PPE billing.

**On mcpc and the connector:** Use `mcpc` as your test/CI client and for code-mode agents; it changes nothing about how you publish. Use the Claude MCP connector only once you have a remote URL (Stage 2 or 3).

**Tool design (canonical):** `extract_url` and `extract_html` as separate tools; `markdown` default with `text`/`json`/`xml`/`xml-tei` options; precision/recall toggles mapped to `trafilaturaConfig` (`favorPrecision`, `favorRecall`, `includeTables`, `includeLinks`, `deduplicate`, `targetLanguage`, etc.). **Transports:** stdio for the local npm package; Streamable HTTP for any hosted deployment.

**Thresholds that change the plan:**
- If you need browser-rendered/JS-heavy crawling at scale, multi-page crawling, or proxy rotation, prefer the Apify actor path (it already handles Playwright, proxies, glob/pseudo-URL crawling) over the local stdio server.
- If you need zero-data-retention or run Claude through Bedrock/Vertex, the Claude MCP connector is off the table — use a desktop client with a local/remote server instead.
- If a single contextractor tool is the only thing exposed, pin it explicitly (`?tools=glueo/contextractor` or `--actors`) rather than relying on dynamic discovery, which inflates tool metadata and degrades routing.

## Caveats
- A few specifics could not be confirmed from the npm registry directly: the exact published version of the `contextractor` npm package (GitHub's latest release was v0.3.12, Apr 16 2026; the npm version likely tracks it) and whether it ships any MCP code (it does not — the repo's `.mcp.json`/`.claude` are dev tooling, and the public API is only `extract()` plus the CLI). Raw-HTML extraction is documented on the Python `contextractor-engine` (`ContentExtractor.extract(html, …)`); confirm the equivalent is reachable from the Node package before wiring `extract_html`.
- The MCP spec and SDKs move fast (transport deprecations: SSE→Streamable HTTP; Apify SSE removal April 1, 2026; connector beta header bumped to `mcp-client-2025-11-20`; SDK v2 in alpha). Pin versions and re-check before release.
- Client support for advanced MCP features (dynamic discovery, `structuredContent`/`outputSchema`) varies across Claude Desktop, Claude Code, Cursor, VS Code, and Gemini CLI; test against your target clients, and only declare an `outputSchema` if you reliably return conforming `structuredContent`.
- mcpc's x402 support is explicitly experimental, and several Apify MCP behaviors (default tool sets) are documented as subject to change — specify `tools=` explicitly for stable production behavior.
