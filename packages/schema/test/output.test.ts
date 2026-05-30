import { describe, expect, it } from 'vitest';
import { ContextractorOutput } from '../src/index.js';

const META = {
  title: 'Title',
  author: null,
  publishedAt: null,
  description: null,
  siteName: null,
  lang: 'en',
};

describe('ContextractorOutput discriminated union', () => {
  it('parses a success record with KVS-style ContentRef content', () => {
    const record = {
      url: 'https://example.com/page',
      loadedUrl: 'https://example.com/page',
      status: 'success',
      loadedAt: '2026-05-30T12:00:00Z',
      metadata: META,
      httpStatus: 200,
      crawl: { depth: 0, referrerUrl: null },
      original: {
        hash: 'a'.repeat(32),
        length: 89898,
        key: 'original-x.html',
        url: 'https://api/o',
      },
      markdown: { hash: 'b'.repeat(32), length: 123, key: 'markdown-x.md', url: 'https://api/x' },
    };
    expect(ContextractorOutput.parse(record)).toMatchObject({ status: 'success' });
  });

  it('parses a success record with inline-string content and per-format hashes', () => {
    const record = {
      url: 'https://example.com/page',
      loadedUrl: 'https://example.com/page',
      status: 'success',
      loadedAt: '2026-05-30T12:00:00Z',
      metadata: { ...META, title: null },
      httpStatus: 200,
      crawl: { depth: 2, referrerUrl: 'https://example.com/' },
      original: { hash: 'a'.repeat(32), length: 89898 },
      markdown: '# Inline',
      markdownHash: 'c'.repeat(32),
      txt: 'Inline',
      txtHash: 'd'.repeat(32),
    };
    expect(() => ContextractorOutput.parse(record)).not.toThrow();
  });

  it('parses a failed record whose loadedUrl is null', () => {
    const record = {
      url: 'https://example.com/x',
      loadedUrl: null,
      status: 'failed',
      errorMessages: ['boom'],
      retryCount: 3,
      crawledAt: '2026-05-30T12:00:00Z',
    };
    expect(() => ContextractorOutput.parse(record)).not.toThrow();
  });

  it('parses a skipped record and rejects an invalid skipReason', () => {
    expect(() =>
      ContextractorOutput.parse({ url: 'https://x', status: 'skipped', skipReason: 'robotsTxt' }),
    ).not.toThrow();
    expect(() =>
      ContextractorOutput.parse({ url: 'https://x', status: 'skipped', skipReason: 'nope' }),
    ).toThrow();
  });

  it('rejects an unknown status discriminator', () => {
    expect(() => ContextractorOutput.parse({ url: 'https://x', status: 'weird' })).toThrow();
  });
});
