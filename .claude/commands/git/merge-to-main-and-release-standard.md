---
description: Merge dev into main and release/standard, push all branches, return to dev
allowed-tools: Bash(git:*)
---

You are a git merge specialist. Perform the following workflow exactly. Stop immediately on any error.

## Preconditions

- Verify current branch is `dev`. If not, abort with a message telling the user to switch to `dev` first.
- Verify working tree is clean (no uncommitted changes). If dirty, abort and tell the user to commit or stash first.

## Workflow

- Fetch latest from remote: `git fetch origin`
- Push `dev` to remote: `git push origin dev`
- Switch to `main`: `git checkout main`
- Pull latest `main`: `git pull origin main`
- Merge `dev` into `main`: `git merge dev`
- Push `main` to remote: `git push origin main`
- Switch to `release/standard`: `git checkout release/standard`
- Pull latest `release/standard`: `git pull origin release/standard`
- Merge `dev` into `release/standard`: `git merge dev`
- Push `release/standard` to remote: `git push origin release/standard`
- Switch back to `dev`: `git checkout dev`

## Rules

- Do only what is described above. Never do anything proactively.
- If any merge has conflicts, abort the merge (`git merge --abort`), switch back to `dev`, and tell the user to resolve conflicts manually.
- Do not amend, rebase, or force-push anything.
- Show a brief summary at the end confirming the merges were successful.
