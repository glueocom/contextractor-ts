# Apify Production Protection

## Never Push to Production

Never push or deploy to `glueo/contextractor` (production) unless the user explicitly requests it. Default to `glueo/contextractor-test` for all deploys.

- `.actor/actor.json` `name` MUST be `contextractor-test` for test deploys — `apify push` targets whatever name is set there
- `.claude/settings.json` denies `apify push glueo/contextractor` and `apify call glueo/contextractor`
- Use `/platform:push-and-get-working --production` only when explicitly asked

The v1 migration accidentally pushed to production because `name` was left as `contextractor` instead of `contextractor-test`.

## Permissions

Allowed without prompt:

- read input from the key-value store
- push data to the dataset
- set values in the key-value store
- enqueue requests to the request queue
- run locally with `apify run`, `cargo`, `npm`

Ask first:

- `cargo add` or any `Cargo.toml` dependency change
- `npm install` or any `package.json` dependency change
- `apify push` (deployment to cloud)
- proxy configuration changes (requires paid plan)
- `Dockerfile` changes affecting builds
- deleting datasets or key-value stores
