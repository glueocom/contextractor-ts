---
allowed-tools: Bash(apify:*), Bash(npm:*)
description: Run Actor locally for testing
---

Run the Actor locally with optional input.

## Steps

1. Check if input exists in `storage/key_value_stores/default/INPUT.json`
2. Run: `apify run`
3. Monitor output for errors
4. Check results in `storage/datasets/default/`

## With custom input

Create or update `storage/key_value_stores/default/INPUT.json` with test input before running.
