# Apify CLI Reference

CLI commands for local development and for remote operations not exposed by `mcp.apify.com`. For mcpc-supported remote operations (search Actors, fetch Actor details, call an Actor, get a single run, get run output, search/fetch docs), see `mcpc-tools.md`.

## Prerequisites

```bash
npm install -g apify-cli                                   # Install
apify login                                                # Authenticate
apify info                                                 # Verify
```

## Local Development

```bash
apify run                                                  # Run the Actor locally
apify validate-schema .actor/input_schema.json             # Validate a schema file
apify create <name> -t <template>                          # Scaffold a new Actor
```

Templates: `project_empty` (JS), `ts_empty` (TS), `python-empty` (Python).

## Deployment

```bash
apify push                                                 # Build + deploy
apify push --no-build                                      # Deploy without rebuilding
```

## Identity

```bash
apify info                                                 # Current Actor + user info
apify auth token                                           # Print stored API token
```

## Remote Operations (no mcpc equivalent)

### Runs

```bash
apify runs ls <actorId>                                    # List runs
apify runs info <runId>                                    # Run details
apify runs log <runId>                                     # Stream run log
apify runs abort <runId>                                   # Abort a running run
```

### Builds

```bash
apify builds ls --limit 5                                  # List builds
apify builds info <buildId>                                # Build details
apify builds log <buildId>                                 # Build log
apify builds create --tag latest --log                     # Trigger a new build
apify builds add-tag -b <buildId> -t latest                # Tag a build
apify builds remove-tag -b <buildId> -t beta
```

### Datasets

```bash
apify datasets ls                                          # List datasets
apify datasets get-items <id>                              # Download items
apify ds get-items <id>                                    # Alias
```

### Key-value stores

```bash
apify key-value-stores ls
apify key-value-stores get-value <id> <key>
apify kvs ls                                               # Alias
```

### Actor catalog

```bash
apify actors search <query>                                # Search Apify Store (mcpc: search-actors)
apify actors calculate-memory                              # Suggest memory for the Actor
```

## Common Patterns

### Wait for the latest build to finish

```bash
apify builds ls --limit 1
apify builds info <buildId>                                # check .status field
```

### View build errors

```bash
apify builds log <buildId> | tail -100
```

## Troubleshooting

```bash
apify logout && apify login                                # Re-auth
echo $APIFY_TOKEN                                          # Verify env var (used by SDK clients)
apify upgrade                                              # Self-update CLI
```
