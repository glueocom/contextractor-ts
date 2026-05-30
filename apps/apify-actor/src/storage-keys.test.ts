import { type ContentKind, kvsKey } from '@contextractor/crawler';
import { KvsCollections } from '@contextractor/schema';
import { describe, expect, it } from 'vitest';

// Guards the coupling between the runtime KVS key scheme (`kvsKey` in the shared
// crawler sink core) and the generated key_value_store_schema.json collections
// (driven by `KvsCollections`). If the prefixes drift, the Console collections
// would no longer match the keys actually written.
describe('KVS key prefixes match the key_value_store schema collections', () => {
  const url = 'https://example.com/page';
  const cases: Array<[ContentKind, string]> = [
    ['txt', KvsCollections.collections.txt.keyPrefix],
    ['markdown', KvsCollections.collections.markdown.keyPrefix],
    ['json', KvsCollections.collections.json.keyPrefix],
    ['html', KvsCollections.collections.html.keyPrefix],
    ['original', KvsCollections.collections.original.keyPrefix],
  ];

  it.each(cases)('kvsKey(%s) starts with the collection keyPrefix', (kind, prefix) => {
    expect(kvsKey(kind, url).startsWith(prefix)).toBe(true);
  });
});
