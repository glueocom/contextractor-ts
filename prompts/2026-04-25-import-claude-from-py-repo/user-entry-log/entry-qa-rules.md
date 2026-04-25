**Q:** Source has 3 rules; target has no `rules/` directory at all. Which to import?

**A:** Two as-is, skip the third.

- Import `rules/no-confirmation-prompts.md` verbatim. Language-agnostic behavioral rule.
- Import `rules/json-config-only.md` verbatim. Language-agnostic doc convention (always show JSON config in user-facing docs even when code accepts YAML).
- Skip `rules/config-case-conventions.md`. The source rule is keyed off Python-internal helpers (`utils.py`, `to_snake_case`, `normalize_config_keys`). The target uses serde for Rust and standard TS conventions; the dual-case-handling situation does not transfer cleanly. Re-author from scratch later if the target actually develops a similar mismatch.

This is the first time the target gets a `.claude/rules/` directory, so the import also creates the directory.
