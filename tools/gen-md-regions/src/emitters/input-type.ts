import { ContextractorInput } from '@contextractor/schema';
import { renderTsType, topLevelFields } from '../zod-walk.js';

export function emitInputType(): string {
  const fields = topLevelFields(ContextractorInput);
  const lines: string[] = [];
  lines.push('```ts');
  lines.push('interface ContextractorInputType {');
  for (const field of fields) {
    const optional = field.node.optional ? '?' : '';
    lines.push(`  ${field.name}${optional}: ${renderTsType(field.node.type)};`);
  }
  lines.push('}');
  lines.push('```');
  return lines.join('\n');
}
