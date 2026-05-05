# Set Up Automatic Documentation Propagation

Audit and configure the Claude Code environment so that SPEC.md files, READMEs, and internal consistency are always kept in sync with source changes — without the user having to ask. Run this once to install or repair the setup.

## Goal

Every time Claude edits a `.ts` or `.rs` source file during any task, all affected documentation must be updated in the same response:

- **SPEC.md** — per-package spec for the modified package (always required for source changes)
- **README.md** — package and app READMEs via `pnpm docs:update` (required when public API surfaces change)
- **GUI consistency** — run `/autonomous:maintenance:sync:gui` to verify TS engine ↔ napi-rs ↔ CLI ↔ schemas alignment (required when API surfaces change)

A Stop hook enforces this: if Claude finishes a turn without updating the correct documentation, the hook blocks completion and Claude must fix it before the session can end.

## Design rationale

**Why hooks and not CLAUDE.md rules**: Rules are advisory. Anthropic's own docs state: "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens." Real-world compliance rate for process rules (not style rules) is ~60–70%, and degrades further in long sessions as context compacts. Issue #43557 (May 2026) documents Claude correctly reciting rules but still skipping them during execution. The hook is the enforcement layer; the rule (`spec-maintenance.md`) is the guidance layer that tells Claude *which* spec to update.

**Why Stop hook and not PostToolUse**: PostToolUse fires after each individual Write/Edit call, before Claude has finished making all edits in a turn. It can inject a hint but cannot block anything — Claude may make 10 more source edits after the first reminder. Stop fires once at turn end with the full list of all edits, and `{"decision":"block"}` causes Claude to continue its turn and fix the issue. PostToolUse `additionalContext` is also of ambiguous status (issue #18427 closed "not planned"; issue #24788 still open as of May 2026).

**Why per-package mapping and not "any SPEC.md"**: Editing `packages/extraction/src/index.ts` and only touching `apps/apify-actor/SPEC.md` would pass a naive "was any spec touched?" check. The hook must verify the *correct* spec for the package that was modified.

**Public API surfaces** — files whose changes require README updates and GUI verification:
- `packages/extraction/src/index.ts` + `packages/extraction/native/src/lib.rs` — TS engine API + napi-rs binding
- `packages/schema/src/input.ts` — Zod input schema (canonical for CLI flags, Actor input, `ContextractorInputType`)
- `apps/standalone/src/cliProgram.ts` + `apps/standalone/src/cli.ts` — CLI flag definitions

## Step AUDIT: Check current state

Verify each required component exists and is correct. Read each file if it exists.

- `.claude/hooks/spec-gate.sh` — executable Stop hook with per-package SPEC.md + README/GUI enforcement
- `.claude/settings.json` → `hooks.Stop[]` entry pointing to spec-gate.sh
- `.claude/rules/spec-maintenance.md` — spec maintenance rule with explicit same-turn requirement
- `CLAUDE.md` → Rules section references spec-maintenance

## Step HOOK: Install spec-gate.sh

Create or overwrite `.claude/hooks/spec-gate.sh` with this exact content:

```bash
#!/usr/bin/env bash
# Stop hook — blocks turn completion when source files were edited but documentation was not updated.
# Enforces: correct per-package SPEC.md + README.md for public API surface changes.
# Fires once per turn; stop_hook_active=true on the re-entry prevents an infinite loop.
set -euo pipefail

input=$(cat)

# Loop guard: when Claude re-enters after a block, stop_hook_active is true — let it finish.
if echo "$input" | jq -e '.stop_hook_active == true' > /dev/null 2>&1; then
  exit 0
fi

# Extract file paths from all Write and Edit calls made this turn.
edited=$(echo "$input" | jq -r '
  .tool_results[]? |
  select(.tool_name == "Write" or .tool_name == "Edit") |
  .tool_input.file_path // empty
' 2>/dev/null || true)

spec_files=$(printf '%s\n' "$edited" | grep 'SPEC\.md$' || true)
readme_files=$(printf '%s\n' "$edited" | grep 'README\.md$' || true)

# Map each edited source file to the SPEC.md it requires.
# Flag public API surface files that also require README updates.
required_specs=""
api_surface_changed=false

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    */packages/extraction/src/*|*/packages/extraction/native/src/*)
      required_specs+=$'\n'"packages/extraction/SPEC.md"
      api_surface_changed=true ;;
    */packages/crawler/src/*)
      required_specs+=$'\n'"packages/crawler/SPEC.md" ;;
    */packages/schema/src/*)
      required_specs+=$'\n'"packages/schema/SPEC.md"
      api_surface_changed=true ;;
    */apps/apify-actor/src/*)
      required_specs+=$'\n'"apps/apify-actor/SPEC.md" ;;
    */apps/standalone/src/*)
      required_specs+=$'\n'"apps/standalone/SPEC.md"
      [[ "$f" == */cliProgram.ts || "$f" == */cli.ts ]] && api_surface_changed=true ;;
  esac
done < <(printf '%s\n' "$edited" | grep -E '\.(ts|rs)$' | grep -v 'SPEC\.md' || true)

# Deduplicate.
required_specs=$(printf '%s\n' "$required_specs" | sort -u | grep -v '^$' || true)

# --- Check 1: SPEC.md per-package ---
missing_specs=""
if [[ -n "$required_specs" ]]; then
  while IFS= read -r spec; do
    if ! printf '%s\n' "$spec_files" | grep -qF "$spec"; then
      missing_specs+=" $spec"
    fi
  done <<< "$required_specs"
fi

# --- Check 2: README.md for public API surface changes ---
missing_readme=""
if [[ "$api_surface_changed" == true && -z "$readme_files" ]]; then
  missing_readme=" README.md"
fi

# Build block message if anything is missing.
if [[ -n "$missing_specs" || -n "$missing_readme" ]]; then
  msg="Documentation was not updated after source changes."

  if [[ -n "$missing_specs" ]]; then
    list="${missing_specs# }"
    list="${list// /, }"
    msg+=" Missing SPEC.md: $list."
  fi

  if [[ -n "$missing_readme" ]]; then
    msg+=" Public API surface changed — update README.md (run pnpm docs:update) and run /autonomous:maintenance:sync:gui."
  fi

  msg+=" See .claude/rules/spec-maintenance.md."
  printf '{"decision":"block","reason":"%s"}' "$msg"
  exit 0
fi

exit 0
```

After writing the file, run `chmod +x .claude/hooks/spec-gate.sh`.

## Step SETTINGS: Register the Stop hook

In `.claude/settings.json`, ensure `hooks.Stop` exists with this entry. If `hooks.Stop` is absent, add it; if already present and correct, skip.

```json
"Stop": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/spec-gate.sh",
        "timeout": 10,
        "statusMessage": "Checking documentation..."
      }
    ]
  }
]
```

Use the Edit tool — do not rewrite the whole file.

## Step RULE: Strengthen spec-maintenance.md

Ensure `.claude/rules/spec-maintenance.md` contains an explicit same-turn requirement. The rule must say that spec updates happen in the same response as source changes — not deferred to a follow-up. Add this sentence to the "When to update specs" section if absent:

> Update the relevant SPEC.md in the **same response** as the source change — never defer to a follow-up.

## Step CLAUDE_MD: Verify Rules reference

Ensure `CLAUDE.md` lists the spec-maintenance rule in its Rules section:

```
- [Spec maintenance](.claude/rules/spec-maintenance.md) — keep SPEC.md files in sync with code
```

If absent, add it. If already present, skip.

## Step VERIFY: Smoke test the hook

Run all cases and confirm output:

```bash
# Case 1 — extraction src, no spec → block (SPEC.md + README)
echo '{"stop_hook_active":false,"tool_results":[{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/extraction/src/index.ts"}}]}' \
  | .claude/hooks/spec-gate.sh

# Case 2 — extraction src + correct spec + README → exit 0
echo '{"stop_hook_active":false,"tool_results":[{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/extraction/src/index.ts"}},{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/extraction/SPEC.md"}},{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/extraction/README.md"}}]}' \
  | .claude/hooks/spec-gate.sh ; echo "exit $?"

# Case 3 — loop guard → exit 0
echo '{"stop_hook_active":true,"tool_results":[]}' \
  | .claude/hooks/spec-gate.sh ; echo "exit $?"

# Case 4 — wrong spec → block
echo '{"stop_hook_active":false,"tool_results":[{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/extraction/src/index.ts"}},{"tool_name":"Edit","tool_input":{"file_path":"/repo/apps/apify-actor/SPEC.md"}}]}' \
  | .claude/hooks/spec-gate.sh

# Case 5 — API surface (schema) + correct spec but no README → block (README + gui)
echo '{"stop_hook_active":false,"tool_results":[{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/schema/src/input.ts"}},{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/schema/SPEC.md"}}]}' \
  | .claude/hooks/spec-gate.sh

# Case 6 — API surface + spec + README → exit 0
echo '{"stop_hook_active":false,"tool_results":[{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/schema/src/input.ts"}},{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/schema/SPEC.md"}},{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/schema/README.md"}}]}' \
  | .claude/hooks/spec-gate.sh ; echo "exit $?"

# Case 7 — internal src (crawler) + spec, no API surface → exit 0
echo '{"stop_hook_active":false,"tool_results":[{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/crawler/src/crawler.ts"}},{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/crawler/SPEC.md"}}]}' \
  | .claude/hooks/spec-gate.sh ; echo "exit $?"
```

Fix the hook if any case produces unexpected output.

## Completion

Report: which components were already correct, which were created or patched, and confirm all seven smoke tests passed.
