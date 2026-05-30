import { ContextractorInput } from '@contextractor/schema';
import { describe, expect, it } from 'vitest';
import { buildProgram } from './cliProgram.js';
import { buildCrawlConfig, validateSaveFormats } from './config.js';

describe('config helpers', () => {
  it('buildCrawlConfig produces balanced defaults from a minimal startUrls payload', () => {
    const input = ContextractorInput.parse({ startUrls: [{ url: 'https://example.com' }] });
    const cfg = buildCrawlConfig(input, {
      urls: ['https://example.com'],
      save: ['markdown'],
      proxyUrls: [],
    });

    expect(cfg.save).toEqual(['markdown']);
    expect(cfg.initialConcurrency).toBe(0);
    expect(cfg.maxConcurrency).toBe(50);
    expect(cfg.headless).toBe(true);
    expect(cfg.crawlerType).toBe('playwright-adaptive');
    expect(cfg.renderingTypeDetectionPercentage).toBe(10);
    expect(cfg.waitUntil).toBe('load');
    expect(cfg.maxPages).toBe(0);
    expect(cfg.crawlDepth).toBe(0);
    expect(cfg.maxScrollHeight).toBe(5000);
    expect(cfg.closeCookieModals).toBe(true);
    expect(cfg.urls).toEqual(['https://example.com']);
  });

  it('validateSaveFormats accepts the documented set', () => {
    expect(validateSaveFormats(['markdown', 'html'])).toEqual(['markdown', 'html']);
  });

  it('validateSaveFormats expands `all`', () => {
    const formats = validateSaveFormats(['all']);
    expect(formats.sort()).toEqual(['html', 'json', 'markdown', 'original', 'txt']);
  });

  it('validateSaveFormats accepts `txt`', () => {
    expect(validateSaveFormats(['txt'])).toEqual(['txt']);
  });

  it('validateSaveFormats rejects `text` (alias removed)', () => {
    expect(() => validateSaveFormats(['text'])).toThrow(/Unknown save format/);
  });

  it('validateSaveFormats accepts `original`', () => {
    expect(validateSaveFormats(['original'])).toEqual(['original']);
  });

  it('validateSaveFormats rejects unknown values', () => {
    const rejected = ['gibberish', 'pdf', 'rss'];
    for (const r of rejected) {
      expect(() => validateSaveFormats([r])).toThrow(/Unknown save format/);
    }
  });
});

function getExtractOptions(program: ReturnType<typeof buildProgram>): (string | undefined)[] {
  const extract = program.commands.find((c) => c.name() === 'extract');
  return extract?.options.map((o) => o.long) ?? [];
}

describe('buildProgram — --store-skipped-urls flag', () => {
  it('is a recognized option on the extract subcommand', () => {
    const program = buildProgram();
    expect(getExtractOptions(program)).toContain('--store-skipped-urls');
  });
});

describe('buildProgram — --wait-for-selector flag', () => {
  it('is a recognized option on the extract subcommand', () => {
    const program = buildProgram();
    expect(getExtractOptions(program)).toContain('--wait-for-selector');
  });
});

describe('buildProgram — --soft-wait-for-selector flag', () => {
  it('is a recognized option on the extract subcommand', () => {
    const program = buildProgram();
    expect(getExtractOptions(program)).toContain('--soft-wait-for-selector');
  });
});

describe('buildProgram — --dynamic-content-wait flag', () => {
  it('is a recognized option on the extract subcommand', () => {
    const program = buildProgram();
    expect(getExtractOptions(program)).toContain('--dynamic-content-wait');
  });
});

describe('buildProgram — --use-sitemaps flag', () => {
  it('is a recognized option on the extract subcommand', () => {
    const program = buildProgram();
    expect(getExtractOptions(program)).toContain('--use-sitemaps');
  });
});

describe('buildProgram — --initial-concurrency flag', () => {
  it('is a recognized option on the extract subcommand', () => {
    const program = buildProgram();
    expect(getExtractOptions(program)).toContain('--initial-concurrency');
  });
});

describe('buildProgram — --deduplication flag', () => {
  it('is a recognized option on the extract subcommand', () => {
    const program = buildProgram();
    expect(getExtractOptions(program)).toContain('--deduplication');
  });
  it.each(['none', 'url', 'content-hash'])('accepts "%s" as a valid choice', (level) => {
    const program = buildProgram();
    const extract = program.commands.find((c) => c.name() === 'extract');
    const opt = extract?.options.find((o) => o.long === '--deduplication');
    expect(opt?.argChoices).toContain(level);
  });
});

describe('buildProgram — argParser wiring', () => {
  function getParseArg(
    program: ReturnType<typeof buildProgram>,
    flag: string,
  ): ((value: string, prev?: unknown) => unknown) | undefined {
    const extract = program.commands.find((c) => c.name() === 'extract');
    const opt = extract?.options.find((o) => o.long === flag);
    return (opt as { parseArg?: (v: string, prev?: unknown) => unknown } | undefined)?.parseArg;
  }

  it('parseDeduplication accepts valid values', () => {
    const parse = getParseArg(buildProgram(), '--deduplication');
    if (!parse) throw new Error('parseDeduplication not found');
    expect(parse('none')).toBe('none');
    expect(parse('url')).toBe('url');
    expect(parse('content-hash')).toBe('content-hash');
  });

  it('parseDeduplication rejects invalid values', () => {
    const parse = getParseArg(buildProgram(), '--deduplication');
    if (!parse) throw new Error('parseDeduplication not found');
    expect(() => parse('invalid')).toThrow(/Invalid --deduplication/);
  });

  it('parseMode accepts valid values', () => {
    const parse = getParseArg(buildProgram(), '--mode');
    if (!parse) throw new Error('parseMode not found');
    expect(parse('precision')).toBe('precision');
    expect(parse('balanced')).toBe('balanced');
    expect(parse('recall')).toBe('recall');
  });

  it('parseMode rejects invalid values', () => {
    const parse = getParseArg(buildProgram(), '--mode');
    if (!parse) throw new Error('parseMode not found');
    expect(() => parse('invalid')).toThrow(/Invalid --mode/);
  });

  it('parseSaveDestination accumulates typed values', () => {
    const parse = getParseArg(buildProgram(), '--save-destination');
    if (!parse) throw new Error('parseSaveDestination not found');
    const first = parse('dataset', []) as string[];
    expect(first).toEqual(['dataset']);
    const second = parse('key-value-store', first) as string[];
    expect(second).toEqual(['dataset', 'key-value-store']);
  });

  it('parseSaveDestination rejects invalid values', () => {
    const parse = getParseArg(buildProgram(), '--save-destination');
    if (!parse) throw new Error('parseSaveDestination not found');
    expect(() => parse('invalid', [])).toThrow(/Invalid --save-destination/);
  });
});

describe('buildProgram — removed stale flags', () => {
  it('does not expose --no-metadata on the extract subcommand', () => {
    const program = buildProgram();
    expect(getExtractOptions(program)).not.toContain('--no-metadata');
  });
});
