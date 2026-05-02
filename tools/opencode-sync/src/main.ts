import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../..');

const claudeDir = join(repoRoot, '.claude');
const opencodeDir = join(repoRoot, '.opencode');
const claudeMd = join(repoRoot, 'CLAUDE.md');
const agentsMd = join(repoRoot, 'AGENTS.md');

// ---------------------------------------------------------------------------
// Frontmatter helpers
// ---------------------------------------------------------------------------

interface Parsed {
  fields: Map<string, string>;
  body: string;
}

function parseFrontmatter(content: string): Parsed | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;

  const fields = new Map<string, string>();
  for (const line of (match[1] ?? '').split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) fields.set(key, value);
  }

  return { fields, body: match[2] ?? '' };
}

function buildFrontmatter(fields: Map<string, string>, body: string): string {
  if (fields.size === 0) return body;
  const fm = [...fields.entries()].map(([k, v]) => `${k}: ${v}`).join('\n');
  return `---\n${fm}\n---\n${body}`;
}

// Strips Claude-specific agent fields (name, tools, model) and adds mode: subagent.
function transformAgentContent(content: string): string {
  const parsed = parseFrontmatter(content);
  if (!parsed) return content;

  const { fields, body } = parsed;
  const next = new Map<string, string>();

  const desc = fields.get('description');
  if (desc) next.set('description', desc);
  next.set('mode', 'subagent');

  return buildFrontmatter(next, body);
}

// Strips Claude-specific command fields (allowed-tools, argument-hint, model).
function transformCommandContent(content: string): string {
  const parsed = parseFrontmatter(content);
  if (!parsed) return content;

  const { fields, body } = parsed;
  const next = new Map<string, string>();

  const desc = fields.get('description');
  if (desc) next.set('description', desc);

  return buildFrontmatter(next, body);
}

// ---------------------------------------------------------------------------
// File-system helpers
// ---------------------------------------------------------------------------

async function* walk(dir: string, base: string = dir): AsyncIterable<[string, string]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full, base);
    } else {
      yield [full, relative(base, full)];
    }
  }
}

// ---------------------------------------------------------------------------
// Sync steps
// ---------------------------------------------------------------------------

async function syncAgents(): Promise<void> {
  const srcDir = join(claudeDir, 'agents');
  if (!existsSync(srcDir)) return;
  const destDir = join(opencodeDir, 'agents');
  await mkdir(destDir, { recursive: true });

  for await (const [srcPath, rel] of walk(srcDir)) {
    if (!srcPath.endsWith('.md')) continue;
    const content = await readFile(srcPath, 'utf8');
    await writeFile(join(destDir, rel), transformAgentContent(content), 'utf8');
    console.log(`  agent   ${rel}`);
  }
}

async function syncCommands(): Promise<void> {
  const srcDir = join(claudeDir, 'commands');
  if (!existsSync(srcDir)) return;
  const destDir = join(opencodeDir, 'commands');
  await mkdir(destDir, { recursive: true });

  for await (const [srcPath, rel] of walk(srcDir)) {
    if (!srcPath.endsWith('.md')) continue;
    const content = await readFile(srcPath, 'utf8');
    // Flatten subdirectory structure: "git/commit.md" → "git-commit.md"
    const flatName = rel.replace(/\//g, '-');
    await writeFile(join(destDir, flatName), transformCommandContent(content), 'utf8');
    console.log(`  command ${flatName}`);
  }
}

async function syncRules(): Promise<void> {
  const srcDir = join(claudeDir, 'rules');
  if (!existsSync(srcDir)) return;
  const destDir = join(opencodeDir, 'rules');
  await mkdir(destDir, { recursive: true });

  for await (const [srcPath, rel] of walk(srcDir)) {
    if (!srcPath.endsWith('.md')) continue;
    const content = await readFile(srcPath, 'utf8');
    const destPath = join(destDir, rel);
    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, content, 'utf8');
    console.log(`  rule    ${rel}`);
  }
}

async function syncAgentsMd(): Promise<void> {
  if (!existsSync(claudeMd)) return;
  const content = await readFile(claudeMd, 'utf8');
  await writeFile(agentsMd, content, 'utf8');
  console.log('  AGENTS.md');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Syncing .claude → .opencode\n');

  // Wipe and recreate .opencode/ for a clean sync
  if (existsSync(opencodeDir)) await rm(opencodeDir, { recursive: true, force: true });
  await mkdir(opencodeDir, { recursive: true });

  await syncAgents();
  await syncCommands();
  await syncRules();

  console.log('');
  await syncAgentsMd();

  console.log('\nDone.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
