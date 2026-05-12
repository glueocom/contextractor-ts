# Test Maintenance

Unit tests must be added or updated in the **same response** as the source change — never defer to a follow-up.

## When to update tests

Update the corresponding test file in the **same response** as the source change.

Add or update tests when:
- A new public function, method, or class is added
- Existing logic changes — new branches, edge-case handling, algorithm change
- A bug is fixed — add a regression test for the exact input that triggered the bug
- A schema field, CLI flag, or output format is added, renamed, or removed
- A new error path or validation rule is added

No test update needed when:
- Only types or type signatures change with no logic change (TypeScript-only refactors)
- A private helper is extracted and callers already have tests that exercise the code path
- Changes are limited to comments, formatting, or documentation files
- Generated files are updated by a codegen script (`input_schema.json`, `*.d.ts`)

## Test locations

### TypeScript

`*.test.ts` next to source (e.g., `packages/extraction/src/index.test.ts` for `index.ts`). Fixture-based tests for `@contextractor/extraction` go in `packages/extraction/test/` with HTML fixtures under `packages/extraction/test/fixtures/`.

### Rust

Tests in `#[cfg(test)] mod tests { ... }` in the same source file. Editing the source file constitutes updating the tests — no separate file required.

## How to update

Read the changed source file, identify the new or changed logic, and write or update the minimal set of test cases that covers the change. Use the Edit tool for surgical additions. Do not rewrite passing tests.
