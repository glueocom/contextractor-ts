---
allowed-tools: Read, Glob, Bash(cargo:*), Bash(apify:*), Bash(npx:*), Bash(pnpm:*)
description: Validate Actor schemas and configuration
---

Validate all Actor configuration and run static checks across the workspace.

## Validation Steps

- Check `apps/contextractor-apify/.actor/actor.json` exists and is valid JSON
- Check `apps/contextractor-apify/.actor/input_schema.json` has required fields
- Check `apps/contextractor-apify/.actor/output_schema.json` if present
- Check `apps/contextractor-apify/.actor/dataset_schema.json` if present
- Verify `meta.generatedBy` is set in `actor.json`
- Verify `actor.json.name` matches the deploy target (`contextractor-test` for test, `contextractor` for production)
- Verify `actor.json.dockerContextDir` is `"../../.."`
- Verify `actor.json.description` mentions "built on rs-trafilatura and Crawlee"
- Verify `apps/contextractor-apify/package.json` declares `"@contextractor/engine": "workspace:*"` (no `vendor/` directory)
- Run `pnpm -r build`
- Run `pnpm -r lint` (Biome workspace-wide)
- Run `pnpm -r test`
- Run `cargo check --workspace --all-targets`
- Run `cargo fmt --all -- --check`
- Run `cargo clippy --workspace --all-targets -- -D warnings`

## Required Fields

### actor.json

- `actorSpecification`: 1
- `name`: lowercase with hyphens
- `title`: human-readable title
- `version`: semver format
- `meta.templateId` and `meta.generatedBy` set

### input_schema.json

- `title`
- `type`: `"object"`
- `schemaVersion`: 1
- `properties`

## Report

List any validation errors or warnings found, grouped by file with `path:line` references.
