---
description: Update the docs version timestamp in README.md
---

Update the docs version timestamp in the repo-root Contextractor `README.md`
file to the current UTC datetime.

## Steps

- Get the current UTC datetime using bash: `date -u +"%Y-%m-%dT%H:%M:%SZ"`
- Read the file `README.md`
- Update the "Docs version" section at the end of the file with the current UTC timestamp
- Report the updated timestamp

The docs version section format:
```
## Docs version
YYYY-MM-DDTHH:MM:SSZ
```
