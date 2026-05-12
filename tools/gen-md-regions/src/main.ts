import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitters } from './emitters/index.js';
import { rewriteRegions } from './replacer.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'target', '.git', 'storage', '.actor']);
const SKIP_PATH_PREFIXES = ['prompts/', 'autonomous-task-output/'];

async function* walkMarkdown(root: string): AsyncIterable<string> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.claude') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      yield* walkMarkdown(full);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      yield full;
    }
  }
}

function isSkipped(repoRel: string): boolean {
  return SKIP_PATH_PREFIXES.some((p) => repoRel.startsWith(p));
}

async function processFile(file: string): Promise<{ changed: boolean }> {
  const text = await readFile(file, 'utf8');
  if (!text.includes('@generated:start name=')) return { changed: false };
  const next = rewriteRegions(text, { emitters, source: relative(repoRoot, file) });
  if (next === text) return { changed: false };
  await writeFile(file, next, 'utf8');
  return { changed: true };
}

async function main(): Promise<void> {
  const target = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : repoRoot;
  const targetStat = await stat(target);
  let touched = 0;

  async function tryProcess(file: string): Promise<void> {
    const repoRel = relative(repoRoot, file);
    if (isSkipped(repoRel)) return;
    const { changed } = await processFile(file);
    if (changed) {
      touched++;
      console.log(`updated ${repoRel}`);
    }
  }

  if (targetStat.isFile()) {
    await tryProcess(target);
  } else {
    for await (const file of walkMarkdown(target)) {
      await tryProcess(file);
    }
  }

  console.log(`gen-md-regions: ${touched} file(s) updated`);
}

await main();
