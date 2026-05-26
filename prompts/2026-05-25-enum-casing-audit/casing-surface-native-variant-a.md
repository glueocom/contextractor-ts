# Enum Casing — Variant A: Per-surface native

> **TLDR**: Each surface follows its own ecosystem's native convention. The **Apify actor** input schema keeps SCREAMING_SNAKE_CASE for operational-mode enums that match the `apify/web-scraper` family (`proxyRotation: RECOMMENDED | PER_REQUEST | UNTIL_FAILURE`) and lowercase/kebab for content/format/engine values. The **standalone CLI** uses kebab-case for ALL its flag values (UNIX/POSIX convention), including `proxyRotation` → `--proxy-rotation per-request`. The shared **library** exposes the actor-native casing as its canonical type, and the CLI layer translates kebab flag tokens to the library's values at the parse boundary. Foreign Apify platform constants (`RESIDENTIAL`/`GOOGLE_SERP`/`READ`/`WRITE`) stay verbatim everywhere they appear (actor only; they don't exist in the standalone).

> **Note:** This is a greenfield project — no backward compatibility requirements.

Companion research:
- `prompts/2026-05-19-cli-proxy-config-consolidation/context/enum-casing-research-2026-05.md`
- `prompts/2026-05-19-cli-proxy-config-consolidation/context/enum-casing-unified-research-2026-05.md`

## Skills and Agents

- `apify-schemas` skill — schema field inspection and gen-input-schema
- `ts-pro` — TypeScript edits to Zod source, CLI parser, config translation, tests

---

## The rule for Variant A

Three surfaces, each idiomatic to its ecosystem:

1. **Apify actor input schema (Apify dual convention).**
   - SCREAMING_SNAKE_CASE for actor-internal operational/runtime modes that match the `apify/web-scraper`/`playwright-scraper` precedent: **`proxyRotation: RECOMMENDED | PER_REQUEST | UNTIL_FAILURE`** (and `runMode`/`breakpointLocation` if ever added).
   - lowercase / kebab / colon-namespaced for content, format, engine, resource identifiers: `crawlerType: playwright:firefox`, `mode: precision`, `save: markdown`, `saveDestination: key-value-store`, `waitUntil: load`.
2. **Standalone CLI (UNIX convention).** ALL flag values kebab-case, including the rotation flag: `--proxy-rotation per-request`, `--wait-until network-idle`, `--save-destination key-value-store`. No flag value is SCREAMING — `--proxy-rotation PER_REQUEST` would violate POSIX/GNU/oclif/commander norms.
3. **Foreign Apify platform constants.** `RESIDENTIAL`/`GOOGLE_SERP`/`DATACENTER` and `READ`/`WRITE` stay verbatim in the actor (built-in `editor: "proxy"` / resource editors). They do not exist in the standalone at all.

Because the actor canonical value for `proxyRotation` is SCREAMING but the CLI value is kebab, **Variant A requires one translation at the CLI parse boundary** for `proxyRotation` (and any other field where the two surfaces' native casing differs). That translation is intentional and lives in the CLI layer, not the schema layer.

---

## Step ANALYZE: Read every file that defines or consumes an enum

Read all of these before editing:

- `packages/schema/src/source-of-truth/input.ts` — Zod source of truth (defines the actor-native canonical values)
- `apps/apify-actor/.actor/input_schema.json` — generated Actor schema
- `apps/apify-actor/src/config.ts` — schema → crawler translation
- `apps/apify-actor/src/config.test.ts`
- `apps/standalone/src/cliProgram.ts` — full file; `parse*` helpers; flag definitions
- `apps/standalone/README.md` and `apps/standalone/SPEC.md`
- `packages/crawler/src/createCrawler.ts`

Decide the canonical-type question explicitly: **the library's TypeScript type uses the actor-native casing** (so the actor passes through with zero translation), and the CLI translates inbound kebab flag tokens to that casing. Document this decision in the output.

---

## Step AUDIT: Per-field target casing per surface

| Field | Actor schema | Library type (canonical) | CLI flag value | Needs CLI↔canonical translation? |
|---|---|---|---|---|
| `crawlerType` | `playwright:firefox` … (lowercase+colon) | same | `--crawler-type playwright-firefox` (kebab) | colon→dash only if you keep colon canonical; else none |
| `deduplication` | lowercase | same | kebab (same tokens) | none |
| `mode` | `precision`/`balanced`/`recall` | same | same | none |
| `save` | `txt`/`markdown`/`json`/`html`/`original` | same | same | none |
| `saveDestination` | `key-value-store`/`dataset` (kebab) | same | same | none |
| `proxyRotation` | **`RECOMMENDED`/`PER_REQUEST`/`UNTIL_FAILURE`** (SCREAMING) | **SCREAMING (actor-native)** | **`recommended`/`per-request`/`until-failure`** (kebab) | **YES — CLI parse maps kebab → SCREAMING** |
| `waitUntil` | `load`/`domcontentloaded`/`networkidle` (lowercase, Playwright-native) | same | `--wait-until network-idle` if you want kebab CLI; else `networkidle` | dash-strip only if CLI uses dashes |
| `apifyProxyGroups` | `RESIDENTIAL` … (SCREAMING, foreign) | n/a (proxy object) | n/a (standalone uses `--proxy-urls`) | n/a |
| `resourcePermissions` | `READ`/`WRITE` (SCREAMING, foreign) | n/a | n/a | n/a |

The only field whose actor-native and CLI-native casings genuinely differ is **`proxyRotation`**. Everything else already shares casing across surfaces (lowercase/kebab content values are identical; foreign constants don't appear in the CLI).

---

## Step FIX: Apply Variant A

Use `str_replace` / Edit on existing files. Follow `minimal-diff`.

### A.1 — Zod source: actor-native casing is canonical
In `packages/schema/src/source-of-truth/input.ts`:

```ts
crawlerType: z.enum(['playwright:adaptive', 'playwright:firefox', 'cheerio']).default('playwright:firefox'),
deduplication: z.enum(['none', 'url', 'content-hash']).default('url'),
mode: z.enum(['precision', 'balanced', 'recall']).default('balanced'),
save: z.enum(['txt', 'markdown', 'json', 'html', 'original']).default('markdown'),
saveDestination: z.enum(['dataset', 'key-value-store']).default('dataset'),
proxyRotation: z.enum(['RECOMMENDED', 'PER_REQUEST', 'UNTIL_FAILURE']).default('RECOMMENDED'),  // SCREAMING — actor-native, matches apify/web-scraper
waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle', 'commit']).default('load'),       // lowercase, Playwright-native
```

`proxyRotation` stays SCREAMING here because the actor schema and the library canonical type both use the Apify-native convention. The actor forwards it with zero translation.

### A.2 — CLI: kebab flag values + a parse-boundary translation for proxyRotation
In `apps/standalone/src/cliProgram.ts`, the CLI accepts kebab tokens and maps the ones that differ from canonical:

```ts
const PROXY_ROTATION_CLI_TO_CANONICAL = {
  'recommended':   'RECOMMENDED',
  'per-request':   'PER_REQUEST',
  'until-failure': 'UNTIL_FAILURE',
} as const;

function parseProxyRotation(flag: string): ProxyRotation {
  const v = PROXY_ROTATION_CLI_TO_CANONICAL[flag as keyof typeof PROXY_ROTATION_CLI_TO_CANONICAL];
  if (!v) throw new InvalidArgumentError(`--proxy-rotation must be one of: ${Object.keys(PROXY_ROTATION_CLI_TO_CANONICAL).join(', ')}`);
  return v;
}
```

This map is the deliberate, documented cost of Variant A. It lives in the CLI layer only — NOT in the schema and NOT in the actor. For fields whose CLI and canonical casing already match (everything except `proxyRotation`), the CLI parser only validates; it does not transform.

If the CLI exposes `--wait-until` with dashes (`network-idle`), add the same kind of dash-strip at the CLI boundary; otherwise accept Playwright's flat lowercase (`networkidle`) directly and skip it. Pick one and document it.

### A.3 — Actor: zero translation for proxyRotation
In `apps/apify-actor/src/config.ts`, `proxyRotation` flows straight from the input schema to wherever it's consumed (it's already SCREAMING canonical). Map it to Crawlee `ProxyConfiguration` behavior with an internal switch (Crawlee has no rotation enum):

```ts
switch (input.proxyRotation) {
  case 'PER_REQUEST':   /* omit sessionId */ break;
  case 'UNTIL_FAILURE': /* reuse sessionId until block */ break;
  case 'RECOMMENDED':   /* default behavior */ break;
}
```

### A.4 — Foreign constants verbatim (actor only)
`proxyConfiguration` uses built-in `editor: "proxy"`; `apifyProxyGroups` (`RESIDENTIAL`, …) pass into `Actor.createProxyConfiguration()` unchanged. `resourcePermissions` (`READ`/`WRITE`) stay verbatim. None of these exist in the standalone.

### A.5 — Regenerate + propagate
```bash
pnpm --filter @contextractor/gen-input-schema start
```
- Actor README/SPEC: document `proxyRotation` as `RECOMMENDED | PER_REQUEST | UNTIL_FAILURE`.
- Standalone README/SPEC: document `--proxy-rotation recommended | per-request | until-failure`.
- Add a short note in the standalone docs: "CLI flag values are kebab-case; the equivalent Apify actor input uses the Apify-native SCREAMING_SNAKE form for `proxyRotation`."

---

## Step VERIFY

```bash
# 1. proxyRotation is SCREAMING in the actor schema (Variant A keeps it).
grep -A6 '"proxyRotation"' apps/apify-actor/.actor/input_schema.json | grep -i '"enum"'
# Expected: ["RECOMMENDED", "PER_REQUEST", "UNTIL_FAILURE"]

# 2. The ONLY SCREAMING enum in the Zod source is proxyRotation.
grep -nE "z\.enum\(\[\s*'[A-Z_]+'" packages/schema/src/source-of-truth/input.ts
# Expected: exactly one match (proxyRotation).

# 3. CLI exposes kebab and maps to canonical.
grep -nE "PROXY_ROTATION_CLI_TO_CANONICAL|per-request" apps/standalone/src/cliProgram.ts
# Expected: the CLI→canonical map exists and uses kebab keys.

# 4. The proxyRotation translation lives ONLY in the CLI layer, never in the actor/schema.
grep -rnE "PROXY_ROTATION_CLI_TO_CANONICAL" apps/apify-actor/ packages/schema/
# Expected: no matches.

# 5. Foreign constants verbatim, not declared as contextractor enums.
grep -rnE "RESIDENTIAL|GOOGLE_SERP" packages/schema/src/source-of-truth/input.ts
# Expected: no matches (they belong to the built-in proxy editor, not your enums).

# 6. Zod ↔ generated JSON agree.
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
Fix TypeScript errors until clean. Then verify both surfaces speak their own dialect:

```bash
CLI="apps/standalone/dist/cli.js"
node "$CLI" extract --proxy-rotation per-request --help          # accepted (kebab CLI)
node "$CLI" extract --proxy-rotation PER_REQUEST https://x.com    # clear error (CLI is kebab-only)
# Actor side: input_schema.json shows PER_REQUEST; the actor consumes it without translation.
```

---

## Step REPORT

```
✅ Variant A applied — per-surface native casing.

Actor schema: Apify dual convention — proxyRotation SCREAMING_SNAKE (RECOMMENDED | PER_REQUEST | UNTIL_FAILURE); content/format/engine values lowercase/kebab/colon.
Standalone CLI: all flag values kebab-case, including --proxy-rotation per-request.
Library canonical type: actor-native casing (proxyRotation SCREAMING); CLI translates kebab → canonical at the parse boundary.
CLI→canonical translation maps added (CLI layer only): proxyRotation [+ waitUntil if dashed]
waitUntil approach: <"lowercase Playwright-native, no CLI dashes" | "kebab CLI with dash-strip">
Foreign constants verbatim (actor only): RESIDENTIAL/GOOGLE_SERP/DATACENTER, READ/WRITE
```

This prompt does not commit. Leave branch/commit operations to the caller.
