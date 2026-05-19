# Apify Production Protection

## Never Push to Production

Never push or deploy to `glueo/contextractor` (production) unless the user explicitly requests it. Default to `glueo/contextractor-test` for all deploys.

- `.claude/settings.json` denies `apify push glueo/contextractor` and `apify call glueo/contextractor`
- Use `/platform:deploy-and-test --production` only when explicitly asked

The v1 migration accidentally pushed to production because `name` was left as `contextractor` instead of `contextractor-test`.

## Never use `apify push` directly

`apify push` does NOT work for this monorepo. The Dockerfile uses `dockerContextDir: "../../.."`, which requires the full workspace root as the Docker build context. `apify push` only zips the actor directory, so the build always fails with "Actor context path is outside of Actor root directory".

**Always use `/platform:deploy-and-test` for all Apify platform deploys.** It triggers Apify Console's Git-connected build by pushing to the watched branch (`dev` for test, `main` for production), which correctly provides the full monorepo context to the Dockerfile.

## Permissions

Allowed without prompt:

- read input from the key-value store
- push data to the dataset
- set values in the key-value store
- enqueue requests to the request queue
- run locally with `apify run`, `cargo`, `pnpm`

Ask first:

- `cargo add` or any `Cargo.toml` dependency change
- `pnpm install` or any `package.json` dependency change
- proxy configuration changes (requires paid plan)
- `Dockerfile` changes affecting builds
- deleting datasets or key-value stores
