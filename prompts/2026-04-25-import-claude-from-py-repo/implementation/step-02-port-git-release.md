# Step 02 — Port `commands/git/release.md` for Cargo + npm

## TLDR

Create `commands/git/release.md` in target, rewriting the source's Python-keyed version-bump flow for the target's Rust + TypeScript layout. The target's actual distribution channel is Apify only — this command is a version-sync + tag + push, not a publish flow. Touches `.claude/commands/git/release.md`.

## Skills

- `rust` for Cargo.toml conventions
- `apify-ops` for actor-name conventions (`glueo/contextractor*`)

## Inputs

- Source: `/Users/miroslavsekera/r/contextractor/.claude/commands/git/release.md`
- `../import-claude-from-py-repo-notes/target-source-of-truth.md` — file inventory and the note that no Cargo workspace currently exists; the command must fail gracefully when files are missing rather than guess.
- `../user-entry-log/entry-qa-commands.md`

## Target file

- `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/git/release.md` — new

## Actions

Author the new file with this structure (read the source first to preserve its top-level shape and tone):

1. **Frontmatter** — `description:` one sentence saying the command does a synchronized version bump across Rust + TypeScript packages and pushes a tag. `allowed-tools:` cover `Bash(git:*)`, `Bash(cargo:*)`, `Bash(jq:*)` if used, plus `Read` / `Edit` / `Write` / `Glob` / `Grep`.
2. **Step DETERMINE** — read current version from the canonical Rust `Cargo.toml` (root workspace `Cargo.toml` once it exists; otherwise `apps/contextractor/Cargo.toml` and `packages/contextractor_engine/Cargo.toml`). If `$ARGUMENTS` is a version string (`X.Y.Z` or `vX.Y.Z`), use it; otherwise bump patch.
3. **Step UPDATE** — update `version = "X.Y.Z"` in every Rust manifest under `apps/` and `packages/` (use a `find` for `Cargo.toml`). Update `"version": "X.Y.Z"` in every `package.json` under `tools/` (use a `find`, exclude `node_modules`). If a file is missing, list it and stop with a clear error rather than skipping.
4. **Step COMMIT** — stage only the changed manifest files, commit with subject `Release vX.Y.Z`. No `Co-Authored-By` footer (per `rules/no-confirmation-prompts.md` and the "Git Rules" section that will land in CLAUDE.md via the upstream source).
5. **Step TAG** — `git tag vX.Y.Z` then `git push && git push origin vX.Y.Z`.
6. **Step REPORT** — print the tag, the GitHub Actions URL (template — leave the actual URL blank with a `<TODO once CI exists>` marker), and a one-line reminder that deployment to Apify is separate (`/platform:push-and-get-working`).

## Constraints

- The command must not assume any package is published to npm / crates.io / PyPI — the target ships only to Apify.
- Do not include the Python source's PyPI / npm / Docker logic.
- Use the exact Apify actor name `glueo/contextractor` (not `glueo/contextractor`).
- No code-fence with shell heredocs that pretend a Cargo workspace exists. If `Cargo.toml` is absent, the step prints the missing files and exits cleanly. The user can re-run after the workspace is scaffolded.

## Done when

- File exists with valid frontmatter
- All version-bump targets are listed by glob, not hardcoded — so the command keeps working when manifests are added
- `grep -E "pyproject\\.toml|PyPI|pip install" .claude/commands/git/release.md` returns nothing
- Actor name uses `glueo/contextractor`, not `glueo/contextractor`
