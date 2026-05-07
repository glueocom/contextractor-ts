import type { ContextractorInputType } from '@contextractor/schema';
import { describe, expect, it } from 'vitest';
import { buildCrawlerOpts } from './config.js';

const BASE_INPUT: ContextractorInputType = {
  startUrls: [{ url: 'https://example.com' }],
  globs: [],
  excludes: [],
  pseudoUrls: [],
  linkSelector: '',
  keepUrlFragments: false,
  respectRobotsTxtFile: false,
  maxPagesPerCrawl: 0,
  maxResultsPerCrawl: 0,
  maxCrawlingDepth: 0,
  maxConcurrency: 50,
  maxRequestRetries: 3,
  headless: true,
  launcher: 'CHROMIUM',
  waitUntil: 'LOAD',
  proxyRotation: 'RECOMMENDED',
  pageLoadTimeoutSecs: 60,
  ignoreCorsAndCsp: false,
  closeCookieModals: true,
  maxScrollHeightPixels: 5000,
  userAgent: '',
  ignoreSslErrors: false,
  debugLog: false,
  browserLog: false,
  save: ['markdown'],
  saveDestination: ['key-value-store'],
};

const FAKE_SINK = async () => {};

describe('buildCrawlerOpts format derivation', () => {
  it('save: ["txt", "json"] → formats is ["txt", "json"]', () => {
    const input: ContextractorInputType = { ...BASE_INPUT, save: ['txt', 'json'] };
    const opts = buildCrawlerOpts(input, FAKE_SINK);
    expect(opts.formats).toEqual(['txt', 'json']);
  });

  it('save: ["original"] → original filtered out → falls back to ["markdown"]', () => {
    const input: ContextractorInputType = { ...BASE_INPUT, save: ['original'] };
    const opts = buildCrawlerOpts(input, FAKE_SINK);
    expect(opts.formats).toEqual(['markdown']);
  });

  it('save: ["txt", "original", "json"] → original filtered out → formats is ["txt", "json"]', () => {
    const input: ContextractorInputType = { ...BASE_INPUT, save: ['txt', 'original', 'json'] };
    const opts = buildCrawlerOpts(input, FAKE_SINK);
    expect(opts.formats).toEqual(['txt', 'json']);
  });
});
