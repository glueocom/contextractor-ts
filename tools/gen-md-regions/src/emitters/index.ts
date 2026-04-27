import { emitApifyInputSchema } from './apify-input-schema.js';
import { emitCliFlags } from './cli-flags.js';
import { emitEnumValues } from './enum-values.js';
import { emitInputType } from './input-type.js';

export const emitters: Record<string, () => string> = {
  'apify-input-schema': emitApifyInputSchema,
  'cli-flags': emitCliFlags,
  'input-type': emitInputType,
  'enum-values': emitEnumValues,
};
