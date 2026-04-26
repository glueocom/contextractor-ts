# Step SWITCH_APIFY_OWNER: Switch canonical owner from `shortc` to `glueo`

## TLDR

Replace every `shortc/contextractor*` reference in the target repo with `glueo/contextractor*` per the QA decision.

## Skills and agents

- `apify-ops` — owner conventions.

## Inputs

- Decision: `../user-entry-log/entry-qa-apify-owner.md`.

## Step GREP: Find every reference

```bash
grep -rln "shortc/contextractor" /Users/miroslavsekera/r/contextractor-ts/ \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=target \
  | grep -v '^prompts/'
```

Known sites:

- `CLAUDE.md`.
- `.claude/skills/apify-ops/SKILL.md` and other `.claude/skills/apify-*/SKILL.md` if present.
- `.claude/commands/platform/*`, `.claude/commands/git/release.md`, `.claude/commands/platform-tests/*`, `.claude/commands/local-tests/*`, `.claude/commands/sync/*`.
- `apps/contextractor-apify/README.md`, `apps/contextractor-standalone/README.md`, root `README.md`.

## Step REPLACE: Replace

Replace `shortc/contextractor-test` → `glueo/contextractor-test` and `shortc/contextractor` → `glueo/contextractor`. Use Edit (per `.claude/rules/minimal-diff.md`); do not rewrite surrounding paragraphs.

## Step VERIFY

`grep -rln "shortc/contextractor" /Users/miroslavsekera/r/contextractor-ts/ --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=target | grep -v '^prompts/'` returns zero matches.
