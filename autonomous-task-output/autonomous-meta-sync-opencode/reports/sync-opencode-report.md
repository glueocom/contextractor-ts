# opencode Sync Report

**Date:** 2026-05-12

## Agents synced (8)

- code-reviewer.md
- prompt-formatter.md
- prompt-modifier.md
- prompt-writer.md
- rust-pro.md
- test-runner.md
- ts-pro.md
- web-research-specialist.md

## Commands synced (37)

- autonomous-maintenance-deps-update.md
- autonomous-maintenance-docs-gen-md-regions.md
- autonomous-maintenance-schema-gen-input-schema.md
- autonomous-maintenance-schema-validate.md
- autonomous-maintenance-sync-docs.md
- autonomous-maintenance-sync-gui.md
- autonomous-maintenance-sync-spec.md
- autonomous-maintenance-test-apify-platform.md
- autonomous-maintenance-test-dead-code-autofix.md
- autonomous-maintenance-test-deps-autofix.md
- autonomous-maintenance-test-local.md
- autonomous-maintenance-test-spelling-autofix.md
- autonomous-maintenance-test-typescript-autofix.md
- autonomous-maintenance-all-shell-smoke.md
- autonomous-maintenance-all-shell.md
- autonomous-maintenance-all.md
- autonomous-meta-setup.md
- autonomous-meta-sync-opencode.md
- docs-update-docs-version.md
- git-add-worktree.md
- git-commit.md
- git-release.md
- git-squash-merge-to-dev.md
- meta-delete-prompt.md
- meta-fix-prompt.md
- meta-setup.md
- meta-store-prompt.md
- meta-write-prompt-file.md
- meta-write-prompt.md
- platform-deploy-and-test.md
- run.md
- scaffold-rust-scaffold.md
- sync-spec.md

## Rules synced (11)

- apify-production.md
- formatting-guidelines.md
- json-config-only.md
- minimal-diff.md
- native-addon-boundary.md
- no-confirmation-prompts.md
- prompt-engineering-knowledge.md
- security.md
- spec-maintenance.md
- test-maintenance.md
- testing.md

## opencode.json audit

### MCP servers

- **apify**: present in both `.mcp.json` and `opencode.json["mcp"]` with matching key and URL (`https://mcp.apify.com`). Type differs intentionally: `.mcp.json` uses `"http"` (Claude Code convention), `opencode.json` uses `"remote"` (opencode convention). No change needed.

### Instructions

**Missing entries found and added:**
- `.opencode/rules/native-addon-boundary.md`
- `.opencode/rules/spec-maintenance.md`
- `.opencode/rules/test-maintenance.md`

`opencode.json["instructions"]` now lists all 11 rules present in `.opencode/rules/`.

## Errors

None.
