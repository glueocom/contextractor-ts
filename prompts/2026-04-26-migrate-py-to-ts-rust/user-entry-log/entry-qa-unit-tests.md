**Q:** Source repo has Python tests in `tools/generated-unit-tests/` (pytest + HTML fixtures). How should they be migrated?

**A:** Port to TS (vitest).

**Implication:**
- `tools/generated-unit-tests/` becomes a TypeScript package: `package.json`, `tsconfig.json`, `vitest.config.ts`, `*.test.ts` files calling the new TS `contextractor-engine`.
- HTML fixtures (`fixtures/`) are copied verbatim — they are language-agnostic.
- Update CLAUDE.md "Project Structure" block to reflect that `tools/generated-unit-tests/` is now TypeScript (vitest), not Rust integration tests.
- Update `.claude/commands/platform-tests/generate-unit-tests.md` so it generates vitest cases, not `cargo` integration tests.
