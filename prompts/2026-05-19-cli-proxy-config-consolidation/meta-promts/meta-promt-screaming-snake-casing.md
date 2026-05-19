create a new step, reference it before the test step at `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-19-cli-proxy-config-consolidation/master.md`
the new step must convert ar enum like items in the schemas like  to `SCREAMING_SNAKE_CASE`

example 
```
  --deduplication <level>              Deduplication level: minimal, basic (default), or full (choices: "minimal", "basic", "full")
```

must be

```
  --deduplication <level>              Deduplication level: minimal, basic (default), or full (choices: "MINIMAL", "BASIC", "FULL")
```


  look and fix in actor schemas
  '/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/.actor/input_schema.json'
  '/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/.actor/output_schema.json'

  look and fix on schema
  '/Users/miroslavsekera/r/contextractor-ts/packages/schema/src/apify/apify-meta.ts'
  '/Users/miroslavsekera/r/contextractor-ts/packages/schema/src/source-of-truth/input.ts'
  '/Users/miroslavsekera/r/contextractor-ts/packages/schema/src/source-of-truth/output.ts'


rererence the new promt in `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-19-cli-proxy-config-consolidation/master.md`

add a tldr to the new promnt

 to all promts, add notes that it is a greenfield project, no backward compatibility
  alter promts to that if required


