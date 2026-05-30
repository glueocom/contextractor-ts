import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ContextractorInput,
  ContextractorOutput,
  writeApifyInputSchema,
  writeDatasetSchema,
  writeKeyValueStoreSchema,
  writeOutputSchema,
} from '@contextractor/schema';

// Resolve repo root by walking up from this file. In `src/main.ts` (run via
// tsx) `here` is `tools/gen-input-schema/src`; in `dist/main.js` (run via
// node) it is `tools/gen-input-schema/dist`. Either way, three levels up
// lands on the repo root, so the script works from any cwd, including under
// `pnpm -F @contextractor/gen-input-schema start` which cd's into the package.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const actorDir = resolve(repoRoot, 'apps/apify-actor/.actor');

// The input path is overridable via argv[2]; the dataset/output/kvs schemas
// always regenerate the repo's `.actor` files.
const inputOut = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(actorDir, 'input_schema.json');

function emit(outPath: string, write: (p: string) => void): void {
  write(outPath);
  execFileSync('pnpm', ['exec', 'biome', 'format', '--write', outPath], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  console.log(`Wrote ${outPath}`);
}

emit(inputOut, (p) => writeApifyInputSchema(ContextractorInput, p, { title: 'Contextractor' }));
emit(resolve(actorDir, 'dataset_schema.json'), (p) => writeDatasetSchema(ContextractorOutput, p));
emit(resolve(actorDir, 'output_schema.json'), (p) => writeOutputSchema(p));
emit(resolve(actorDir, 'key_value_store_schema.json'), (p) => writeKeyValueStoreSchema(p));
