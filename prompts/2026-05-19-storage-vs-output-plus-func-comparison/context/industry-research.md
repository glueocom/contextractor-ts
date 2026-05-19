# Industry Research: File Output vs Structured Storage for CLI Scrapers

## Verdict

Structured storage wins for programmatic use. `--output-dir` is idiomatic only for tools where the primary UX is "give me one file per URL on disk" — a simpler, non-programmatic workflow. For a multi-URL content extractor where users want to filter, paginate, and process results, a JSON dataset with a query CLI is strictly better.

## Crawlee / Apify

Crawlee's canonical local storage is `storage/datasets/default/` — sequentially numbered JSON files. The Apify CLI exposes `apify datasets ls`, `apify datasets get-items`, `apify datasets info`. This is the authoritative interface, not raw file reading. When running locally, `CRAWLEE_STORAGE_DIR` (default: `./storage`) is the single authoritative location; the framework does not write anywhere else.

## Industry Tool Comparison

- **Scrapy** uses a Feed Exports abstraction (`FEEDS` with URI schemes: `file://`, `s3://`, `gs://`, `stdout:`). Never writes directly to raw paths by default — always through a configurable backend.
- **trafilatura CLI** uses `--output-dir` / `-o` for single-URL or small-batch use. Primary mode is stdout for pipe-chaining.
- **pup / htmlq** write exclusively to stdout — designed for Unix pipe composition.
- **yt-dlp / gallery-dl / wget --recursive** use `--output` template patterns — but these are asset *download* tools where the output IS the file, a fundamentally different use case.

## CLI Design Principles

12-Factor CLI Apps and Thoughtworks CLI guidelines: stdout is your API for structured data; state belongs in a single clearly indicated directory. "Never concern itself with routing or storage of its output stream" — let the user pipe `contextractor list` output to `jq`, `grep`, or files as needed.

## Specific Verdict for Contextractor

Removing `output/` and routing everything through Crawlee's `storage/` is correct because:

1. It matches exactly what Crawlee/Apify produce locally — no parallel non-authoritative copy
2. `contextractor list` / `contextractor get` is the correct query interface, analogous to Scrapy feed exports
3. `output/` (flat files per URL) is idiomatic for single-purpose extraction tools (trafilatura), not for multi-URL crawlers with programmatic consumption
4. Users who want flat files can `contextractor list --format jsonl | jq -r '.markdown' > out.md` or similar

## Sources

- [Result Storage — Crawlee for JavaScript](https://crawlee.dev/js/docs/guides/result-storage)
- [Dataset API — Crawlee for JavaScript](https://crawlee.dev/js/api/core/class/Dataset)
- [Crawlee data storage blog](https://blog.apify.com/crawlee-data-storage-types/)
- [Apify CLI reference](https://docs.apify.com/cli/docs/reference)
- [Feed exports — Scrapy docs](https://docs.scrapy.org/en/latest/topics/feed-exports.html)
- [trafilatura CLI docs](https://trafilatura.readthedocs.io/en/latest/usage-cli.html)
- [12 Factor CLI Apps](https://medium.com/@jdxcode/12-factor-cli-apps-dd3c227a0e46)
- [Thoughtworks CLI design guidelines](https://www.thoughtworks.com/insights/blog/engineering-effectiveness/elevate-developer-experiences-cli-design-guidelines)
