# docs:gen-md-regions Report

**Date**: 2026-05-03

## Results

- **Files updated**: 0 (all regions already up to date)
- **Regions regenerated**: none (no drift detected)
- **Drift check**: passed (`git diff` clean after re-run)
- **Errors**: none

## Notes

`pnpm docs:update` ran successfully via `tools/gen-md-regions`, scanned all `.md` files (skipping `node_modules/`, `dist/`, `target/`, `prompts/`), and found no `@generated` regions requiring rewrite. `pnpm docs:check` confirmed zero diff.
