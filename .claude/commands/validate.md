---
allowed-tools: Read, Glob, Bash(npm:*)
description: Validate Actor schemas and configuration
---

Validate all Actor configuration files.

## Validation Steps

1. Check `.actor/actor.json` exists and is valid JSON
2. Check `.actor/input_schema.json` has required fields
3. Check `.actor/output_schema.json` if present
4. Verify `usesStandbyMode` setting
5. Run TypeScript compilation: `npm run build` (includes Biome fix)
6. Run linting: `npm run lint` (Biome check)

## Required Fields

### actor.json
- `actorSpecification`: 1
- `name`: lowercase with hyphens
- `title`: Human-readable title
- `version`: Semver format

### input_schema.json
- `title`
- `type`: "object"
- `schemaVersion`: 1
- `properties`

## Report

List any validation errors or warnings found.
