# Step prebuild-platforms-and-ci

## TLDR

Build cross-platform `.node` files for `darwin-arm64`, `darwin-x64`, `linux-x64-gnu`, `linux-arm64-gnu`. Commit each under `packages/contextractor-engine/native/npm/<platform>/` as a workspace package with `os` + `cpu` selectors. Wire them into the parent's `optionalDependencies`. Add `.github/workflows/build-napi.yml` to refresh the prebuilds on tag.

## Skills and Agents

- Skills: `rust-packaging`, `apify-ops`.
- Agents: `rust-pro` (matrix workflow + cross-compilation), `code-reviewer`.

## Reference reading

- `../user-entry-log/entry-qa-prebuild-distribution.md` (workspace packages with committed binaries; no external publishing; **prebuild only the napi-rs wrapper, not the whole TS engine**).
- `../user-entry-log/entry-qa-ci-scope.md` (only `build-napi.yml`; no other workflows).
- `../migrate-py-to-ts-rust-v2-notes/napi-rs-monorepo-prebuilds.md` (layout, loader, ignores).
- Templates: `napi-rs/package-template-pnpm` and `napi.rs/docs/deep-dive/release` for the GitHub Actions matrix.

## Actions

### Layout `npm/<platform>/`

For each platform in `{darwin-arm64, darwin-x64, linux-x64-gnu, linux-arm64-gnu}`:

- Create `packages/contextractor-engine/native/npm/<platform>/package.json`:
  - `"name": "@contextractor/engine-native-<platform>"`.
  - `"version"` matches the parent's version.
  - `"main": "contextractor-engine-native.<platform>.node"`.
  - `"files": ["contextractor-engine-native.<platform>.node"]`.
  - `"os"` and `"cpu"` fields aligned with the platform (e.g. `darwin-arm64` → `"os": ["darwin"], "cpu": ["arm64"]`; `linux-x64-gnu` → `"os": ["linux"], "cpu": ["x64"], "libc": ["glibc"]`).
  - `"private": true` (workspace member, not published).
- Place the matching `.node` file alongside the `package.json`.

### Cross-compilation

- Local: `pnpm -F @contextractor/engine-native build --target aarch64-apple-darwin` and the matching `x86_64-apple-darwin`. Use Apple's universal toolchain — both targets compile on a `darwin-arm64` host without extra setup.
- Linux targets cross-compile via `cargo-zigbuild` (recommended by napi-rs) or via Docker images (`ghcr.io/napi-rs/napi-rs/nodejs-rust:lts-debian-aarch64`). Document the chosen path in the workflow.
- Each successful build leaves `contextractor-engine-native.<platform>.node` next to the per-platform `package.json`.

### Wire `optionalDependencies`

- In `packages/contextractor-engine/native/package.json`, set:

  ```jsonc
  "optionalDependencies": {
    "@contextractor/engine-native-darwin-arm64": "workspace:*",
    "@contextractor/engine-native-darwin-x64":   "workspace:*",
    "@contextractor/engine-native-linux-x64-gnu":   "workspace:*",
    "@contextractor/engine-native-linux-arm64-gnu": "workspace:*"
  }
  ```

- The generated `index.js` loader (committed in `step-build-napi-binding`) already dispatches to the matching package via `os` + `cpu`. Verify that it does and patch the loader if not.

### `.github/workflows/build-napi.yml`

- Trigger on `push: tags: ["v*"]` and `workflow_dispatch`.
- One job per platform target. Use `actions/setup-node@v4` with Node 22 plus `actions-rust-lang/setup-rust-toolchain@v1` and `pnpm/action-setup@v4`.
- For each job: `pnpm install --frozen-lockfile`; `pnpm -F @contextractor/engine-native build --target <triple>`; upload the `.node` artifact.
- Final aggregation job: download all artifacts; commit them back to `packages/contextractor-engine/native/npm/<platform>/` on a release branch and open a PR (or push directly to a release branch — pick one; document in the workflow file).
- The workflow does not run tests, lint, or any other check — those land in a separate workflow that is **out of scope** for this prompt.

### `pnpm install` sanity

- After committing the prebuilds, `pnpm install` should keep `pnpm-lock.yaml` minimal (no extra entries beyond the workspace links).

## Constraints

- Prebuild **only** the napi-rs `.node` (the rs-trafilatura wrapper). The TS engine source under `packages/contextractor-engine/src/` is platform-independent and built fresh by `tsc` on every install/deploy.
- Do not publish any of the per-platform packages externally. Mark each as `"private": true` and rely on `workspace:*` resolution.
- Commit the `.node` binaries — Apify's Git-connected build needs them to resolve without a Rust toolchain in the image.

## Done when

- `packages/contextractor-engine/native/npm/{darwin-arm64,darwin-x64,linux-x64-gnu,linux-arm64-gnu}/{package.json,*.node}` all exist and are tracked.
- `packages/contextractor-engine/native/package.json` `optionalDependencies` lists all four `workspace:*` entries.
- `pnpm install` succeeds; `pnpm-lock.yaml` updates only with workspace links (no external optional deps).
- `node -e "require('@contextractor/engine-native')"` succeeds on the host (resolves to the matching prebuild via the loader).
- `.github/workflows/build-napi.yml` exists, lints cleanly with `actionlint` (or equivalent), and triggers on `v*` tags.
- The matching `../tests/step-test-prebuild-platforms-and-ci.md` passes.
