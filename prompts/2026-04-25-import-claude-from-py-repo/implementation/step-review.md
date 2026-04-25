# Step Review — Verify, Smoke-Test, Autofix

## TLDR

Verify every requirement in `entry-initial-prompt.md` is reflected in the diff, every Q&A decision is honored, no Python references slipped through, and the new commands are valid Claude slash commands. Autofix any mismatch.

## Skills and Agents

- `code-reviewer` agent — independent read of the full diff
- `apify-schemas` skill — sanity-check the schema-related claims in the ported `sync/gui.md`
- `meta:setup` slash command (lives at `.claude/commands/meta/setup.md`) — re-validate the `.claude/` setup at the end

## Inputs (read all)

- `../user-entry-log/entry-initial-prompt.md`
- `../user-entry-log/entry-qa-commands.md`
- `../user-entry-log/entry-qa-rules.md`
- `../user-entry-log/entry-qa-claude-md.md`
- All step files in this directory
- `../import-claude-from-py-repo-notes/inventory-diff.md`
- `../import-claude-from-py-repo-notes/target-source-of-truth.md`

## Actions

1. **Capture the diff:**

   ```
   git diff --stat
   git diff
   git status
   ```

2. **Per-step verification.** For each step file:
   - Read the step's "Done when" block.
   - Run each grep / shell check listed there. Every check must pass.
   - Autofix any failure.

3. **Requirement coverage** against `entry-initial-prompt.md`:
   - "look into source `.claude` and whole repo" → confirmed via `inventory-diff.md` and `target-source-of-truth.md`. ✓
   - "import missing skills, agents, commands" → 0 skills, 0 agents (covered by existing target inventory), 3 commands (`git/release`, `sync/docs`, `sync/gui`). Verify each new command file exists. ✓ once steps 02–04 land.
   - "no Python (only convertible to Rust)" — verify with the global grep below.
   - User clarification "all similar cases, rust and typescript" — verify both `sync/docs` and `sync/gui` cite at least one Rust file AND one TS path.

4. **Q&A coverage:**
   - `entry-qa-commands.md`: `commands/git/release.md`, `commands/sync/docs.md`, `commands/sync/gui.md` exist; `commands/publish/all.md` does **not** exist.
   - `entry-qa-rules.md`: `.claude/rules/no-confirmation-prompts.md` and `.claude/rules/json-config-only.md` exist; `.claude/rules/config-case-conventions.md` does **not**.
   - `entry-qa-claude-md.md`: `CLAUDE.md` has a `## Rules` section linking to both imported rules.

5. **Global grep guards** — these must each return nothing inside the new files (i.e. `.claude/rules/`, the 3 new commands, and the modified region of `CLAUDE.md`):

   ```
   grep -rE "pyproject\\.toml|PyPI|pip install|typer|Pydantic|dataclass" .claude/rules/ .claude/commands/git/release.md .claude/commands/sync/docs.md .claude/commands/sync/gui.md
   grep -rE "config\\.py|crawler\\.py|models\\.py|CrawlConfig|TrafilaturaConfig|FORMAT_EXTENSIONS" .claude/rules/ .claude/commands/git/release.md .claude/commands/sync/docs.md .claude/commands/sync/gui.md
   grep -rn "glueo/contextractor" .claude/rules/ .claude/commands/git/release.md .claude/commands/sync/docs.md .claude/commands/sync/gui.md
   ```

   Permitted exceptions: zero. If any match returns a hit, autofix.

6. **Rule-file integrity.** Confirm the two imported rules are byte-identical to source:

   ```
   diff /Users/miroslavsekera/r/contextractor/.claude/rules/no-confirmation-prompts.md .claude/rules/no-confirmation-prompts.md
   diff /Users/miroslavsekera/r/contextractor/.claude/rules/json-config-only.md .claude/rules/json-config-only.md
   ```

   Both diffs must be empty.

7. **Slash-command shape check.** Each new command file in `.claude/commands/` must:
   - start with `---` frontmatter
   - have a `description:` field
   - have an `allowed-tools:` field that includes the tools the command actually uses
   - end with a complete final section (no truncated trailing line)

   Confirm with:

   ```
   for f in .claude/commands/git/release.md .claude/commands/sync/docs.md .claude/commands/sync/gui.md; do
     head -5 "$f"; echo "---"; tail -3 "$f"; echo "==="
   done
   ```

8. **`CLAUDE.md` smoke check:**

   ```
   grep -c "^## Rules" CLAUDE.md
   grep -A 6 "^## Rules" CLAUDE.md
   ```

   Section exists exactly once, lists both rules.

9. **Run `meta:setup` audit.** Invoke the `meta:setup` slash command (no args) to re-audit `.claude/`. Apply any fixes it suggests that are in scope (formatting, frontmatter, references). Skip out-of-scope suggestions that touch unrelated files.

10. **Independent review.** Spawn the `code-reviewer` agent with the diff and `entry-initial-prompt.md`. Brief it: "Confirm: 0 skills/agents added, 2 rules imported verbatim, 3 commands ported with no Python residue, both Rust and TS source-of-truth covered in `sync/docs.md` and `sync/gui.md`, `CLAUDE.md` references the new rules. Flag any Python mention that should be Rust+TS instead." Apply findings.

11. **Autofix loop.** Any failing check → fix → re-run → done.

## Done when

- All step "Done when" blocks pass
- All global grep guards return nothing
- Both imported rules are byte-identical to source
- `meta:setup` audit reports no `.claude/` issues introduced by this prompt
- `code-reviewer` agent reports no gaps
- `git diff` is internally consistent — no half-edited file
