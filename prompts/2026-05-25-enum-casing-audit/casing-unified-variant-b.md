# Enum Casing — Variant B: Unify on kebab-case everywhere

> **TLDR**: Make every enum value that `contextractor` itself defines kebab-case, identically across the Apify actor input schema, the npm library types, and the standalone CLI. The only values that stay SCREAMING_SNAKE_CASE are the genuinely-foreign Apify platform constants (proxy group names like `RESIDENTIAL`/`GOOGLE_SERP`/`DATACENTER`, and `resourcePermissions` `READ`/`WRITE`) — and those are NOT contextractor enums; they're handled by the built-in `editor: "proxy"` and passed through verbatim. The single explicit exception to the kebab rule is **`waitUntil`**, which uses the flat lowercase browser-library tokens verbatim (see the dedicated rule below) because that is what Crawlee, Playwright, and every first-party Apify scraper use. This is the "one vocabulary across all three surfaces" variant. `proxyRotation` becomes kebab (`recommended | per-request | until-failure`) because contextractor owns it — the Apify platform never reads it; it is mapped to Crawlee's `ProxyConfiguration` internally.

> **Note:** This is a greenfield project — no backward compatibility requirements.

Companion research (read for the full rationale and the foreign-constant boundary rule):
- `prompts/2026-05-19-cli-proxy-config-consolidation/context/enum-casing-research-2026-05.md`
- `prompts/2026-05-19-cli-proxy-config-consolidation/context/enum-casing-unified-research-2026-05.md`

## Skills and Agents

- `apify-schemas` skill — schema field inspection and gen-input-schema
- `ts-pro` — TypeScript edits to Zod source, CLI parser, config translation, tests

---

## The rule for Variant B

There are exactly two categories of enum value. Classify every value into one, then apply the casing:

1. **Owned by contextractor → kebab-case.** Any value that contextractor defines, reads, validates, and maps internally. The Apify platform never matches it verbatim. These are unified to kebab-case across ALL surfaces (actor schema, library, CLI). Includes: `engine`/`crawlerType`, `mode`, `save`, `deduplication`, `saveDestination`, and **`proxyRotation`**.

2. **Foreign platform constant → preserved verbatim (SCREAMING_SNAKE).** Any value that the Apify platform itself matches byte-for-byte: proxy group identifiers (`RESIDENTIAL`, `GOOGLE_SERP`, `DATACENTER`, `SHADER`, `BUYPROXIES94952`) and `resourcePermissions` (`READ`, `WRITE`). These are NOT contextractor enums — they are emitted by the built-in `editor: "proxy"` / resource editors and forwarded to `Actor.createProxyConfiguration()` unchanged. Do NOT kebab them, do NOT declare them as your own `enum`, do NOT add a translation map.

The distinguishing test: *if I rename this value, does an Apify backend reject it?* If yes → foreign constant, leave it. If no → owned, kebab it.

### Explicit exception: `waitUntil` uses the browser-library token verbatim (flat lowercase)

`waitUntil` is an owned field, but its values are **borrowed verbatim from the underlying browser-automation library**, not composed by contextractor. Do NOT kebab-case it. Use the exact flat lowercase tokens the upstream library accepts, matching what Crawlee and the first-party Apify scrapers already use:

- **Playwright (contextractor's engine)** — `page.goto({ waitUntil })` accepts exactly `'load' | 'domcontentloaded' | 'networkidle' | 'commit'`. These are the values to use.
- **Precedent — `apify/playwright-scraper`** input schema enum is exactly `["networkidle", "load", "domcontentloaded"]` (flat lowercase, no separators).
- **Precedent — `apify/puppeteer-scraper` / `apify/web-scraper`** use the Puppeteer-flavored flat tokens `["domcontentloaded", "load", "networkidle2", "networkidle0"]`.
- **Crawlee** does not define its own `waitUntil` enum; it forwards the value straight to `page.goto({ waitUntil })`, so its "notation" is the browser library's flat lowercase tokens.

Rationale: `domcontentloaded` and `networkidle` are single opaque upstream tokens (mirroring DOM lifecycle event names), not compound words contextractor assembled. Splitting them into `dom-content-loaded` / `network-idle` would invent word boundaries the source vocabulary does not have AND force a `.replace(/-/g,'')` shim at every `page.goto()` call. Flat lowercase passes through verbatim with zero shim and is itself kebab-compatible (single lowercase tokens). Therefore: **`waitUntil` MUST be `'load' | 'domcontentloaded' | 'networkidle' | 'commit'` — never dashed.** This is the one field where "unify on kebab" yields to "preserve the upstream token," and the two rules do not actually conflict because single lowercase tokens are already in the kebab-compatible form.

---

## Step ANALYZE: Read every file that defines or consumes an enum

Read all of these before editing:

- `packages/schema/src/source-of-truth/input.ts` — Zod source of truth (actor + library)
- `apps/apify-actor/.actor/input_schema.json` — generated Actor schema
- `apps/apify-actor/src/config.ts` — schema → crawler translation; any `*_MAP` constants
- `apps/apify-actor/src/config.test.ts` — config translation tests
- `apps/standalone/src/cliProgram.ts` — full file; `parse*` helpers; CLI flag definitions
- `apps/standalone/README.md` and `apps/standalone/SPEC.md` — flag docs
- `packages/crawler/src/createCrawler.ts` — programmatic types and the proxy/rotation mapping into Crawlee `ProxyConfiguration`, and the `waitUntil` passthrough into `page.goto`

Confirm the Zod source and generated JSON agree on enum values for every field.

---

## Step AUDIT: Classify and set target casing

| Field | Category | Target casing (all surfaces) | Notes |
|---|---|---|---|
| `crawlerType` | owned | kebab + colon-namespace allowed | `playwright-firefox` or keep `playwright:firefox` colon namespace (each segment lowercase). Prefer flattening colon → dash for strict unification: `playwright-firefox`, `playwright-adaptive`, `cheerio`. |
| `deduplication` | owned | kebab | e.g. `none`, `url`, `content-hash` |
| `mode` | owned | kebab | `precision`, `balanced`, `recall` |
| `save` | owned | kebab | `txt`, `markdown`, `json`, `html`, `original` |
| `saveDestination` | owned | kebab | `dataset`, `key-value-store` |
| `proxyRotation` | **owned** | **kebab** | `recommended`, `per-request`, `until-failure`. Mapped to Crawlee `ProxyConfiguration` internally — Apify platform never reads this string. |
| `waitUntil` | owned but **upstream-token** | **flat lowercase, verbatim — NOT kebab** | `load`, `domcontentloaded`, `networkidle`, `commit`. Matches Playwright `page.goto`, `apify/playwright-scraper`, and Crawlee. No dashes. No shim. See the explicit exception rule above. |
| `apifyProxyGroups` (inside `proxyConfiguration`) | **foreign** | **leave SCREAMING_SNAKE** | `RESIDENTIAL`, `GOOGLE_SERP`, etc. Not a contextractor enum. Use built-in `editor: "proxy"`. |
| `resourcePermissions` | **foreign** | **leave SCREAMING_SNAKE** | `READ`, `WRITE`. Platform-validated metadata. |

---

## Step FIX: Apply Variant B

Use `str_replace` / Edit on existing files (never Write). Follow the `minimal-diff` rule.

### B.1 — Update the Zod source of truth
In `packages/schema/src/source-of-truth/input.ts`, set every OWNED enum and its `.default(...)` to kebab-case, EXCEPT `waitUntil` which uses the flat lowercase browser tokens:

```ts
crawlerType: z.enum(['playwright-firefox', 'playwright-adaptive', 'cheerio']).default('playwright-firefox'),
deduplication: z.enum(['none', 'url', 'content-hash']).default('url'),
mode: z.enum(['precision', 'balanced', 'recall']).default('balanced'),
save: z.enum(['txt', 'markdown', 'json', 'html', 'original']).default('markdown'),
saveDestination: z.enum(['dataset', 'key-value-store']).default('dataset'),
proxyRotation: z.enum(['recommended', 'per-request', 'until-failure']).default('recommended'),
// waitUntil: flat lowercase browser tokens, verbatim — matches Playwright / apify-playwright-scraper / Crawlee. NEVER dashed.
waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle', 'commit']).default('load'),
```

Do NOT touch `proxyConfiguration` (built-in `editor: "proxy"`) or any `resourcePermissions` field. Those keep `RESIDENTIAL`/`GOOGLE_SERP`/`READ`/`WRITE` verbatim.

### B.2 — Update internal switches / equality checks
Anywhere the code branches on an old literal (`'PER_REQUEST'`, `'NETWORKIDLE'`, etc.) in `apps/apify-actor/src/config.ts`, `apps/standalone/src/cliProgram.ts`, `packages/crawler/src/createCrawler.ts`, update to the new literal. TypeScript will flag stale comparisons after the enum narrows.

### B.3 — Map proxyRotation into Crawlee (not a passthrough)
In the proxy wiring (`packages/crawler/src/createCrawler.ts` or `apps/apify-actor/src/config.ts`), translate the kebab `proxyRotation` value into Crawlee `ProxyConfiguration` behavior. Crawlee has no rotation enum — `per-request` means "do not pass a `sessionId`"; session-sticky means "pass a `sessionId`"; tiered/recommended maps to your default behavior. Implement as a small internal switch, NOT a string map exposed in the schema:

```ts
function applyRotation(rotation: ProxyRotation, opts: ProxyConfigurationOptions) {
  switch (rotation) {
    case 'per-request':   /* omit sessionId on newUrl */ break;
    case 'until-failure': /* reuse sessionId until block */ break;
    case 'recommended':   /* default Crawlee behavior */ break;
  }
}
```

### B.4 — waitUntil passes through to Playwright verbatim (NO shim)
Because `waitUntil` is already the exact flat lowercase token Playwright accepts, forward it directly — there is nothing to translate:

```ts
await page.goto(url, { waitUntil: input.waitUntil }); // 'load' | 'domcontentloaded' | 'networkidle' | 'commit'
```

If you find any pre-existing `WAIT_UNTIL_MAP` or case-transform on this field, DELETE it. Variant B explicitly forbids dashing `waitUntil`, so no dash-strip shim is needed or permitted.

### B.5 — saveDestination → Apify SDK opener
`key-value-store` / `dataset` are owned (kebab) but map to SDK methods. One switch:

```ts
const openStore = (d: SaveDestination) =>
  d === 'key-value-store' ? Actor.openKeyValueStore() : Actor.openDataset();
```

### B.6 — Leave foreign constants alone
Confirm `proxyConfiguration` uses `editor: "proxy"` and that `apifyProxyGroups` values are passed straight into `Actor.createProxyConfiguration(input.proxyConfiguration)` without transformation. If contextractor exposes any proxy-group selector of its own, mirror Apify's SCREAMING spelling exactly — do not kebab it.

### B.7 — Regenerate + propagate
```bash
pnpm --filter @contextractor/gen-input-schema start
```
Update `apps/standalone/README.md`, `apps/standalone/SPEC.md`, `apps/apify-actor/README.md`, and `config.test.ts` so every documented/expected literal is the new form. CLI flags read identically: `--proxy-rotation per-request`, `--wait-until networkidle`, `--save-destination key-value-store`. Note the CLI `--wait-until` value is the flat token (`networkidle`, `domcontentloaded`), NOT dashed.

---

## Step VERIFY

```bash
# 1. No SCREAMING enum values remain in the Zod source (proxy groups are NOT enums here).
grep -nE "z\.enum\(\[\s*'[A-Z_]+'" packages/schema/src/source-of-truth/input.ts
# Expected: no matches. proxyRotation is now kebab.

# 2. proxyRotation is kebab in the generated schema.
grep -A6 '"proxyRotation"' apps/apify-actor/.actor/input_schema.json | grep -i '"enum"'
# Expected: ["recommended", "per-request", "until-failure"]

# 3. waitUntil is flat lowercase browser tokens (NOT dashed) in the generated schema.
grep -A6 '"waitUntil"' apps/apify-actor/.actor/input_schema.json | grep -i '"enum"'
# Expected: ["load", "domcontentloaded", "networkidle", "commit"] (order may vary)
# MUST NOT contain "network-idle" or "dom-content-loaded".

# 4. No dashed waitUntil tokens anywhere.
grep -rnE "network-idle|dom-content-loaded" apps/ packages/
# Expected: no matches.

# 5. Foreign constants are still verbatim where used (proxyConfiguration is built-in editor; groups pass through).
grep -rnE "RESIDENTIAL|GOOGLE_SERP|DATACENTER" apps/apify-actor/src/ packages/crawler/src/
# Expected: only appears (if at all) as pass-through to createProxyConfiguration, never inside a z.enum.

# 6. No schema-layer translation maps for owned values, and no waitUntil case-transform.
grep -rnE "WAIT_UNTIL_MAP|PROXY_ROTATION_MAP|MODE_MAP" apps/ packages/
# Expected: no matches. (Internal proxyRotation switch is allowed; named *_MAP schema tables and any waitUntil dash shim are not.)

# 7. Zod ↔ generated JSON agree.
node -e "
const j = require('./apps/apify-actor/.actor/input_schema.json');
for (const [k, v] of Object.entries(j.properties)) {
  if (v.enum) console.log(k, JSON.stringify(v.enum));
  if (v.items && v.items.enum) console.log(k + '[items]', JSON.stringify(v.items.enum));
}
"
```

---

## Step TEST-LOCAL

```bash
pnpm build && pnpm fix && pnpm lint && pnpm test
```
Fix TypeScript errors from stale literals until clean. Then spot-check both surfaces:

```bash
CLI="apps/standalone/dist/cli.js"
node "$CLI" extract --proxy-rotation per-request --wait-until networkidle --help    # accepted
node "$CLI" extract --proxy-rotation PER_REQUEST https://example.com                # clear error
node "$CLI" extract --wait-until network-idle https://example.com                  # clear error (dashed token rejected)
```

---

## Step REPORT

```
✅ Variant B applied — kebab-case unified across actor schema, library, and CLI.

Owned enums migrated to kebab: <list>
proxyRotation: now kebab (recommended | per-request | until-failure), mapped to Crawlee internally.
waitUntil: flat lowercase browser tokens verbatim (load | domcontentloaded | networkidle | commit) — matches Playwright / apify-playwright-scraper / Crawlee. NOT dashed, no shim.
Foreign constants left verbatim (NOT contextractor enums): RESIDENTIAL/GOOGLE_SERP/DATACENTER (proxy groups), READ/WRITE (resourcePermissions)
Translation maps removed: <list, e.g. WAIT_UNTIL_MAP>
```

This prompt does not commit. Leave branch/commit operations to the caller.
