# Conversation summary — markdown region templating research

## Question

How to regenerate only marked regions inside `.md` files (tables, CLI examples) from a central JSON, while leaving hand-written prose untouched. Constraints: Node/TS, manual CLI, ability to also include other markdown files.

## Answer

Use **`markdown-magic` v4.8.0** (Jan 2026, MIT, ~12k weekly downloads, used by Netlify CLI / Mocha / Serverless / TC39).

- HTML-comment markers (`<!-- docs NAME -->` … `<!-- /docs -->`, or legacy `AUTO-GENERATED-CONTENT:START/END`)
- Built-in transforms: `TOC`, `CODE`, `FILE`, `REMOTE`, `fileTree`, `install`
- `FILE` handles markdown transclusion natively
- Custom transform = single function `({ content, options }) => string` — read JSON, return GFM table
- Config in `markdown.config.js`, run via `md-magic --files '**/*.md'`
- CI drift check: run + `git diff --exit-code`

## Pitfalls

- TypeScript types are stale (`@types/markdown-magic` describes v1) — write a local `.d.ts`
- Regex-based replacement (not AST) — keep markers on own lines with blank lines around
- Sync-only by design; ships deprecated `sync-request`
- Set `failOnMissingTransforms: true` to fail loud on typos

## Alternatives considered

- **`inject-markdown`** (streetsidesoftware) — TS-native, modern, but no custom transform API. Good for pure transclusion + code embedding.
- **Custom `mdast-zone` remark plugin** — ~30 lines, AST-correct, fully typed, ESM-only. Migration target if markdown-magic bus-factor becomes a concern.
- **Rejected**: `markdown-include` (whole-file assembler, abandoned 2015), `markdown-it-include` (render-time, wrong paradigm), `embedme` (code-only, dormant since 2022), MDX (different paradigm), `cog` (no Node port exists).

## Three paradigms — don't confuse them

1. **In-place region replacement** ← what was wanted (markdown-magic, inject-markdown, cog)
2. Whole-file template rendering (jsdoc2md, dmd) — destroys manual edits
3. Render-time processing (MDX, markdown-it plugins) — never edits source

## Real-world references

- Netlify CLI `CONTRIBUTING.md` — canonical example
- Mocha `scripts/markdown-magic.config.js` — usage + TOC + package-json transforms
- Serverless `plugins/generate-docs.js` — JSON → GFM table reference
- GitHub Actions niche: `npalm/action-docs`, `eslint-doc-generator`

## Recommended setup snippet

```js
// markdown.config.js
const fs = require('node:fs');
module.exports = {
  failOnMissingTransforms: true,
  transforms: {
    CONFIG_TABLE({ options }) {
      const data = JSON.parse(fs.readFileSync(options.source, 'utf8'));
      // ...build GFM table
    },
  },
};
```

```json
{
  "scripts": {
    "docs:update": "md-magic --files '**/*.md' --config ./markdown.config.js",
    "docs:check": "md-magic --files '**/*.md' --config ./markdown.config.js && git diff --exit-code -- '**/*.md'"
  }
}
```
