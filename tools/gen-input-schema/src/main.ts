import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContextractorInput, writeApifyInputSchema } from '@contextractor/schema';

// Resolve repo root by walking up from this file. In `src/main.ts` (run via
// tsx) `here` is `tools/gen-input-schema/src`; in `dist/main.js` (run via
// node) it is `tools/gen-input-schema/dist`. Either way, three levels up
// lands on the repo root, so the script works from any cwd, including under
// `pnpm -F @contextractor/gen-input-schema start` which cd's into the package.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const out = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(repoRoot, 'apps/contextractor-apify/.actor/input_schema.json');

writeApifyInputSchema(ContextractorInput, out, { title: 'Contextractor' });
execFileSync('npm', ['exec', '--', 'biome', 'format', '--write', out], {
  cwd: repoRoot,
  stdio: 'inherit',
});
console.log(`Wrote ${out}`);
