import { log } from 'crawlee';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createContextractorCrawler } from './createCrawler.js';

// The warning fires before any crawler constructor — we only need log.warning to be spied on.
// Constructor errors thrown by Crawlee internals are caught and ignored in each test.

describe('blockMedia warning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits log.warning for cheerio when blockMedia is true', () => {
    const warnSpy = vi.spyOn(log, 'warning').mockImplementation(() => undefined);

    try {
      createContextractorCrawler({
        startUrls: ['https://example.com'],
        sink: async () => {},
        crawlerType: 'cheerio',
        blockMedia: true,
      });
    } catch {
      // constructor may throw outside test environment
    }

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('blockMedia has no effect with crawlerType: cheerio'),
    );
    warnSpy.mockRestore();
  });

  it('emits log.warning for playwright-firefox when blockMedia is true', () => {
    const warnSpy = vi.spyOn(log, 'warning').mockImplementation(() => undefined);

    try {
      createContextractorCrawler({
        startUrls: ['https://example.com'],
        sink: async () => {},
        crawlerType: 'playwright-firefox',
        blockMedia: true,
      });
    } catch {
      // constructor may throw outside test environment
    }

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('blockMedia has no effect with crawlerType: playwright-firefox'),
    );
    warnSpy.mockRestore();
  });

  it('does not emit log.warning for playwright-chromium when blockMedia is true', () => {
    const warnSpy = vi.spyOn(log, 'warning').mockImplementation(() => undefined);

    try {
      createContextractorCrawler({
        startUrls: ['https://example.com'],
        sink: async () => {},
        crawlerType: 'playwright-chromium',
        blockMedia: true,
      });
    } catch {
      // constructor may throw outside test environment
    }

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not emit log.warning for playwright-adaptive when blockMedia is true', () => {
    const warnSpy = vi.spyOn(log, 'warning').mockImplementation(() => undefined);

    try {
      createContextractorCrawler({
        startUrls: ['https://example.com'],
        sink: async () => {},
        crawlerType: 'playwright-adaptive',
        blockMedia: true,
      });
    } catch {
      // constructor may throw outside test environment
    }

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not emit log.warning when blockMedia is false', () => {
    const warnSpy = vi.spyOn(log, 'warning').mockImplementation(() => undefined);

    try {
      createContextractorCrawler({
        startUrls: ['https://example.com'],
        sink: async () => {},
        crawlerType: 'cheerio',
        blockMedia: false,
      });
    } catch {
      // constructor may throw outside test environment
    }

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
