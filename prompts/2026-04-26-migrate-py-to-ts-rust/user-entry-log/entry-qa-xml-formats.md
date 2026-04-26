**Q:** `rs-trafilatura` v0.1.1 advertises text / HTML / Markdown / JSON / metadata output. XML and XML-TEI parity with Python `trafilatura` is unclear. What does the engine do for XML / XML-TEI?

**A:** Drop until upstream supports.

**Implication:**
- Remove `xml` and `xmltei` from the supported-formats list everywhere they appear: input schema enums, output schema enums, dataset schema enums, CLI `--save` / `--format` choices, README format tables, engine API, type definitions, and tests.
- Supported formats become: `txt`, `markdown`, `json`, `html`.
- Document the gap once in the engine README and CLAUDE.md as "XML and XML-TEI temporarily unsupported pending upstream `rs-trafilatura` work — the Python source supported them via Trafilatura."
- Source repo's standalone CLI `FORMAT_EXTENSIONS` map currently includes `xml: .xml`, `xmltei: .tei.xml` — drop both entries when porting.
