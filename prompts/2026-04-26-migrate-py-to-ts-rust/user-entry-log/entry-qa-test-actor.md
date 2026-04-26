**Q:** Prompt specifies `glueo/contextractor-test`; existing CLAUDE.md and `/platform:push-and-get-working` use `shortc/contextractor-test`. Which test actor wins?

**A:** `glueo/contextractor-test`.

**Implication:**
- Update CLAUDE.md "Production Protection" block: replace `shortc/contextractor-test` with `glueo/contextractor-test`, and `shortc/contextractor` with `glueo/contextractor` (production).
- Update `.claude/commands/platform/push-and-get-working.md` default-target wording to match.
- Apify push during this migration goes only to `glueo/contextractor-test`. Production `glueo/contextractor` must not be pushed in scope.
