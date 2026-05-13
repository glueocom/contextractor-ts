# Deferred TypeScript Type Safety Issues

These issues were identified during the autonomous review but require human judgement or
involve public API changes — they were not auto-fixed.

---

## `apps/standalone/src/cliProgram.ts`

### Lines 107–115: `toCsv` function casts on `unknown[]`

```ts
function toCsv(items: unknown[]): string {
  const keys = Object.keys(items[0] as Record<string, unknown>);
  // ...
  const rows = (items as Record<string, unknown>[]).map((item) => ...
```

The parameter type is `unknown[]`, so `items[0]` is `unknown` and `Object.keys` won't accept it
without a cast. Options:

- Tighten the parameter type to `Record<string, unknown>[]` — only valid if all call sites pass
  typed records.
- Add a runtime guard: `if (typeof items[0] !== 'object' || items[0] === null) return '';` then
  remove the casts.

### Lines 327–334: `trafilaturaConfig` deep-merge casts

```ts
const fileTrafilatura = (fromFile as Record<string, unknown>).trafilaturaConfig ?? {};
const cliTrafilatura = (fromCli as Record<string, unknown>).trafilaturaConfig ?? {};
if (Object.keys(fileTrafilatura as object).length || ...) {
  layered.trafilaturaConfig = { ...(fileTrafilatura as object), ...(cliTrafilatura as object) };
}
```

`fromFile` is `Partial<ContextractorInputType>`, so `fromFile.trafilaturaConfig` is already typed
as `TrafilaturaConfig | undefined`. The `as Record<string, unknown>` casts are unnecessary —
`fromFile.trafilaturaConfig` can be accessed directly. The `as object` casts on spread and
`Object.keys` are also redundant since `TrafilaturaConfig` is already an object type.

Fix: replace with `fromFile.trafilaturaConfig ?? {}` and `fromCli.trafilaturaConfig ?? {}`.
Requires checking `buildSchemaOverrides` return type to confirm `fromCli` is also
`Partial<ContextractorInputType>` or compatible.

---

## `apps/apify-actor/src/run.ts` — Line 43

```ts
await Actor.createProxyConfiguration(input.proxyConfiguration as ProxyConfigurationOptions)
```

The `input.proxyConfiguration` is typed by our Zod schema as `z.infer<typeof proxyConfigSchema>`.
The cast to `ProxyConfigurationOptions` (Apify SDK) suggests the two types are not structurally
compatible. Options:

- Add a runtime adapter/mapper between the Zod type and `ProxyConfigurationOptions`.
- Align the Zod schema definition exactly with `ProxyConfigurationOptions` so the cast is not
  needed.

This is an API design decision — review whether the Zod schema intentionally diverges from the
Apify SDK type.

---

## `examples/` — Boundary casts on dataset items

```ts
const record = item as Record<string, unknown>;
const crawl = record.crawl as { depth: number; referrerUrl: string | null } | undefined;
```

The Apify client returns dataset items typed loosely. These casts are appropriate at the API
boundary. Long-term option: define a typed `DatasetItem` interface in `@contextractor/schema` and
export it so examples and consumers can use it without inline casts.
