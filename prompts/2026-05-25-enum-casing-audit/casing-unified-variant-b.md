# Enum Casing — Variant B: Unify on kebab-case everywhere

> **TLDR**: Make every enum value that `contextractor` itself defines kebab-case, identically across the Apify actor input schema, the npm library types, and the standalone CLI. The only values that stay SCREAMING_SNAKE_CASE are the genuinely-foreign Apify platform constants (proxy group names like `RESIDENTIAL`/`GOOGLE_SERP`/`DATACENTER`, and `resourcePermissions` `READ`/`WRITE`) — and those are NOT contextractor enums; they're handled by the built-in `editor: "proxy"` and passed through verbatim. This is the "one vocabulary across all three surfaces" variant. `proxyRotation` becomes kebab (`recommended | per-request | until-failure`) because contextractor owns it — the Apify platform never reads it; it is mapped to Crawlee's `ProxyConfiguration` internally.

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

1. **Owned by contextractor → kebab-case.** Any value that contextractor defines, reads, validates, and maps internally. The Apify platform never matches it verbatim. These are unified to kebab-case across ALL surfaces (actor schema, library, CLI). Includes: `engine`/`crawlerType`, `mode`, `save`, `deduplication`, `saveDestination`, `waitUntil`, and **`proxyRotation`**.

2. **Foreign platform constant → preserved verbatim (SCREAMING_SNAKE).** Any value that the Apify platform itself matches byte-for-byte: proxy group identifiers (`RESIDENTIAL`, `GOOGLE_SERP`, `DATACENTER`, `SHADER`, `BUYPROXIES94952`) and `resourcePermissions` (`READ`, `WRITE`). These are NOT contextractor enums — they are emitted by the built-in `editor: "proxy"` / resource editors and forwarded to `Actor.createProxyConfiguration()` unchanged. Do NOT kebab them, do NOT declare them as your own `enum`, do NOT add a translation map.

The distinguishing test: *if I rename this value, does an Apify backend reject it?* If yes → foreign constant, leave it. If no → owned, kebab it.

---

## Step ANALYZE: Read every file that defines or consumes an enum

Read all of these before editing:

- `packages/schema/src/source-of-truth/input.ts` — Zod source of truth (actor + library)
- `apps/apify-actor/.actor/input_schema.json` — generated Actor schema
- `apps/apify-actor/src/config.ts` — schema → crawler translation; any `*_MAP` constants
- `apps/apify-actor/src/config.test.ts` — config translation tests
- `apps/standalone/src/cliProgram.ts` — full file; `parse*` helpers; CLI flag definitions
- `apps/standalone/README.md` and `apps/standalone/SPEC.md` — flag docs
- `packages/crawler/src/createCrawler.ts` — programmatic types and the proxy/rotation mapping into Crawlee `ProxyConfiguration`

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
| `waitUntil` | owned | kebab/lowercase | `load`, `dom-content-loaded`, `network-idle`, `commit`. Forwarded to Playwright with a dash-strip shim (see Step FIX). |
| `apifyProxyGroups` (inside `proxyConfiguration`) | **foreign** | **leave SCREAMING_SNAKE** | `RESIDENTIAL`, `GOOGLE_SERP`, etc. Not a contextractor enum. Use built-in `editor: "proxy"`. |
| `resourcePermissions` | **foreign** | **leave SCREAMING_SNAKE** | `READ`, `WRITE`. Platform-validated metadata. |

---

## Step FIX: Apply Variant B

Use `str_replace` / Edit on existing files (never Write). Follow the `minimal-diff` rule.

### B.1 — Update the Zod source of truth
In `packages/schema/src/source-of-truth/input.ts`, set every OWNED enum and its `.default(...)` to kebab-case:

```ts
crawlerType: z.enum(['playwright-firefox', 'playwright-adaptive', 'cheerio']).default('playwright-firefox'),
deduplication: z.enum(['none', 'url', 'content-hash']).default('url'),
mode: z.enum(['precision', 'balanced', 'recall']).default('balanced'),
save: z.enum(['txt', 'markdown', 'json', 'html', 'original']).default('markdown'),
saveDestination: z.enum(['dataset', 'key-value-store']).default('dataset'),
proxyRotation: z.enum(['recommended', 'per-request', 'until-failure']).default('recommended'),
waitUntil: z.enum(['load', 'dom-content-loaded', 'network-idle', 'commit']).default('load'),
```

Do NOT touch `proxyConfiguration` (built-in `editor: "proxy"`) or any `resourcePermissions` field. Those keep `RESIDENTIAL`/`GOOGLE_SERP`/`READ`/`WRITE` verbatim.

### B.2 — Update internal switches / equality checks
Anywhere the code branches on an old literal (`'PER_REQUEST'`, `'NETWORKIDLE'`, etc.) in `apps/apify-actor/src/config.ts`, `apps/standalone/src/cliProgram.ts`, `packages/crawler/src/createCrawler.ts`, update to the new kebab literal. TypeScript will flag stale comparisons after the enum narrows.

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

### B.4 — waitUntil → Playwright shim
Playwright's `page.goto({ waitUntil })` accepts `'load' | 'domcontentloaded' | 'networkidle' | 'commit'` (no dashes). Add ONE boundary shim at the Playwright call site — not in the schema layer:

```ts
const toPlaywrightWaitUntil = (v: WaitUntil) => v.replace(/-/g, '') as
  'load' | 'domcontentloaded' | 'networkidle' | 'commit';
```

If you would rather avoid even this shim, keep `waitUntil` values dash-free (`domcontentloaded`, `networkidle`) — that is still kebab-compatible (single lowercase tokens) and matches Playwright verbatim. Pick one approach and apply it consistently across actor + standalone. **Document the choice in the prompt output.**

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
Update `apps/standalone/README.md`, `apps/standalone/SPEC.md`, `apps/apify-actor/README.md`, and `config.test.ts` so every documented/expected literal is the new kebab form. CLI flags read identically: `--proxy-rotation per-request`, `--wait-until network-idle`, `--save-destination key-value-store`.

---

## Step VERIFY

```bash
# 1. No SCREAMING enum values remain in the Zod source (proxy groups are NOT enums here).
grep -nE "z\.enum\(\[\s*'[A-Z_]+'" packages/schema/src/source-of-truth/input.ts
# Expected: no matches. proxyRotation is now kebab.

# 2. proxyRotation is kebab in the generated schema.
grep -A6 '"proxyRotation"' apps/apify-actor/.actor/input_schema.json | grep -i '"enum"'
# Expected: ["recommended", "per-request", "until-failure"]

# 3. Foreign constants are still verbatim where used (proxyConfiguration is built-in editor; groups pass through).
grep -rnE "RESIDENTIAL|GOOGLE_SERP|DATACENTER" apps/apify-actor/src/ packages/crawler/src/
# Expected: only appears (if at all) as pass-through to createProxyConfiguration, never inside a z.enum.

# 4. No schema-layer translation maps for owned values.
grep -rnE "WAIT_UNTIL_MAP|PROXY_ROTATION_MAP|MODE_MAP" apps/ packages/
# Expected: no matches. (Internal switches and the Playwright dash-strip shim are allowed; named *_MAP schema tables are not.)

# 5. Zod ↔ generated JSON agree.
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
node "$CLI" extract --proxy-rotation per-request --wait-until network-idle --help   # accepted
node "$CLI" extract --proxy-rotation PER_REQUEST https://example.com                # clear error
```

---

## Step REPORT

```
✅ Variant B applied — kebab-case unified across actor schema, library, and CLI.

Owned enums migrated to kebab: <list>
proxyRotation: now kebab (recommended | per-request | until-failure), mapped to Crawlee internally.
waitUntil approach: <"dash-strip shim" | "dash-free values">
Foreign constants left verbatim (NOT contextractor enums): RESIDENTIAL/GOOGLE_SERP/DATACENTER (proxy groups), READ/WRITE (resourcePermissions)
Translation maps removed: <list, e.g. WAIT_UNTIL_MAP>
```

This prompt does not commit. Leave branch/commit operations to the caller.
