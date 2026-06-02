import type { ContextractorInputType } from '@contextractor/schema';
import { describe, expect, it } from 'vitest';
import { buildCrawlerOpts } from './config.js';

const BASE_INPUT: ContextractorInputType = {
  startUrls: [{ url: 'https://example.com' }],
  globs: [],
  exclude: [],
  selector: '',
  keepUrlFragment: false,
  respectRobotsTxtFile: false,
  maxRequestsPerCrawl: 0,
  maxResultsPerCrawl: 0,
  maxCrawlDepth: 0,
  maxConcurrency: 50,
  maxRequestRetries: 3,
  headless: true,
  crawlerType: 'playwright-adaptive',
  renderingTypeDetectionRatio: 0.1,
  waitUntil: 'load',
  proxyRotation: 'recommended',
  maxSessionRotations: 10,
  navigationTimeoutSecs: 60,
  ignoreCorsAndCsp: false,
  closeCookieModals: true,
  maxScrollHeight: 5000,
  userAgent: '',
  ignoreHttpsErrors: false,
  blockMedia: false,
  waitForSelector: '',
  softWaitForSelector: '',
  waitForDynamicContentSecs: 0,
  useSitemaps: false,
  initialConcurrency: 0,
  deduplication: 'url',
  storeSkippedUrls: false,
  mode: 'balanced',
  includeComments: true,
  includeTables: true,
  includeImages: false,
  includeLinks: true,
  languageCode: '',
  save: ['markdown'],
  saveDestination: ['key-value-store'],
};

const FAKE_SINK = async () => {};

describe('buildCrawlerOpts blockMedia pass-through', () => {
  it('passes blockMedia: false by default', () => {
    const opts = buildCrawlerOpts(BASE_INPUT, FAKE_SINK);
    expect(opts.blockMedia).toBe(false);
  });

  it('passes blockMedia: true when set', () => {
    const input: ContextractorInputType = { ...BASE_INPUT, blockMedia: true };
    const opts = buildCrawlerOpts(input, FAKE_SINK);
    expect(opts.blockMedia).toBe(true);
  });
});

describe('buildCrawlerOpts deduplication pass-through', () => {
  it.each(['none', 'url', 'content-hash'] as const)('passes deduplication: "%s"', (level) => {
    const input: ContextractorInputType = { ...BASE_INPUT, deduplication: level };
    const opts = buildCrawlerOpts(input, FAKE_SINK);
    expect(opts.deduplication).toBe(level);
  });
});

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
