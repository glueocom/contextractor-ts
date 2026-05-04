# opencode Sync Report — 2026-05-03

## Agents Synced

- code-reviewer.md
- prompt-formatter.md
- prompt-modifier.md
- prompt-writer.md
- rust-pro.md
- test-runner.md
- ts-pro.md
- web-research-specialist.md

## Commands Synced

- autonomous-maintenance-deps-update.md
- autonomous-maintenance-docs-gen-md-regions.md
- autonomous-maintenance-schema-gen-input-schema.md
- autonomous-maintenance-schema-validate.md
- autonomous-maintenance-sync-docs.md
- autonomous-maintenance-sync-gui.md
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
- meta-write-prompt.md
- platform-deploy-and-test.md
- run.md
- scaffold-rust-scaffold.md

## Rules Synced

- apify-production.md
- formatting-guidelines.md
- json-config-only.md
- minimal-diff.md
- no-confirmation-prompts.md
- prompt-engineering-knowledge.md
- security.md
- testing.md

## opencode.json Audit

### MCP Servers

`.mcp.json` defines one server: `apify` (`type: "http"`, `url: "https://mcp.apify.com"`).

`opencode.json["mcp"]` has `apify` with `type: "remote"` and matching URL. No entry is missing or stale. `type: "remote"` is opencode's format for HTTP-based MCP servers — no change needed.

### Instructions

`opencode.json["instructions"]` lists exactly the 8 `.md` files present in `.opencode/rules/`. All entries match; no additions or removals required.

### Changes Made

None — opencode.json was already consistent with `.mcp.json` and the synced rules.

## Errors

None.
