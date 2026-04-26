**Q:** How should the per-platform napi-rs `.node` prebuilds reach the Apify Git-connected build (where there is no Rust toolchain)?

Options considered:

- Workspace packages with committed `.node` files (no external publishing)
- npm publish per-platform packages (standard napi-rs pattern, external dist)
- GitHub Releases artifact store (postinstall fetch)

**A:** Workspace packages, committed `.node`. Platform-prebuild **only the napi-rs wrapper around `rs-trafilatura`**, not the whole TS engine.

**Implication:**

- `packages/contextractor-engine/native/npm/<platform>/` directories are workspace packages, each containing one platform-specific `.node` binary plus a thin `package.json` with `os` + `cpu` fields.
- The platform packages are NOT published externally (no npm registry, no GitHub Releases). They are workspace deps only.
- Main package `packages/contextractor-engine/native/package.json` lists each `@contextractor/engine-native-<platform>` in `optionalDependencies` with `"workspace:*"`. pnpm picks the matching prebuild via `os` + `cpu` resolution at install time.
- The `.node` files for `darwin-arm64`, `darwin-x64`, `linux-x64-gnu`, `linux-arm64-gnu` are committed to git. CI rebuilds them on tag and commits the refresh.
- The TypeScript engine source under `packages/contextractor-engine/src/` is platform-independent and built fresh by `tsc` during every Apify build. Only the `.node` is platform-specific.
- The Apify Dockerfile uses `pnpm --filter @contextractor/apify deploy --prod /deploy` — pnpm deploy resolves the workspace prebuild for the image's arch and produces a self-contained `node_modules` with no symlinks.
- `apps/contextractor-apify/vendor/` is removed entirely; the actor's `package.json` declares `"@contextractor/engine": "workspace:*"` again.
