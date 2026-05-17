import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('crawlee', async (importOriginal) => {
  const original = await importOriginal<typeof import('crawlee')>();
  return {
    ...original,
    Dataset: { open: vi.fn().mockResolvedValue({ pushData: vi.fn() }) },
    KeyValueStore: { open: vi.fn().mockResolvedValue({ setValue: vi.fn() }) },
  };
});

vi.mock('./storage/index.js', () => ({
  resolveStorageDir: vi.fn().mockReturnValue('/tmp/test-exit-code-storage'),
  configureStorage: vi.fn(),
}));

vi.mock('./sinks.js', () => ({
  createCliSink: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
  createCrawleeStorageSink: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
}));

vi.mock('@contextractor/crawler', async (importOriginal) => {
  type Opts = { onFailedRequest?: (info: {
    url: string;
    loadedUrl: string | null;
    errorMessages: string[];
    retryCount: number;
  }) => Promise<void> };
  const original = await importOriginal<typeof import('@contextractor/crawler')>();
  return {
    ...original,
    createContextractorCrawler: vi.fn((opts: Opts) => ({
      run: async () => {
        await opts.onFailedRequest?.({
          url: 'https://example.com',
          loadedUrl: 'https://example.com',
          errorMessages: ['simulated failure'],
          retryCount: 0,
        });
      },
    })),
  };
});

describe('runExtractAction — exit code 2 on partial failure', () => {
  let exitSpy: ReturnType<typeof vi.spyOn<typeof process, 'exit'>>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('exits with code 2 when at least one request fails', async () => {
    const { buildProgram, runCli } = await import('./cliProgram.js');
    const program = buildProgram();
    await runCli(program, [
      'node',
      'contextractor',
      'extract',
      'https://example.com',
      '--crawler-type',
      'cheerio',
    ]);
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});
