import { ContextractorInput } from '@contextractor/schema';
import { topLevelFields } from '../zod-walk.js';

export function emitEnumValues(): string {
  const fields = topLevelFields(ContextractorInput);
  const sections: string[] = [];

  for (const field of fields) {
    if (field.node.type.kind !== 'enum') continue;
    const titles = readEnumTitles(field.node.meta);
    const values = field.node.type.values;
    const def =
      field.node.defaulted && typeof field.node.defaultValue === 'string'
        ? ` (default \`${field.node.defaultValue}\`)`
        : '';

    sections.push(`### \`${field.name}\`${def}`);
    sections.push('');
    sections.push('| Value | Title |');
    sections.push('|-------|-------|');
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const title = titles[i] ?? '';
      sections.push(`| \`${value}\` | ${title} |`);
    }
    sections.push('');
  }

  return sections.join('\n').trimEnd();
}

function readEnumTitles(meta: Record<string, unknown>): string[] {
  const raw = meta.enumTitles;
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => (typeof v === 'string' ? v : ''));
}
