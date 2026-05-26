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
    expect(parsed.renderingTypeDetectionPercentage).toBe(10);
    expect(parsed.waitUntil).toBe('load');
    expect(parsed.proxyRotation).toBe('recommended');
    expect(parsed.maxConcurrency).toBe(50);
    expect(parsed.maxRequestRetries).toBe(3);
    expect(parsed.pageLoadTimeoutSecs).toBe(60);
    expect(parsed.maxScrollHeightPixels).toBe(5000);
    expect(parsed.closeCookieModals).toBe(true);
    expect(parsed.save).toEqual(['markdown']);
    expect(parsed.saveDestination).toEqual(['key-value-store']);
  });

  it('rejects empty startUrls', () => {
    expect(() => ContextractorInput.parse({ startUrls: [] })).toThrow();
  });

  it('rejects unknown enum values', () => {
    expect(() =>
      ContextractorInput.parse({
        startUrls: [{ url: 'https://example.com' }],
        crawlerType: 'puppeteer',
      }),
    ).toThrow();
  });

  it('rejects negative maxPagesPerCrawl', () => {
    expect(() =>
      ContextractorInput.parse({
        startUrls: [{ url: 'https://example.com' }],
        maxPagesPerCrawl: -1,
      }),
    ).toThrow();
  });

  it('round-trips a representative Apify run payload', () => {
    const payload = {
      startUrls: [{ url: 'https://example.com' }],
      maxPagesPerCrawl: 5,
      maxCrawlingDepth: 2,
      headless: false,
      crawlerType: 'playwright-firefox' as const,
      renderingTypeDetectionPercentage: 20,
      waitUntil: 'networkidle' as const,
      proxyRotation: 'per-request' as const,
      maxScrollHeightPixels: 0,
      save: ['txt', 'original'] as const,
      saveDestination: ['dataset'] as const,
    };
    const parsed = ContextractorInput.parse(payload);
    expect(parsed.startUrls).toEqual(payload.startUrls);
    expect(parsed.maxPagesPerCrawl).toBe(5);
    expect(parsed.maxCrawlingDepth).toBe(2);
    expect(parsed.headless).toBe(false);
    expect(parsed.crawlerType).toBe('playwright-firefox');
    expect(parsed.renderingTypeDetectionPercentage).toBe(20);
    expect(parsed.waitUntil).toBe('networkidle');
    expect(parsed.proxyRotation).toBe('per-request');
    expect(parsed.maxScrollHeightPixels).toBe(0);
    expect(parsed.save).toEqual(['txt', 'original']);
    expect(parsed.saveDestination).toEqual(['dataset']);
  });
});
