---
name: meta:write-prompt-file
description: WHEN writing a single polished Claude Code prompt file (agent, skill, rule, or command) directly to .claude/. WHEN-NOT for full structured prompt packages with research scaffold; use meta:write-prompt for that.
argument-hint: <raw-meta-prompt> [--- optional instructions after separator]
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch, AskUserQuestion
disable-model-invocation: true
---

# Write Prompt File

Transform a raw prompt idea into a single, polished prompt file written directly to the appropriate `.claude/` subfolder. Lighter alternative to `write-prompt` — produces one output file, no research scaffold, no splitting.

## Arguments

- `$ARGUMENTS`: Contains the raw meta-prompt (required). If `---` separator is present, text after it is treated as optional instructions/overrides.

## Principles

- **Add only critically required text** — every added word must earn its place
- **Super concise** — no filler, no fluff, no motivational phrasing
- **No code examples** — reference documentation or MCP servers instead
- **Preserve original intent** — fix the prompt, don't rewrite its purpose
- Follow `.claude/rules/formatting-guidelines.md`

## Step CLEAN_GIT: Verify Clean Working Directory

Run `git status --porcelain`. If output is not empty, stop with error:

> "Git working directory must be clean. Commit or stash changes before running this command."

## Step DETERMINE_TARGET: Identify Output Path

Infer the prompt type and output path from the raw content:

- **Agent** → `.claude/agents/{name}.md`
- **Command** → `.claude/commands/{category}/{name}.md`
- **Rule** → `.claude/rules/{name}.md`
- **Skill** → `.claude/skills/{name}/SKILL.md`
- **General prompt** → `prompts/{name}.md`

Use `{name}` in kebab-case derived from the topic. If type or category is ambiguous, use AskUserQuestion to confirm before continuing.

## Step RESEARCH: Deep Analysis

Read the raw prompt. Research **every technical claim, tool, library, API, and approach** mentioned:

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

Retain all findings in working memory — they are applied directly in Step WRITE.

## Step QA_BEFORE: Pre-Fix Questions (MANDATORY Review)

**Default: ASK.** If anything is even slightly unclear, ambiguous, or open to interpretation — ask. It is always better to ask too many questions than to implement something wrong.

Use AskUserQuestion to clarify:

- Ambiguous scope or boundaries
- Unclear intent behind a phrase or instruction
- Multiple valid interpretations of a requirement
- Missing context that affects implementation approach
- Assumptions you'd need to make without asking

Only skip if the prompt is unambiguous and every requirement has a single clear interpretation.

## Step RESOLVE_TOOLS: Identify Applicable Skills and Agents

Scan `.claude/skills/` and `.claude/agents/` directories. Read the frontmatter `description` field of each to understand activation conditions. Match against the prompt's technologies, file paths, and verification needs.

Add a "Skills and Agents" section near the top of the output file listing which skills to activate and which agents to use. Only include skills/agents that are actually relevant.

## Step WRITE: Write Final File

Apply all research findings and QA answers. Write the single polished file to the path determined in Step DETERMINE_TARGET.

- For skills: create the `{name}/` subdirectory if it does not exist, then write `SKILL.md` inside it
- Follow frontmatter conventions from `.claude/rules/prompt-engineering-knowledge.md` for the prompt type
- Use Edit if the target file already exists (updating an existing prompt); use Write for new files
- Never add motivational language, disclaimers, or boilerplate
- Every sentence must convey actionable information
