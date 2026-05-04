# Claude Code Prompt Engineering Knowledge Base

Shared knowledge for all prompt engineering agents in this repo.

## Prompt Types

- **Agents**: `.claude/agents/<name>.md` (flat — no subdirectories in this repo)
- **Rules**: `.claude/rules/<name>.md` (flat)
- **Skills**: `.claude/skills/<category>/<name>/SKILL.md` or `.claude/skills/<name>/SKILL.md` — the only home for custom extensions (`.claude/skills/` replaces the legacy `.claude/commands/`)
- **General Prompts**: `prompts/<descriptive-name>.md`

## Frontmatter Structure

### Agents

- **name**: lowercase-with-hyphens (must match filename)
- **description**: Must contain `USE PROACTIVELY` or `ACTIVATE for` activation keywords. Include 1-2 `<example>` tags with context, user request, assistant response, `<commentary>`
- **tools**: Minimal set (Read, Write, Edit, Bash, WebFetch, WebSearch, Glob, Grep, etc.)
- **model**: Use aliases — `opus`, `sonnet`, `haiku` (not full IDs like `claude-opus-4-7`)
- Do NOT add `color`
- Do NOT add a `skills:` field — reference relevant skills inline in the body

### Skills

- **name**: lowercase-with-hyphens matching the slash invocation path (e.g. `git:commit` for `.claude/skills/git/commit/SKILL.md`)
- **description**: WHEN/WHEN-NOT directive form — when to invoke and when not to
- **allowed-tools**: Only necessary tools (e.g. `Bash(git:*)`, `Bash(cargo:*)`, `Read`)
- **model**: See Model Assignment below
- **argument-hint**: `<required> [optional]` (when the skill takes args)
- **disable-model-invocation: true**: For side-effectful skills (deploys, commits, pushes, irreversible writes) — prevents auto-triggering; user must explicitly invoke via `/name`
- **user-invocable: false**: For ambient-only skills hidden from the `/` menu (auto-trigger only)
- No `displayName`, no `version`, no `license` (unless required by upstream skill source)

### Rules

- No frontmatter
- Plain markdown with clear headers
- Keep under ~80 lines

## Model Assignment

Use aliases (`haiku`, `sonnet`) — not full model IDs. Omit `model:` entirely for opus-tier tasks (unspecified defaults to the best available model).

- **haiku** — mechanical execution: run a fixed command, apply git ops, format text, validate JSON, update a timestamp, regenerate a file from a script
- **sonnet** — reasoning tasks: interpret errors and fix code, audit files for consistency, sync docs across surfaces, scaffold projects, write prompts from existing examples, orchestrate sub-tasks
- **unspecified (opus)** — complex creative or analytical work: deep code review (security + correctness across two languages), prompt design from raw ideas, novel code generation from open-ended requirements

**Agents in this repo:**
- haiku: `prompt-formatter`, `test-runner`
- sonnet: `rust-pro`, `ts-pro`, `web-research-specialist`, `prompt-modifier`
- unspecified: `code-reviewer`, `prompt-writer`

## Activation Keywords

Agent descriptions must include activation triggers:
- `USE PROACTIVELY when [trigger condition]`
- `ACTIVATE for [file patterns, directories, technologies]`
- `ALWAYS use this agent` (for exclusive-use agents)

## Tool Selection

Grant only tools actually needed:
- **Research/Planning**: Read, Write, Edit, WebFetch, WebSearch
- **Implementation**: Read, Write, Edit, Bash, Glob, Grep
- **Coordination**: Broad set for orchestration
- **Meta**: Read, Write, Edit (config files)
- **Skills**: Task-specific (minimal)

## Content Principles

- **Be specific**: Clear boundaries, concrete steps
- **State what NOT to do**: Include common pitfalls
- **Avoid unnecessary code examples**: Reference docs/skills instead unless required
- **Concise guidance**: No unnecessary verbosity
- **Practical over theory**: Checklists and step-by-step processes

## Common Pitfalls

- Over-permissioning unnecessary tools
- Scope creep (prompts doing too much)
- Vague abstract instructions
- Missing usage examples in agent descriptions
- Poor/inconsistent naming
- Excessive explanation
- Missing activation keywords in agent descriptions

## Design Principles

- **Separation of Concerns**: One focused purpose per prompt
- **Composability**: Prompts work well together
- **Maintainability**: Concise, clear, up-to-date

## Documentation

- Agents: `https://docs.claude.com/en/docs/claude-code/sub-agents`
- Skills: `https://docs.claude.com/en/docs/claude-code/slash-commands`
- Tools: `https://docs.claude.com/en/docs/claude-code/settings`
