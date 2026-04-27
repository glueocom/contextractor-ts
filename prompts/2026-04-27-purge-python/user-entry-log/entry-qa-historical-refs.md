# Q&A — Historical Python references in source comments / READMEs

## Question

How should historical Python references in contextractor-ts source comments and READMEs be handled (e.g. "mirrors the Python `TrafilaturaConfig`", "the Python source supported them")?

## Options offered

- Delete every Python reference
- Keep references inside the engine package only
- Keep all current Python references

## User answer

User selected the third option with a clarifying note: **"Ok, of course, keep all the notes that ts-trafilatura is ported from Python package."**

## Implications for implementation

- Lineage references that document the port from Python `trafilatura` / `contextractor_engine` stay everywhere they currently appear — `README.md`, `CLAUDE.md`, `docs/spec/`, app READMEs, `packages/contextractor-engine/`, `.claude/agents/rust-pro.md`, etc.
- Only "current Python use" framing is removed (e.g. a doc that says "wraps a Python extraction engine" when the engine is now Rust-via-napi)
- The full inventory and classification lives in `../purge-python-notes/contextractor-ts-python-inventory.md`
