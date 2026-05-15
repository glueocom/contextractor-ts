# Deferred TypeScript Type Safety Issues

These issues were identified during the autonomous review but require human judgement or
involve public API changes — they were not auto-fixed.

---

## `apps/standalone/src/cliProgram.ts`

### ✅ RESOLVED — `toCsv` function casts on `unknown[]`

Parameter tightened to `Record<string, unknown>[]`; destructuring guard added to satisfy
`noUncheckedIndexedAccess`; both internal casts removed. Fixed in commit d81a403.

### ✅ RESOLVED — `trafilaturaConfig` deep-merge casts

`fromFile` annotated as `Partial<ContextractorInputType>` to fix ternary type widening (`{}`
was broadening the inferred type). All five `as Record<string, unknown>` / `as object` casts
removed; direct property access used throughout. Fixed in commit d81a403.

---

## `apps/apify-actor/src/run.ts` — Line 43 — INTENTIONAL, WON'T FIX

```ts
await Actor.createProxyConfiguration(input.proxyConfiguration as ProxyConfigurationOptions)
```

The Zod schema field uses `z.record(z.string(), z.unknown())` intentionally — this is required
to emit `"type": "object"` in the generated Apify input schema (validated by the meta-schema
test). Changing to `z.unknown()` or `z.custom<ProxyConfigurationOptions>()` breaks the Apify
meta-schema validation. Adding `apify` as a type dep to `@contextractor/schema` would leak
actor-specific types to the standalone CLI consumers.

The cast is a legitimate boundary assertion: the value originates from Apify's own proxy editor
which guarantees the shape. No further action.

---

## ✅ RESOLVED — `examples/` — Boundary casts on dataset items

```ts
const record = item as Record<string, unknown>;  // removed — item was already this type
```

The outer no-op cast (`item as Record<string, unknown>`) was removed in both
`examples/library-ts/src/main.ts` and `examples/apify-api-ts/src/main.ts` — `item` from
Crawlee's `Dataset.forEach` and from `apify-client` `listItems()` is already
`Record<string, unknown>`. The inner `crawl` narrowing cast remains as a legitimate boundary
assertion (Crawlee metadata not covered by our schema). Fixed in commit d81a403.
