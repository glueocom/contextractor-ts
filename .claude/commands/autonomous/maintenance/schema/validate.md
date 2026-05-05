---
allowed-tools: Read, Glob, Bash(cargo:*), Bash(apify:*), Bash(npx:*), Bash(npm:*), Bash(pnpm:*)
description: Validate Actor schemas and configuration
model: haiku
---

Validate all Actor configuration and run static checks across the workspace. Save a report to `autonomous-task-output/{agent}/`.

## Validation Steps

- Check `apps/apify-actor/.actor/actor.json` exists and is valid JSON
- Check `apps/apify-actor/.actor/input_schema.json` has required fields
- Check `apps/apify-actor/.actor/output_schema.json` if present
- Check `apps/apify-actor/.actor/dataset_schema.json` if present
- Verify `meta.generatedBy` is set in `actor.json`
- Verify `actor.json.name` matches the deploy target (`contextractor-test` for test, `contextractor` for production)
- Verify `actor.json.dockerContextDir` is `"../../.."`
- Verify `actor.json.description` mentions "built on rs-trafilatura and Crawlee"
- Verify `apps/apify-actor/package.json` declares `"@contextractor/crawler": "workspace:*"` (no `vendor/` directory)
- Run `pnpm build`
- Run `pnpm lint` (Biome workspace-wide)
- Run `pnpm test`
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

## Step REPORT: Save Report

Save `autonomous-task-output/{agent}/reports/schema-validate-report.md` with:
- Validation errors or warnings found, grouped by file with `path:line` references
- Build and test results
- Any issues requiring human review (save to `autonomous-task-output/{agent}/prompts/schema-validate-prompt.md`)
