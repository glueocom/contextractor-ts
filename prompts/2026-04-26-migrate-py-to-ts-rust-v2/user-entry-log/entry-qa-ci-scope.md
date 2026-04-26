**Q:** What is the CI scope for this migration prompt?

Options considered:

- Napi prebuilds only — `.github/workflows/build-napi.yml` matrix that emits committed `.node` artifacts.
- Napi prebuilds + lint/test workflow — also add `ci.yml` running `pnpm -r build / test`, `cargo test`, `biome check`.
- Defer all CI — single-platform local prebuild only; in-image Rust build for Apify (violates "stop building Rust inside the image").

**A:** Napi prebuilds only.

**Implication:**

- This prompt creates `.github/workflows/build-napi.yml` with a matrix covering `darwin-arm64`, `darwin-x64`, `linux-x64-gnu`, `linux-arm64-gnu`. Pattern follows `napi-rs/package-template-pnpm`.
- The workflow runs on tag pushes (and manual dispatch). It builds `.node` artifacts and commits them back into `packages/contextractor-engine/native/npm/<platform>/`.
- No other workflows are added in this prompt. Lint, test, and security workflows are out of scope for the migration and may be added separately later.
- The Apify Git-connected build does not trigger this workflow — the workflow is purely prebuild-population. Apify deploys assume the prebuilds are already committed.
- Local dev still works without CI: `pnpm -F @contextractor/engine-native build` produces the host platform's `.node` for development. Cross-platform prebuilds are only required before deploy.
