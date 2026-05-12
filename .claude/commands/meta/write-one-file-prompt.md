---
description: Research, structure, and produce a single polished prompt file in a prompts/ subfolder
argument-hint: <raw-meta-prompt> [--- optional instructions after separator]
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch, AskUserQuestion, Task
---

# Write One-File Prompt

Transform a raw prompt idea into a single polished prompt file saved to `@/prompts/{date}-{slug}/`. Lighter alternative to `write-prompt` — one output file, no research scaffold, no splitting, no review/test steps.

## Arguments

- `$ARGUMENTS`: Contains the raw meta-prompt (required). If `---` separator is present, text after it is treated as optional instructions/overrides.

## Principles

- **Add only critically required text** — every added word must earn its place
- **Super concise** — no filler, no fluff, no motivational phrasing
- **No code examples** — reference documentation or MCP servers instead
- **Preserve original intent** — fix the prompt, don't rewrite its purpose
- Follow `@/.claude/rules/meta/formatting-guidelines.md`

## Step CLEAN_GIT: Verify Clean Working Directory

Run `git status --porcelain`. If output is not empty, stop with error:

> "Git working directory must be clean. Commit or stash changes before running this command."

## Step SAVE: Create Directory and Log Input

- Derive a topic slug from the raw prompt content (kebab-case, concise)
- Create `@/prompts/{today's date}-{slug}/`
- If `$ARGUMENTS` is a file path that exists, **move** the original file exactly as-is to `user-entry-log/entry-initial-prompt.md` — no headers, no modifications, no reformatting
- If `$ARGUMENTS` is raw text, save it **verbatim** as `user-entry-log/entry-initial-prompt.md`
- If optional instructions were provided (after `---` separator), save as `user-entry-log/entry-instructions.md`
- If the user pasted attachments (images, screenshots, diagrams), save each into `user-entry-log/` with a descriptive name

## Step RESEARCH: Deep Analysis

Read the raw input. Research **every technical claim, tool, library, API, and approach** mentioned:

- **Web search**: Current documentation, changelogs, deprecation notices, known issues
- **MCP servers**: Query relevant MCP tools for up-to-date information
- **Codebase**: Grep for related files, configs, and patterns already in use
- **Documentation**: Fetch official docs for any referenced frameworks or tools

Build analysis covering:

- **Typos and grammar** — fix all spelling, punctuation, and formatting errors
- **Outdated approaches** — flag deprecated APIs, removed features, superseded patterns
- **Logical problems** — contradictions, impossible sequences, missing prerequisites
- **Anti-patterns** — practices that conflict with current best practices
- **Missing structure** — add headers and named steps where the prompt lacks them
- **Clutter** — identify filler text, redundant instructions, unnecessary verbosity

Retain all findings in working memory — applied directly in Step WRITE.

## Step QA_BEFORE: Pre-Fix Questions (MANDATORY Review)

**Default: ASK.** If anything is even slightly unclear, ambiguous, or open to interpretation — ask. It is always better to ask too many questions than to implement something wrong.

Use AskUserQuestion to clarify:

- Ambiguous scope or boundaries ("does this apply to X or also Y?")
- Unclear intent behind a phrase or instruction
- Multiple valid interpretations of a requirement
- Missing context that affects implementation approach
- Assumptions you'd need to make without asking

Log each Q&A exchange as a separate file in `user-entry-log/` (e.g., `entry-qa-redirect-scope.md`). Only skip if the prompt is unambiguous and every requirement has a single clear interpretation.

## Step RESOLVE_TOOLS: Identify Applicable Skills and Agents

Analyze the prompt's scope to determine which skills and agents are relevant.

**Discovery**: Scan `@/.claude/skills/` and `@/.claude/agents/` directories. Read the frontmatter (`description` field) of each skill and agent to understand what it does and when it activates. Match against the prompt's technologies, file paths, and verification needs.

Add a "Skills and Agents" section near the top of the output file listing which skills to activate and which agents to use. Only include skills/agents that are actually relevant — do not list everything.

## Step WRITE: Write Final File

Apply all research findings and QA answers. Write the single polished file to `@/prompts/{date}-{slug}/{slug}.md`.

- Use Write for new files
- Never add motivational language, disclaimers, or boilerplate
- Every sentence must convey actionable information

## Step FIX: Polish Output File

Run `/meta:fix-prompt` on the written file (`@/prompts/{date}-{slug}/{slug}.md`).
