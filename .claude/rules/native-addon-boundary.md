# Native Addon Boundary

The napi-rs wrapper at `packages/extraction/native/src/lib.rs` follows `rs-trafilatura` naming conventions exactly — its types, string values, and enum variants mirror the upstream Rust crate. Do not rename them to match our TypeScript conventions.

## Rule

- Do not modify `lib.rs` to align with TypeScript naming.
- If a naming divergence ever arises between the upstream crate and our API, the translation belongs in `packages/extraction/src/index.ts` — immediately after the native call returns and in reverse before passing values down.
- This keeps the wrapper a thin, stable shim over `rs-trafilatura` and makes upstream upgrades straightforward.

## Example

`rs-trafilatura` uses `"txt"` as a format identifier. Our TypeScript API also uses `"txt"` — no translation is needed. This alignment is intentional: `txt` is the canonical plain-text format name across all layers.

Do not rename `txt` to `text` in TypeScript, CLI flags, or config to "clarify" it. The word "text" may appear only in human-readable titles and descriptions (e.g. `enumTitles`, help text prose), never as a format value in code.
