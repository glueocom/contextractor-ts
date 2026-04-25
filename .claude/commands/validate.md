---
allowed-tools: Read, Glob, Bash(cargo:*), Bash(apify:*), Bash(npx:*), Bash(pnpm:*)
description: Validate Actor schemas and configuration
---

Validate all Actor configuration and run static checks across the workspace.

## Validation Steps

1. Check `apps/contextractor/.actor/actor.json` exists and is valid JSON
2. Check `apps/contextractor/.actor/input_schema.json` has required fields
3. Check `apps/contextractor/.actor/output_schema.json` if present
4. Check `apps/contextractor/.actor/dataset_schema.json` if present
5. Verify `meta.generatedBy` is set in `actor.json`
6. Run `cargo check --workspace --all-targets`
7. Run `cargo fmt --all -- --check`
8. Run `cargo clippy --workspace --all-targets -- -D warnings`
9. If `tools/platform-test-runner/package.json` exists, run `pnpm --filter platform-test-runner exec biome check`

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
