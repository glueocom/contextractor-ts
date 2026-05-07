# Native Addon Boundary

The napi-rs wrapper at `packages/extraction/native/src/lib.rs` follows `rs-trafilatura` naming conventions exactly — its types, string values, and enum variants mirror the upstream Rust crate. Do not rename them to match our TypeScript conventions.

## Rule

- Do not modify `lib.rs` to align with TypeScript naming.
- Translation between upstream naming and our naming belongs in `packages/extraction/src/index.ts`, immediately after the native call returns (and in reverse before passing values down to the native call).
- This keeps the wrapper a thin, stable shim over `rs-trafilatura` and makes upstream upgrades straightforward.

## Example

`rs-trafilatura` uses `"txt"` as a format identifier. Our TypeScript API uses `"text"`. The translation happens in `packages/extraction/src/index.ts`:

- Map `"txt"` → `"text"` on results coming out of the native call.
- Map `"text"` → `"txt"` on format values passed into the native call.

The Rust wrapper itself is not touched.
