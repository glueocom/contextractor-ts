# Docs Maintenance & Sync

General-purpose maintenance prompt — not restricted to any specific commits or date.
Run when documentation may have drifted from code, or to verify everything is in sync.

Do NOT change source code. Only change documentation, configuration, and Claude setup files.

---

## Step AUDIT: Review Recent Commits

Look at recent git history to understand what changed since the last docs-maintenance run:

```bash
git log --oneline -30
```

For any commit that touched `packages/*/src/` or `apps/*/src/` — check whether the corresponding `SPEC.md` and `README.md` @generated regions were updated in the same commit. If not, that package is a candidate for doc sync work in later steps.

---

## Step SPEC: Sync All SPEC.md Files

Read each source package and compare against its SPEC.md. Update any section that is inaccurate or missing.

SPEC.md locations:
- `SPEC.md` — system-level overview, architecture, stack, build, Docker, CI
- `packages/extraction/SPEC.md` — `@contextractor/extraction` public API and behavior
- `packages/crawler/SPEC.md` — `@contextractor/crawler` public API and sink pattern
- `packages/schema/SPEC.md` — input schema fields, Zod types, generation pipeline
- `apps/apify-actor/SPEC.md` — Actor data flow, sinks, output schema, deploy
- `apps/standalone/SPEC.md` — CLI usage, config merge, output modes

For each SPEC.md:
- Read the actual source files in that package's `src/` directory
- Identify any exports, types, CLI flags, config fields, or behaviors that the SPEC describes incorrectly or omits
- Update only the affected sections; use Edit tool for minimal diffs

---

## Step README: Regenerate @generated Regions

Run the docs generator to rebuild all `@generated` markdown regions in READMEs:

```bash
pnpm docs:update
```

After running, check the git diff. If any `@generated` region changed, verify the change is correct and commit it alongside any manual README edits made in this step.

If any README section that is NOT `@generated` is stale (outdated CLI flags, wrong examples, references to removed features), update it manually.

---

## Step PROMPTS: Update Active Work Prompts

Check prompts in `prompts/` that describe in-progress or deferred work:

- Look for prompts with "deferred", "todo", or recent dates — these may describe work that has since been completed or partially completed
- For any prompt that describes work you can confirm is done (check git log), update it to reflect the current state — add a "Current State" or "[DONE]" marker to completed sections
- Deferred prompts to check specifically:
  - `prompts/2026-05-21-spelling-autofix-deferred/` — was spelling autofix run? Is it still pending?
  - `prompts/2026-05-21-typescript-autofix-deferred/` — were the TypeScript issues fixed?
  - `prompts/2026-05-24-spec-hook-fixes/` — were the hook issues resolved? (recent commits suggest yes)
  - `prompts/2026-05-24-typescript-type-files/` — was this implemented?

Do not mark something as done unless you can confirm it in the git log.

---

## Step CLAUDE: Sync CLAUDE.md

Read `CLAUDE.md` and compare against the actual repo state:

- **Project Structure** — verify the directory tree in the `## Project Structure` section matches what actually exists (packages, apps, tools)
- **Commands** — verify every command listed is still valid; remove any that reference deleted scripts or workflows
- **Agents** — verify every agent listed exists in `.claude/agents/`; add any new agents that exist but aren't listed
- **Skills** — verify every skill listed exists in `.claude/skills/`
- **Rules** — verify every rule file in `.claude/rules/` is listed in the `## Rules` section (see also Step RULES-COVERAGE)

---

## Step RULES-COVERAGE: Verify Rule Coverage

Every file in `.claude/rules/` must be referenced in `CLAUDE.md`. Run:

```bash
ls .claude/rules/
```

Then check CLAUDE.md to confirm each rule file is listed. For any rule that is listed in `.claude/rules/` but not referenced in CLAUDE.md, add a one-line entry to the `## Rules` section.

See `.claude/rules/rule-coverage.md` for the full requirement.

---

## Step HOOKS: Verify Hook Health

The spec-gate.sh and test-gate.sh Stop hooks enforce documentation and test updates. Verify they are working correctly:

- Read `.claude/hooks/spec-gate.sh` and `.claude/hooks/test-gate.sh`
- Verify the `stop_hook_active` guard is present in each (prevents infinite loops)
- Verify `$CLAUDE_PROJECT_DIR` is used (not hardcoded paths) — this is required for the hook to work from any cwd
- Verify the transcript parsing logic correctly identifies files edited in the current turn (not all historical turns)
- Check `settings.json` to confirm both hooks are wired to the `Stop` event with appropriate timeouts
- If any issue is found, fix it — see the research in `prompts/2026-05-24-spec-hook-fixes/` for known failure patterns

---

## Step DOCS: Organize docs/

Review `docs/` for any notes that are misplaced, outdated, or redundant:

- `docs/notes/` — cross-cutting notes that apply broadly; verify each still describes a relevant current behavior
- `docs/todo/` — check `docs/todo/2026-04-28-migration-test-followup/todo.md`; if the migration work is complete, either mark as done or move to an archive subfolder
- `docs/troubleshooting/` — verify reported issues are still reproducible or mark as resolved
- `docs/unit-test-cases/` — verify test cases in this directory have corresponding tests in the codebase; flag any that do not

If any note contains project-specific info that belongs inside an `apps/` or `packages/` directory, move it there and update `CLAUDE.md` docs references accordingly.

In `CLAUDE.md`, ensure there is a reference to `docs/` for supplemental notes. If missing, add:

```
When you need more context, look in `docs/` for notes, troubleshooting guides, and unit test case documentation.
```

---

## Step VERIFY: Consistency Check

Run a final grep to catch common stale references:

```bash
# Check for references to deleted packages or renamed paths
grep -r "contextractor-engine\|contextractor-standalone\|@contextractor/native" . \
  --include="*.md" --include="*.json" \
  --exclude-dir=node_modules --exclude-dir=.git | grep -v "package-lock"
```

Review any hits and determine if they reference the current correct package names (`@contextractor/extraction`, `@contextractor/crawler`, `@contextractor/schema`, etc.) or outdated names.

---

## Step COMMIT: Commit and Push

After all doc and config changes are verified:

```bash
git add -A
git commit -m "docs: sync SPEC.md, README regions, and Claude setup with current code"
git push
```

Adjust the commit message to describe the actual changes made.

---

## Ask questions if anything is unclear

If you find a case where it is not clear whether code has changed in a way that requires doc updates, or if a prompt describes work whose completion status is ambiguous from the git log — ask before making assumptions.
