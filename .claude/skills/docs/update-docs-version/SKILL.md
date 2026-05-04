---
name: docs:update-docs-version
description: WHEN updating the docs version timestamp in README.md after documentation changes have been made. WHEN-NOT if no documentation changed in the current session.
allowed-tools: Bash(date:*), Read, Edit
model: haiku
disable-model-invocation: true
---

Update the docs version timestamp in the repo-root Contextractor `README.md`
file to the current UTC datetime.

## Steps

1. Get the current UTC datetime using bash: `date -u +"%Y-%m-%dT%H:%M:%SZ"`
2. Read the file `README.md`
3. Update the "Docs version" section at the end of the file with the current UTC timestamp
4. Report the updated timestamp

The docs version section format:
```
## Docs version
YYYY-MM-DDTHH:MM:SSZ
```
