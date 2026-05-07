---
description: Research, fix, and compact a prompt file. Optionally execute it to validate and refine.
argument-hint: <prompt-file-path>
allowed-tools: Read, Edit, Grep, Glob, WebSearch, WebFetch, AskUserQuestion
model: sonnet
---

# Fix Prompt

Deep-research a prompt file using mandatory detailed web research, find outdated or wrong approaches, fix them.

## Arguments

- `$ARGUMENTS[0]`: Path to prompt file (required)

## Principles

- **Preserve original intent** — fix the prompt, don't rewrite its purpose
- **Preserve original structure** — no new headings, no rephrasing for style. Keep the author's wording wherever it is correct. 
- Reorder items, parts of the text when the original order is logically broken (e.g. a step references state created by a later step)
- **Minimum-touch fixes only** — grammar, typos, factual errors, broken URLs/paths/versions, mistakes uncovered in research. Nothing else
- **Keep it a prompt** — never convert to a slash command, redirect, or stub
- **Super concise** — no filler, no fluff

## Step RESEARCH: Deep Analysis

Read the prompt file. Research **every technical claim, tool, library, API, and approach** mentioned. **Web research is mandatory and must not be skipped — even if a claim seems obviously correct, verify it.**

- **Web search** (required for every technical claim): current documentation, changelogs, deprecation notices, known issues — search deeply, do not skim
- **MCP servers**: Query relevant MCP tools for up-to-date information
- **Codebase**: Grep for related files, configs, and patterns already in use
- **Documentation**: Fetch official docs for any referenced frameworks or tools

Build an analysis covering:

- **Outdated approaches** — deprecated APIs, removed features, superseded patterns
- **Logical problems** — contradictions, impossible sequences, missing prerequisites
- **Anti-patterns** — practices that conflict with current best practices
- **Clutter** — filler text, redundant instructions, unnecessary verbosity

## Step QA: Ask Questions (If Needed)

If research found things that can be improved, ask the user via AskUserQuestion. Skip if analysis is clear and no improvements needed.

## Step FIX: Apply Fixes

Edit the prompt file applying all findings:

- Fix typos, grammar, and broken URLs / paths / versions in place
- Replace factually wrong claims (deprecated APIs, missing features, wrong identifiers) with correct ones, keeping the surrounding sentence
- Resolve logical contradictions with the smallest possible edit
- Integrate answers from QA step as natural prompt content — never append Q&A transcripts

**Constraints**:
- Always use Edit tool. Never use Write — that destroys structure. If the prompt is unstructured notes, leave it unstructured; do not impose headings, sections, or bullet hierarchies the author did not write
- Do not add new headings or rephrase correct sentences for style. Reorder only when sequence is logically broken
- Never add motivational language, disclaimers, or boilerplate
- Every sentence must convey actionable information
- Do not commit — let the user review via `git diff`

## Step TLDR: Write or Fix TLDR

Check whether the prompt has a TLDR blockquote as the first content block after the frontmatter (before any other content):

- **No TLDR exists**: insert one immediately after the frontmatter — a one-to-three sentence summary of what the prompt does and when to use it, formatted as:
  ```
  > **TLDR**: One-to-three sentence summary of what this prompt does and when to use it.
  ```
- **TLDR already exists**: review it against the now-fixed prompt content. If it is stale or inaccurate, fix it in place with the Edit tool. If it is still accurate, leave it unchanged.
