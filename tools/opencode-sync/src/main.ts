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
const opencodeJson = join(repoRoot, 'opencode.json');
const mcpJson = join(repoRoot, '.mcp.json');

// Default config written to opencode.json on first run.
// On subsequent runs existing fields are preserved; only mcp + instructions are updated.
const DEFAULT_MODEL_CONFIG = {
  $schema: 'https://opencode.ai/config.json',
  model: 'azure/gpt-5.4',
  small_model: 'azure/gpt-5.4-mini',
  provider: {
    azure: {
      options: {
        apiKey: '{env:AZURE_OPENAI_KEY}',
        baseURL: 'https://glueo-se.openai.azure.com/openai',
        resourceName: 'glueo-se',
        apiVersion: 'preview',
      },
      models: {
        'gpt-5.4': {
          name: 'GPT-5.4',
          limit: { context: 272000, output: 32000 },
          reasoningEffort: 'high',
        },
        'gpt-5.4-mini': {
          name: 'GPT-5.4 mini',
          limit: { context: 272000, output: 32000 },
        },
      },
    },
  },
};

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

async function syncRules(): Promise<string[]> {
  const srcDir = join(claudeDir, 'rules');
  if (!existsSync(srcDir)) return [];
  const destDir = join(opencodeDir, 'rules');
  await mkdir(destDir, { recursive: true });

  const instructionPaths: string[] = [];
  for await (const [srcPath, rel] of walk(srcDir)) {
    if (!srcPath.endsWith('.md')) continue;
    const content = await readFile(srcPath, 'utf8');
    const destPath = join(destDir, rel);
    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, content, 'utf8');
    instructionPaths.push(`.opencode/rules/${rel}`);
    console.log(`  rule    ${rel}`);
  }
  return instructionPaths;
}

async function syncAgentsMd(): Promise<void> {
  if (!existsSync(claudeMd)) return;
  const content = await readFile(claudeMd, 'utf8');
  await writeFile(agentsMd, content, 'utf8');
  console.log('  AGENTS.md');
}

// ---------------------------------------------------------------------------
// MCP conversion: Claude .mcp.json → opencode mcp block
// ---------------------------------------------------------------------------

interface McpEntry {
  type: string;
  url?: string;
  command?: string[];
  enabled?: boolean;
  timeout?: number;
  environment?: Record<string, string>;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

async function readMcp(): Promise<Record<string, McpEntry>> {
  if (!existsSync(mcpJson)) return {};
  const raw = await readFile(mcpJson, 'utf8');
  const parsed = JSON.parse(raw) as { mcpServers?: Record<string, McpEntry> };
  if (!parsed.mcpServers) return {};

  const result: Record<string, McpEntry> = {};
  for (const [name, server] of Object.entries(parsed.mcpServers)) {
    // Claude uses type "http" for remote HTTP servers; opencode uses "remote"
    result[name] = { ...server, type: server.type === 'http' ? 'remote' : server.type };
  }
  return result;
}

// ---------------------------------------------------------------------------
// opencode.json generation
// ---------------------------------------------------------------------------

async function syncOpencodeJson(instructionPaths: string[]): Promise<void> {
  let existing: Record<string, unknown> = {};
  if (existsSync(opencodeJson)) {
    existing = JSON.parse(await readFile(opencodeJson, 'utf8')) as Record<string, unknown>;
  }

  const mcp = await readMcp();

  // Preserve any user edits to model/provider config; always refresh mcp + instructions.
  const config = { ...DEFAULT_MODEL_CONFIG, ...existing, mcp, instructions: instructionPaths };
  await writeFile(opencodeJson, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  console.log('  opencode.json');
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
  const instructionPaths = await syncRules();

  console.log('');
  await syncAgentsMd();
  await syncOpencodeJson(instructionPaths);

  console.log('\nDone.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
