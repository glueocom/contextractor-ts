import { program } from '@contextractor/standalone';
import type { Option } from 'commander';

const MULTI_LINE_RE = /\s*\n\s*/g;

export function emitCliFlags(): string {
  const rows: string[] = [];
  rows.push('| Option | Description |');
  rows.push('|--------|-------------|');

  for (const option of program.options) {
    rows.push(`| ${formatFlags(option)} | ${formatDescription(option.description)} |`);
  }

  return rows.join('\n');
}

function formatFlags(option: Option): string {
  const parts: string[] = [];
  if (option.long) parts.push(`\`${option.long}\``);
  if (option.short) parts.push(`\`${option.short}\``);
  return parts.join(', ') || `\`${option.flags}\``;
}

function formatDescription(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(MULTI_LINE_RE, ' ').replace(/\|/g, '\\|').trim();
}
