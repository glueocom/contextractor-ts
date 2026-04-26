**Q:** The entry prompt names `pruneXpath` and `dateExtractionParams` as no-op TS engine config fields to drop. The "lessons learned" section also notes that rs-trafilatura 0.2.x has no `prune_xpath`, no `tei_validation`, and no `with_metadata` flag (metadata is always extracted). Should `teiValidation` and `withMetadata` also be dropped from the TS interface?

**A:** Drop only `pruneXpath` and `dateExtractionParams`. (Resolved by existing `.claude/commands/sync/gui.md` which explicitly enumerates these two and only these two as "no-op fields … dropped (no rs-trafilatura 0.2.x backing)").

**Implication:**

- Remove `pruneXpath` and `dateExtractionParams` from:
  - `packages/contextractor-engine/src/index.ts` (`TrafilaturaConfig` interface and `DEFAULT_CONFIG`).
  - `packages/contextractor-engine/native/src/lib.rs` (`#[napi(object)]` field, if present).
  - `apps/contextractor-apify/.actor/input_schema.json` (the `trafilaturaConfig` description currently lists both — strip them).
  - `apps/contextractor-standalone/src/cli.ts` (any flag mapping to them).
- `teiValidation` and `withMetadata` stay in the TS surface even though rs-trafilatura ignores them — they are forward-compatible placeholders that match the Python config and keep the cross-runtime config shape stable.
- `/sync/gui` enforces this in Step VERIFY ("No-op fields"); regressions surface there.
