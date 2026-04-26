# QA — XML / XML-TEI output formats

## Question

`rs-trafilatura` 0.2.2 only natively emits text, HTML, and Markdown — there is no XML or XML-TEI output. The Apify input schema (and CLAUDE.md / README) currently advertise XML and XML-TEI. How should the migration handle this gap?

## Answer

**Drop XML and XML-TEI.**

## Implication

- Remove `saveExtractedXmlToKeyValueStore` and `saveExtractedXmlTeiToKeyValueStore` from `apps/contextractor-apify/.actor/input_schema.json`.
- Remove `xml` and `xmltei` from any Rust `OutputFormat` enum.
- Update all README and CLAUDE.md mentions: supported formats are **HTML, TXT, JSON, Markdown** only.
- Update both `sync/docs.md` and `sync/gui.md` references that enumerate the XML / TEI variants.
- Source-repo Python schema (`/r/contextractor/.../input_schema.json`) keeps these toggles — propagate everything **except** the two XML/TEI booleans.
