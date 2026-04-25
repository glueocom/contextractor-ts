# Step 01 — mcpc Prereqs and Tool-Name Verification

## TLDR

Confirm `@apify/mcpc` is installed at a version that supports the `@apify` session form, authenticate once, and capture the live remote tool list so later steps reference real tool names. Touches no files in `.claude/` — produces a transcript of verified tool names that step-02 will rely on.

## Skills

- `apify-ops` for high-level guidance only

## Inputs

- See `../migrate-to-mcpc-notes/mcpc-capability.md` for version + auth model.

## Actions

1. Check installed mcpc version. The local install is at v0.1.11 (per research note). Upgrade if below v0.2.6:

   ```
   mcpc --version
   npm install -g @apify/mcpc@latest
   ```

2. Authenticate once. OAuth stores creds in OS keychain:

   ```
   mcpc login mcp.apify.com
   mcpc connect mcp.apify.com @apify
   ```

   If `APIFY_TOKEN` is set and OAuth is undesirable in this environment, fall back to header form and document it inline in the same step. Do not commit any token.

3. Capture the canonical remote tool list. Save the output verbatim to `../migrate-to-mcpc-notes/live-tools-list.md`:

   ```
   mcpc --json @apify tools-list | jq -r '.tools[].name' | sort
   ```

4. For each Old → New row in `../migrate-to-mcpc-notes/mcpc-tool-equivalents.md` whose New cell starts with `mcpc ... tools-call <NAME>`, confirm `<NAME>` appears in the live list. If a name is missing or renamed, update the equivalents table and add a one-line note in `../migrate-to-mcpc-notes/live-tools-list.md`.

5. Specifically verify these names — they are the ones the rest of the migration depends on, and the legacy reference table guesses on the build-related ones:

   - `search-actors`, `fetch-actor-details`, `add-actor`, `call-actor`
   - `get-actor-run`, `get-actor-run-list`, `get-actor-log`
   - `get-dataset`, `get-dataset-items`, `get-dataset-list`, `get-dataset-schema`, `get-actor-output`
   - `get-key-value-store`, `get-key-value-store-keys`, `get-key-value-store-record`, `get-key-value-store-list`
   - `search-apify-docs`, `fetch-apify-docs`
   - any `*build*` tool — name not previously documented in `apify-ops`

   For any build-related tool not exposed by `mcp.apify.com`, mark in the inventory note that build management stays on `apify builds *` CLI and update step-02 accordingly.

## Done when

- `mcpc --version` reports ≥ v0.2.6
- `mcpc @apify tools-list` succeeds non-interactively
- `live-tools-list.md` exists and the equivalents table has been reconciled against it
