**Q:** How should direct `mcp__apify__*` tool calls (already loaded via `.mcp.json`) be treated in skill/agent docs?

**A:** Remove entirely.

Strip every `mcp__apify__*` example and reference. Agents must use `mcpc` from Bash. The `.mcp.json` file itself stays, but skill/agent prose no longer documents the native form as an option.
