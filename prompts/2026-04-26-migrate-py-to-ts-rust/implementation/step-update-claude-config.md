# Step update-claude-config

## TLDR

Update `CLAUDE.md`, `.claude/commands/sync/{docs.md, gui.md}`, `.claude/commands/platform/push-and-get-working.md`, `.claude/commands/git/release.md` so they describe the new "TS app + napi-rs Rust extractor" reality and use `glueo/contextractor[-test]`.

## Skills and agents

- Agent: `prompt-modifier` for `.claude/` files (per `prompt-engineering-knowledge` rule); `code-reviewer` to verify minimal diffs.

## Inputs

- Read `../migrate-py-to-ts-rust-notes/target-state-snapshot.md` (CLAUDE.md drift section).
- Read `../user-entry-log/entry-qa-test-actor.md` (`glueo/*` decision).

## Actions

- `CLAUDE.md`:
  - Replace the "Dual-language (Rust binary + TypeScript tooling)" line with: "TypeScript Apify Actor + standalone CLI; extraction via [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura) called from a `napi-rs` Node binding inside `packages/contextractor-engine/native/`."
  - Replace the Project Structure block with the new layout (TS apps, TS engine, `native/` napi-rs crate, TS `tools/`).
  - Replace `glueo/contextractor[-test]` with `glueo/contextractor[-test]` everywhere.
  - Update the Commands block: keep `cargo` commands for the napi-rs crate (`cargo build`, `cargo test`, `cargo clippy`); add `pnpm -r build`, `pnpm -r test`, `pnpm -r lint` (Biome); drop any "Rust binary CLI" wording.
  - Update Active Skills list: keep Rust skills (still relevant for napi-rs); the prompt does not introduce new TS-specific skills, so no addition required.
  - Testing block: replace Rust-only testing wording with "TS tests with vitest under each package; the napi-rs crate has a small `cargo test` smoke."
- `.claude/commands/sync/docs.md` and `.claude/commands/sync/gui.md`:
  - Replace "Rust binary CLI" source-of-truth with "TypeScript CLI in `apps/contextractor-standalone/src/cli.ts`" and "TypeScript engine config in `packages/contextractor-engine/src/index.ts`".
  - The napi-rs crate config struct is no longer the canonical source — the TS interface is. The crate must follow the TS interface.
- `.claude/commands/platform/push-and-get-working.md`:
  - Replace `glueo/contextractor[-test]` with `glueo/contextractor[-test]`.
  - Drop any references to building a Rust binary; the actor is a Node app.
- `.claude/commands/git/release.md`:
  - Drop `Cargo.toml` version-bump synchronization across multiple Rust crates — the napi-rs crate is the only Rust crate and version-bump for it stays.
  - Keep `package.json` version-bump synchronization across the TS packages.

## Constraints

- Use `Edit` tool on `.md` files; do not rewrite wholesale (per `.claude/rules/minimal-diff.md`).
- Don't change rules in `.claude/rules/`. They stand.
- Don't introduce code examples that conflict with `.claude/rules/json-config-only.md`.

## Done when

- `grep -ni 'glueo/contextractor' CLAUDE.md .claude/commands/` returns nothing.
- CLAUDE.md no longer claims the actor is a "Rust binary".
- The matching `tests/step-test-update-claude-config.md` passes.
