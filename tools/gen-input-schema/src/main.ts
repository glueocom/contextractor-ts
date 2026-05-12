import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ContextractorInput,
  ContextractorOutput,
  writeApifyInputSchema,
} from '@contextractor/schema';
import { z } from 'zod';

// Resolve repo root by walking up from this file. In `src/main.ts` (run via
// tsx) `here` is `tools/gen-input-schema/src`; in `dist/main.js` (run via
// node) it is `tools/gen-input-schema/dist`. Either way, three levels up
// lands on the repo root, so the script works from any cwd, including under
// `pnpm -F @contextractor/gen-input-schema start` which cd's into the package.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const out = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(repoRoot, 'apps/apify-actor/.actor/input_schema.json');

writeApifyInputSchema(ContextractorInput, out, { title: 'Contextractor' });
execFileSync('pnpm', ['exec', 'biome', 'format', '--write', out], {
  cwd: repoRoot,
  stdio: 'inherit',
});
console.log(`Wrote ${out}`);

// Generate dataset_schema.json from the output Zod schema.
const datasetOut = resolve(repoRoot, 'apps/apify-actor/.actor/dataset_schema.json');
writeDatasetSchema(ContextractorOutput, datasetOut);
execFileSync('pnpm', ['exec', 'biome', 'format', '--write', datasetOut], {
  cwd: repoRoot,
  stdio: 'inherit',
});
console.log(`Wrote ${datasetOut}`);

function writeDatasetSchema(schema: z.ZodObject<Record<string, z.ZodTypeAny>>, outPath: string): void {
  const jsonSchema = z.toJSONSchema(schema, {
    target: 'draft-07',
    unrepresentable: 'any',
    reused: 'inline',
  });

  const sourceProperties =
    (jsonSchema as { properties?: Record<string, unknown> }).properties ?? {};

  const fields: Record<string, Record<string, unknown>> = {};
  for (const [name, raw] of Object.entries(sourceProperties)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const prop = raw as Record<string, unknown>;
    const field: Record<string, unknown> = {};

    // Map JSON Schema type to Apify dataset field type
    const jsonType = prop.type;
    if (jsonType === 'string') field.type = 'string';
    else if (jsonType === 'integer') field.type = 'integer';
    else if (jsonType === 'number') field.type = 'number';
    else if (jsonType === 'boolean') field.type = 'boolean';
    else if (jsonType === 'array') field.type = 'array';
    else field.type = 'object'; // objects, unions, etc.

    if (prop.title) field.title = prop.title;
    if (prop.description) field.description = prop.description;

    fields[name] = field;
  }

  const datasetSchema = {
    actorSpecification: 1,
    fields,
    views: {
      overview: {
        title: 'Overview',
        transformation: {
          fields: ['loadedUrl', 'httpStatus', 'metadata.title', 'metadata.lang'],
        },
        display: {
          component: 'table',
          properties: {
            loadedUrl: { label: 'URL', format: 'link' },
            httpStatus: { label: 'Status', format: 'number' },
            'metadata.title': { label: 'Title', format: 'text' },
            'metadata.lang': { label: 'Language', format: 'text' },
          },
        },
      },
    },
  };

  writeFileSync(outPath, `${JSON.stringify(datasetSchema, null, 2)}\n`, 'utf8');
}
