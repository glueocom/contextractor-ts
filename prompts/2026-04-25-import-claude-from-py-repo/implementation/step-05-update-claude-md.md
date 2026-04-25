# Step 05 — Add `## Rules` Section to `CLAUDE.md`

## TLDR

Append a `## Rules` section to the project-root `CLAUDE.md` listing the imported rules with one-line summaries and links. Mirror the source `CLAUDE.md` convention so rules are discoverable. Touches `/Users/miroslavsekera/r/contextractor-ts/CLAUDE.md`.

## Skills

None.

## Inputs

- `../user-entry-log/entry-qa-claude-md.md`
- Reference for shape: `/Users/miroslavsekera/r/contextractor/CLAUDE.md` (its `## Rules` section)

## Target file

- `/Users/miroslavsekera/r/contextractor-ts/CLAUDE.md`

## Actions

1. Choose insertion point. The current `CLAUDE.md` has these top-level sections: What is this Actor for?, Project Structure, Commands, Safety and Permissions, Security, Active Skills, Testing, MCP Servers, Resources. Insert `## Rules` immediately **before** `## Active Skills` so rules and active skills sit together.

2. Section content:
   - One-paragraph intro: "See `.claude/rules/` for behavior rules. Key rules:"
   - Bullet list referencing each imported rule by file. Each bullet is one short line — rule name in bold, brief restatement of the rule.
   - Match the source's terse style. No motivational text, no expansions of the rule body.

3. Do not modify any other section. Specifically, do not edit Safety and Permissions, MCP Servers, Resources, or the existing Git Rules carve-out (the existing CLAUDE.md doesn't currently have one — leave that alone for now; the `no-confirmation-prompts` rule covers the relevant behavioral ground via the rules dir).

## Constraints

- Edit-only. Use the Edit tool for a single insertion.
- Do not include rules that weren't imported (no `config-case-conventions` mention).
- Keep the section to ~6 lines including the heading.

## Done when

- `CLAUDE.md` has a `## Rules` section
- The section sits between `## Security` (or whatever section currently ends with the security paragraph) and `## Active Skills`
- Each imported rule appears as exactly one bullet linking its filename
- `grep -c "^## Rules" CLAUDE.md` returns 1
