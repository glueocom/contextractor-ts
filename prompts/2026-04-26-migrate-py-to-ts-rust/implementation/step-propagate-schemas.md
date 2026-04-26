# Step PROPAGATE_SCHEMAS: Propagate `.actor/` schemas

## TLDR

Replace target `apps/contextractor-apify/.actor/{actor.json,input_schema.json,output_schema.json,dataset_schema.json}` with the source versions, with three modifications: drop the XML and XML-TEI toggles, drop the PyPI mention from `actor.json` description, and align defaults with the source repo unless the target has a deliberate divergence.

## Skills and agents

- `apify-schemas` — primary.
- `apify-actor-development` — actor.json conventions.

## Inputs

- Source: `/Users/miroslavsekera/r/contextractor/apps/contextractor-apify/.actor/`.
- Format decision: `../user-entry-log/entry-qa-format-gap.md`.
- Owner decision: `../user-entry-log/entry-qa-apify-owner.md`.

## Step COPY: Copy source schemas

Copy each source file over the target file. After copying:

- `actor.json`:
  - Set `meta.templateId` to `rust-cli-wrapper` (existing target value).
  - Set `meta.generatedBy` to a Claude Code attribution per the existing target convention.
  - Description: drop the clause "Also available as PyPI ... and npm packages." Keep "Crawls websites and extracts text content using trafilatura."
- `input_schema.json`:
  - Delete the `saveExtractedXmlToKeyValueStore` property.
  - Delete the `saveExtractedXmlTeiToKeyValueStore` property.
  - Delete `userAgent` only if `step-port-apify-app.md` does not implement it; otherwise keep it.
  - Audit defaults that the existing target deliberately diverges on (`waitUntil` default `LOAD` vs `NETWORKIDLE`, `closeCookieModals` default). Use the source defaults unless the binary's defaults disagree — in that case the binary is canonical, fix the schema to match the binary.
- `output_schema.json` and `dataset_schema.json` — copy verbatim.

## Step VERIFY: Cross-check

Before declaring done:

- `jq -e '.properties | has("saveExtractedXmlToKeyValueStore") | not' apps/contextractor-apify/.actor/input_schema.json`.
- `jq -e '.properties | has("saveExtractedXmlTeiToKeyValueStore") | not' apps/contextractor-apify/.actor/input_schema.json`.
- `grep -i pypi apps/contextractor-apify/.actor/actor.json` returns no match.

This step does **not** run the `/sync:gui` consistency check — that runs in `step-run-sync-commands.md` after the engine and the binary are also in place.
