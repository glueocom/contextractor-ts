# Test — update-claude-config

## TLDR

Review the diff from `implementation/step-update-claude-config.md`. Verify `CLAUDE.md` and `.claude/commands/{sync,platform,git}/` files reflect the TS-app + napi-rs-only reality and use `glueo/` actors. Auto-fix any deviation.

## Inputs

- `../implementation/step-update-claude-config.md`
- `../user-entry-log/entry-qa-test-actor.md`
- `../migrate-py-to-ts-rust-notes/target-state-snapshot.md`

## Review

- `CLAUDE.md`:
  - No "Rust binary" claim about the actor.
  - Project Structure shows TS apps + TS engine + `native/` napi-rs crate.
  - All `glueo/contextractor[-test]` replaced by `glueo/contextractor[-test]`.
  - Commands block lists both `cargo` (for napi-rs) and `pnpm`/`biome` invocations.
- `.claude/commands/sync/{docs.md, gui.md}` source-of-truth lists name TS files for the engine config and CLI; the napi-rs crate follows the TS interface, not the other way around.
- `.claude/commands/platform/push-and-get-working.md`: targets `glueo/contextractor-test`; no Rust binary build steps.
- `.claude/commands/git/release.md`: bumps `package.json` versions across TS packages and the single `Cargo.toml` in `packages/contextractor-engine/native/`. No Python/PyPI/Cargo workspace-of-many references.
- `.claude/rules/` untouched.

## Verify

- `grep -rn 'glueo/contextractor' CLAUDE.md .claude/commands/` returns nothing.
- `grep -rn 'Rust binary Apify' CLAUDE.md .claude/commands/` returns nothing.
- `git diff --stat .claude/rules/` reports zero lines.

## Auto-fix

Use minimal `Edit` calls — never `Write` — on any file in `.claude/`. If a regression in `.claude/rules/` appears, revert it.
