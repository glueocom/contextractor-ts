/**
 * Programmatic usage of @contextractor/standalone as a Node.js library.
 *
 * @contextractor/standalone exports buildProgram() which returns the Commander
 * program. This lets you drive extraction from Node.js code rather than the
 * shell, keeping the full option surface available without shelling out.
 *
 * Run:
 *   npm install
 *   npx tsx src/main.ts
 */

import { buildProgram } from '@contextractor/standalone';

const TARGET_URL = 'https://blog.apify.com/what-is-web-scraping/';
const STORAGE_DIR = './storage';

/**
 * Extract a URL and write results to the local dataset.
 * stdout output is suppressed — items are written to STORAGE_DIR/datasets/default/.
 */
async function extract(url: string, storageDir: string): Promise<void> {
  const program = buildProgram();

  // exitOverride() converts process.exit() calls into CommanderError throws,
  // keeping control inside this function instead of terminating the process.
  program.exitOverride();

  try {
    await program.parseAsync([
      process.argv[0] ?? 'node',
      process.argv[1] ?? 'main.ts',
      'extract',
      url,
      '--save', 'markdown',
      '--storage-dir', storageDir,
      '--no-stdout',
    ]);
  } catch (err) {
    const exitCode = (err as { exitCode?: number }).exitCode ?? 1;
    if (exitCode !== 0) {
      throw new Error(
        `Extraction failed (exit ${exitCode}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/**
 * List items from the default dataset and print them to stdout.
 * Uses the `list` subcommand which streams NDJSON when format=jsonl.
 */
async function listDataset(storageDir: string): Promise<void> {
  const program = buildProgram();
  program.exitOverride();

  try {
    await program.parseAsync([
      process.argv[0] ?? 'node',
      process.argv[1] ?? 'main.ts',
      'list',
      '--storage-dir', storageDir,
      '--format', 'json',
    ]);
  } catch (err) {
    const exitCode = (err as { exitCode?: number }).exitCode ?? 1;
    if (exitCode !== 0) {
      throw new Error(
        `List failed (exit ${exitCode}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

async function main(): Promise<void> {
  console.error(`Extracting: ${TARGET_URL}`);
  console.error(`Storage: ${STORAGE_DIR}`);

  await extract(TARGET_URL, STORAGE_DIR);

  console.error('\n--- Dataset items ---');
  await listDataset(STORAGE_DIR);
}

await main();
