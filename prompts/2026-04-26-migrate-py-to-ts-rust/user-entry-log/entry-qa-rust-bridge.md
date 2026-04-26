**Q:** How should the TypeScript `contextractor-engine` package call into `rs-trafilatura`?

Options considered:
- Spawn `extract_stdin` CLI as a subprocess
- napi-rs Node bindings (build a thin wrapper crate exposing `rs-trafilatura` as a native Node module)
- WASM build

**A:** napi-rs Node bindings.

**Implication:** The repo gains a Rust crate that wraps `rs-trafilatura` with `napi-rs` macros and produces a `.node` native module. The TS engine consumes that native module. Per-platform prebuilds (darwin-arm64, darwin-x64, linux-x64, linux-arm64) must be produced by CI; the Apify Dockerfile uses the linux build matching its base image arch. There is no `extract_stdin` subprocess in the TS engine.
