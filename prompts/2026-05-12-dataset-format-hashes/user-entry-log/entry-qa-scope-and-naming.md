# Q&A: Scope and Field Naming

**Q: Which dataset sink(s) does this apply to?**
A: Both — `createApifySink` (apps/apify-actor/src/sinks.ts) and `createCrawleeStorageSink` (apps/standalone/src/sinks.ts).

**Q: How should per-format hashes appear in the dataset record?**
A: Separate parallel fields following the `originalHash` naming convention: `markdown + markdownHash`, `txt + txtHash`, `html + htmlHash`, `json + jsonHash`. For the original HTML format use `originalHash` (not `rawHtmlHash`).
