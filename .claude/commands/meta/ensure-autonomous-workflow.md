---
description: Ensure (create or update) the autonomous workflow — skills, autofix commands, and maintenance orchestrator
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
model: claude-opus-4-6
---

# Ensure Autonomous Workflow

Ensure (create or update) the autonomous workflow. If nothing exists, create it. If it already exists, review and update for correctness.

## Overview

This command ensures three layers exist and are correct:

- **Skills**: `autonomous-task` and `iterate-workspace` in `.claude/skills/`
- **Autofix commands**: One per test command, in `.claude/commands/autonomous/`
- **Maintenance orchestrator**: `.claude/commands/autonomous/maintenance.md`

## Step INVENTORY: Check Current State

Read the workspace and existing files:

- Read `pnpm-workspace.yaml` to understand all workspace projects
- List all commands in `.claude/commands/test/` — these are the source commands
- List all commands in `.claude/commands/autonomous/` — these are existing autofix counterparts
- Check if `.claude/skills/autonomous-task/` exists
- Check if `.claude/skills/iterate-workspace/` exists

Classify the state: **create** (nothing exists) or **review** (some or all exist).

## Step SKILLS: Ensure Skills Exist

### Skill: `autonomous-task`

Ensure (create or update) `.claude/skills/autonomous-task/SKILL.md` with frontmatter (`name: autonomous-task`, `description: ...`).

**Behavior to document in SKILL.md**:
- Execute the assigned task end-to-end without user interaction
- Save a report to `autonomous-task-output/{taskName}-report.md` (relative to repo root)
- If a subtask requires user interaction, do NOT ask — instead:
  - Create a prompt file at `autonomous-task-output/{taskName}-prompt.md` describing the subtasks that need user decisions
  - Continue with remaining subtasks that can be completed autonomously

### Skill: `iterate-workspace`

Ensure (create or update) `.claude/skills/iterate-workspace/SKILL.md` with frontmatter (`name: iterate-workspace`, `description: ...`).

**Behavior to document in SKILL.md**:
- Read `$CLAUDE_PROJECT_DIR/pnpm-workspace.yaml`
- Parse the `packages:` list to get all workspace project paths
- The skill consumer specifies which subset is applicable (e.g., only `-site` projects, only `packages/`, etc.)
- Provide the list of matching project paths for the consumer to iterate over

## Step AUTOFIX_COMMANDS: Ensure (Create or Update) Counterparts for Test Commands

For every command in `.claude/commands/test/`, ensure a counterpart exists in `.claude/commands/autonomous/`.

**Naming**: `{original-name}` becomes `{original-name}-autofix`

**Sync rule**: The autofix commands must mirror the test commands exactly:
- If a test command exists but its autofix counterpart does not — create the counterpart
- If an autofix counterpart exists but its source test command has been deleted — delete the orphaned autofix command
- List the current test commands dynamically (do not hardcode the list)

**Each autofix command must**:

- Reference the `autonomous-task` and `iterate-workspace` skills
- Include all skills from the original test command (e.g., `code-review`, `nextjs`, `react`)
- Use the `iterate-workspace` skill to get applicable workspace projects, filtered to only the projects relevant to the task (e.g., review-nextjs only applies to `-site` projects, test-deps applies to all)
- First run the corresponding test/review to identify issues
- Then use appropriate agents and skills to fix the identified issues
- Save the report via `autonomous-task` skill behavior
- Include all tools needed: the original test command's tools plus Write and Edit for fixing

**File scope heuristic** (determine dynamically by reading the source test command):

- Commands targeting live URLs (smoke, a11y, responsive, SEO, security headers, spelling with URL) → `-site` projects only
- Commands targeting source code (review-nextjs, review-react) → `-site` projects only (Next.js/React apps)
- Commands targeting all code (review-typescript, dead-code, deps) → all workspace projects

## Step MAINTENANCE: Ensure Maintenance Command

Location: `.claude/commands/autonomous/maintenance.md`

The maintenance command must:

- Clear the `autonomous-task-output/` directory (create if it does not exist)
- List all autofix commands dynamically from `.claude/commands/autonomous/` (exclude `maintenance.md` itself)
- Run each autofix command sequentially
- After all autofix commands complete, commit and push using the `/git:commit` command

## Step VALIDATE: Review and Verify

After all files are created or updated, validate:

- Skills have correct `SKILL.md` with frontmatter (`name`, `description`)
- Every autofix command in `autonomous/` has a matching source in `test/` (no orphans)
- Every test command in `test/` has a matching autofix counterpart in `autonomous/`
- Autofix commands reference the correct source test command and skills
- Maintenance command dynamically discovers all autofix commands
- All file paths and references resolve correctly

Report any issues found and fix them.
