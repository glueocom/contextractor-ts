import { ContextractorInput, toApifyInputSchema } from '@contextractor/schema';

const MULTI_LINE_RE = /\s*\n\s*/g;

export function emitApifyInputSchema(): string {
  const schema = toApifyInputSchema(ContextractorInput, { title: 'Contextractor' });
  const required = new Set(schema.required ?? []);

  const rows: string[] = [];
  rows.push('| Field | Type | Default | Description |');
  rows.push('|-------|------|---------|-------------|');

  for (const [name, prop] of Object.entries(schema.properties)) {
    const type = formatType(prop);
    const def = formatDefault(prop, required.has(name));
    const desc = formatDescription(prop.description);
    rows.push(`| \`${name}\` | ${type} | ${def} | ${desc} |`);
  }

  return rows.join('\n');
}

function formatType(prop: Record<string, unknown>): string {
  const t = typeof prop.type === 'string' ? prop.type : 'any';
  const editor = typeof prop.editor === 'string' ? prop.editor : undefined;
  if (editor === 'select' && Array.isArray(prop.enum)) {
    const values = prop.enum.map((v) => `\`${String(v)}\``).join(' \\| ');
    return `enum (${values})`;
  }
  if (t === 'integer') return 'integer';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  if (t === 'string') return 'string';
  if (t === 'array') return 'array';
  if (t === 'object') return 'object';
  return t;
}

function formatDefault(prop: Record<string, unknown>, isRequired: boolean): string {
  if (isRequired) return '_required_';
  if (!('default' in prop)) return '_optional_';
  const value = prop.default;
  if (value === null) return '`null`';
  if (Array.isArray(value)) return value.length === 0 ? '`[]`' : `\`${JSON.stringify(value)}\``;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    return keys.length === 0 ? '`{}`' : `\`${JSON.stringify(value)}\``;
  }
  if (typeof value === 'string') return value === '' ? '`""`' : `\`"${value}"\``;
  return `\`${String(value)}\``;
}

function formatDescription(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const oneLine = raw.replace(MULTI_LINE_RE, ' ').trim();
  return escapePipes(truncate(oneLine, 200));
}

function escapePipes(s: string): string {
  return s.replace(/\|/g, '\\|');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}
