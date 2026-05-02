// Tiny Zod 4 walker. Reads only the nodes the prompt explicitly names
// (`shape`, `_zod.def.innerType`, `_zod.def.defaultValue`, `_zod.def.element`,
// `_zod.def.valueType`, `_zod.def.entries`) plus instanceof checks against
// the public class hierarchy. Anything we can't recognize falls back to
// `unknown`. Numeric integer-vs-float detection is delegated to the JSON
// Schema generator (`z.toJSONSchema`) so we never have to spelunk
// `_zod.def.checks` shapes.

import { z } from 'zod';

type WalkType =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'unknown' }
  | { kind: 'enum'; values: string[] }
  | { kind: 'array'; element: WalkType }
  | { kind: 'object'; fields: WalkField[] }
  | { kind: 'record'; value: WalkType };

interface WalkField {
  name: string;
  node: WalkNode;
}

interface WalkNode {
  type: WalkType;
  optional: boolean;
  defaulted: boolean;
  defaultValue?: unknown;
  description?: string;
  meta: Record<string, unknown>;
}

interface ZodLikeDef {
  innerType?: z.ZodType;
  defaultValue?: unknown;
  element?: z.ZodType;
  valueType?: z.ZodType;
  entries?: Record<string, string>;
}

function getDef(schema: z.ZodType): ZodLikeDef {
  const internal = (schema as unknown as { _zod?: { def?: ZodLikeDef } })._zod;
  return internal?.def ?? {};
}

function readMeta(schema: z.ZodType): Record<string, unknown> {
  const fn = (schema as unknown as { meta?: () => unknown }).meta;
  if (typeof fn !== 'function') return {};
  const value = fn.call(schema);
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readDescription(schema: z.ZodType): string | undefined {
  const direct = (schema as unknown as { description?: string }).description;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  const meta = readMeta(schema);
  const fromMeta = meta.description;
  return typeof fromMeta === 'string' ? fromMeta : undefined;
}

function walkNode(schema: z.ZodType): WalkNode {
  const meta = readMeta(schema);
  const description = readDescription(schema);

  if (schema instanceof z.ZodOptional) {
    const inner = getDef(schema).innerType;
    if (inner) {
      const child = walkNode(inner);
      return {
        ...child,
        optional: true,
        meta: { ...child.meta, ...meta },
        description: description ?? child.description,
      };
    }
  }

  if (schema instanceof z.ZodDefault) {
    const inner = getDef(schema).innerType;
    if (inner) {
      const child = walkNode(inner);
      const defaultRaw = getDef(schema).defaultValue;
      const defaultValue = typeof defaultRaw === 'function' ? defaultRaw() : defaultRaw;
      return {
        ...child,
        defaulted: true,
        defaultValue,
        meta: { ...child.meta, ...meta },
        description: description ?? child.description,
      };
    }
  }

  return {
    type: walkType(schema),
    optional: false,
    defaulted: false,
    description,
    meta,
  };
}

function walkType(schema: z.ZodType): WalkType {
  if (schema instanceof z.ZodString) return { kind: 'string' };
  if (schema instanceof z.ZodBoolean) return { kind: 'boolean' };
  if (schema instanceof z.ZodEnum) {
    const entries = getDef(schema).entries ?? {};
    return { kind: 'enum', values: Object.values(entries) };
  }
  if (schema instanceof z.ZodArray) {
    const elem = getDef(schema).element;
    return { kind: 'array', element: elem ? walkType(elem) : { kind: 'unknown' } };
  }
  if (schema instanceof z.ZodObject) {
    return {
      kind: 'object',
      fields: Object.entries(schema.shape).map(([name, child]) => ({
        name,
        node: walkNode(child as z.ZodType),
      })),
    };
  }
  if (schema instanceof z.ZodRecord) {
    const value = getDef(schema).valueType;
    return { kind: 'record', value: value ? walkType(value) : { kind: 'unknown' } };
  }
  if (schema instanceof z.ZodNumber) return { kind: 'number' };
  if (schema instanceof z.ZodUnknown) return { kind: 'unknown' };
  return { kind: 'unknown' };
}

export function renderTsType(t: WalkType): string {
  switch (t.kind) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'unknown':
      return 'unknown';
    case 'enum':
      return t.values.length === 0 ? 'string' : t.values.map((v) => `'${v}'`).join(' | ');
    case 'array':
      return `Array<${renderTsType(t.element)}>`;
    case 'record':
      return `Record<string, ${renderTsType(t.value)}>`;
    case 'object': {
      const inner = t.fields
        .map(({ name, node }) => `${name}${node.optional ? '?' : ''}: ${renderTsType(node.type)}`)
        .join('; ');
      return `{ ${inner} }`;
    }
  }
}

export function topLevelFields(schema: z.ZodObject): WalkField[] {
  const node = walkNode(schema);
  if (node.type.kind !== 'object') {
    throw new Error('topLevelFields requires a ZodObject schema');
  }
  return node.type.fields;
}

function findEnumNode(node: WalkNode): { values: string[]; node: WalkNode } | null {
  if (node.type.kind === 'enum') return { values: node.type.values, node };
  return null;
}
