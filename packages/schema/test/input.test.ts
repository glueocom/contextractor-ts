import { describe, expect, it } from 'vitest';
import { ContextractorInput } from '../src/index.js';

describe('ContextractorInput', () => {
  it('parses a minimal startUrls payload and fills defaults', () => {
    const parsed = ContextractorInput.parse({
      startUrls: [{ url: 'https://example.com' }],
    });
    expect(parsed.startUrls).toEqual([{ url: 'https://example.com' }]);
    expect(parsed.headless).toBe(true);
    expect(parsed.crawlerType).toBe('playwright-adaptive');
    expect(parsed.renderingTypeDetectionRatio).toBe(0.1);
    expect(parsed.waitUntil).toBe('load');
    expect(parsed.proxyRotation).toBe('recommended');
    expect(parsed.maxConcurrency).toBe(50);
    expect(parsed.maxRequestRetries).toBe(3);
    expect(parsed.navigationTimeoutSecs).toBe(60);
    expect(parsed.maxScrollHeight).toBe(5000);
    expect(parsed.closeCookieModals).toBe(true);
    expect(parsed.save).toEqual(['markdown']);
    expect(parsed.saveDestination).toEqual(['key-value-store']);
  });

  it('rejects empty startUrls', () => {
    expect(() => ContextractorInput.parse({ startUrls: [] })).toThrow();
  });

  it('rejects an empty saveDestination', () => {
    expect(() =>
      ContextractorInput.parse({
        startUrls: [{ url: 'https://example.com' }],
        saveDestination: [],
      }),
    ).toThrow();
  });

  it('rejects unknown enum values', () => {
    expect(() =>
      ContextractorInput.parse({
        startUrls: [{ url: 'https://example.com' }],
        crawlerType: 'puppeteer',
      }),
    ).toThrow();
  });

  it('rejects negative maxRequestsPerCrawl', () => {
    expect(() =>
      ContextractorInput.parse({
        startUrls: [{ url: 'https://example.com' }],
        maxRequestsPerCrawl: -1,
      }),
    ).toThrow();
  });

  it('rejects a renderingTypeDetectionRatio above 1', () => {
    expect(() =>
      ContextractorInput.parse({
        startUrls: [{ url: 'https://example.com' }],
        renderingTypeDetectionRatio: 1.5,
      }),
    ).toThrow();
  });

  it('round-trips a representative Apify run payload', () => {
    const payload = {
      startUrls: [{ url: 'https://example.com' }],
      maxRequestsPerCrawl: 5,
      maxCrawlDepth: 2,
      headless: false,
      crawlerType: 'playwright-firefox' as const,
      renderingTypeDetectionRatio: 0.2,
      waitUntil: 'networkidle' as const,
      proxyRotation: 'per-request' as const,
      maxScrollHeight: 0,
      save: ['txt', 'original'] as const,
      saveDestination: ['dataset'] as const,
    };
    const parsed = ContextractorInput.parse(payload);
    expect(parsed.startUrls).toEqual(payload.startUrls);
    expect(parsed.maxRequestsPerCrawl).toBe(5);
    expect(parsed.maxCrawlDepth).toBe(2);
    expect(parsed.headless).toBe(false);
    expect(parsed.crawlerType).toBe('playwright-firefox');
    expect(parsed.renderingTypeDetectionRatio).toBe(0.2);
    expect(parsed.waitUntil).toBe('networkidle');
    expect(parsed.proxyRotation).toBe('per-request');
    expect(parsed.maxScrollHeight).toBe(0);
    expect(parsed.save).toEqual(['txt', 'original']);
    expect(parsed.saveDestination).toEqual(['dataset']);
  });
});
