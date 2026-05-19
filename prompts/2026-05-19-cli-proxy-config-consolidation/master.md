# CLI Proxy Config Consolidation — Master

> **TLDR**: Orchestration prompt. Executes three implementation prompts in sequence (proxy flag removal, CLI usability fixes, schema/waitUntil cleanup), then validates everything with local tests, proxy rotation tests, and an Apify platform deploy.

> **Note:** This is a greenfield project — no backward compatibility requirements.

Read and execute each prompt file in sequence. Do not start the next step until the current one completes without errors.

---

## Step PROXY-REMOVAL: Remove Proxy Tier Flags

Read and execute:

```
prompts/2026-05-19-cli-proxy-config-consolidation/implement.md
```

Removes `--proxy-tier` and `--proxy-tiers` from the CLI. Tiered proxy config moves to `tieredProxyUrls` in the JSON config file.

---

## Step CLI-REVIEW: CLI Usability Fixes

Read and execute after PROXY-REMOVAL completes:

```
prompts/2026-05-19-cli-proxy-config-consolidation/review-all-commands.md
```

Fixes undocumented defaults, renames `--exclusive-start-key` to `--after`, adds security notes to `--cookies`/`--headers`.

---

## Step SCHEMA-REVIEW: Global Schema and CLI Consistency

Read and execute after CLI-REVIEW completes:

```
prompts/2026-05-19-cli-proxy-config-consolidation/global-schema-cli-review.md
```

Changes `waitUntil` enum to lowercase, removes `WAIT_UNTIL_MAP`, adds CLI flag → config key mapping to README.

---

## Step TEST: Full Validation Suite

Read and execute after all implementation steps complete:

```
prompts/2026-05-19-cli-proxy-config-consolidation/test-all.md
```

Runs local build + tests, proxy rotation tests (via `/proxy-test`), and Apify platform deploy + test crawl (via `/platform:deploy-and-test`). Autofixes all failures.
