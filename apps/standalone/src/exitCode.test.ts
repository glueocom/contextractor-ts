import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('crawlee', async (importOriginal) => {
  const original = await importOriginal<typeof import('crawlee')>();
  return {
    ...original,
    Dataset: { open: vi.fn().mockResolvedValue({ pushData: vi.fn() }) },
    KeyValueStore: { open: vi.fn().mockResolvedValue({ setValue: vi.fn() }) },
    RequestQueue: { open: vi.fn().mockResolvedValue({}) },
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
  const original = await importOriginal<typeof import('@contextractor/crawler')>();
  return {
    ...original,
    createContextractorCrawler: vi.fn(
      () =>
        ({
          run: async () => ({}) as never,
        }) as never,
    ),
  };
});

describe('runExtractAction — exit code 2 on partial failure', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  const tempDirs: string[] = [];

  beforeEach(() => {
    // biome-ignore lint/suspicious/noExplicitAny: process.exit is NodeJS.Process.exit, not assignable to keyof Process in older @types/node
    exitSpy = vi.spyOn(process, 'exit' as any).mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.clearAllMocks();
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits with code 2 when at least one request fails', async () => {
    const { createContextractorCrawler } = await import('@contextractor/crawler');
    vi.mocked(createContextractorCrawler).mockImplementationOnce(
      (opts) =>
        ({
          run: async () => {
            await opts.onFailedRequest?.({
              url: 'https://example.com',
              loadedUrl: 'https://example.com',
              errorMessages: ['simulated failure'],
              retryCount: 0,
            });
            return {} as never;
          },
        }) as never,
    );

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

  it('preserves config values when matching CLI flags are omitted', async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'contextractor-cli-config-'));
    tempDirs.push(tempDir);
    const configPath = path.join(tempDir, 'config.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        startUrls: [{ url: 'https://example.com' }],
        mode: 'recall',
        headless: false,
        closeCookieModals: false,
        save: ['txt'],
        saveDestination: ['dataset'],
        datasetName: 'config-dataset',
        keyValueStoreName: 'config-kvs',
        requestQueueName: 'config-queue',
      }),
      'utf8',
    );

    let crawlerOpts:
      | Parameters<typeof import('@contextractor/crawler')['createContextractorCrawler']>[0]
      | undefined;

    const { createContextractorCrawler } = await import('@contextractor/crawler');
    vi.mocked(createContextractorCrawler).mockImplementationOnce((opts) => {
      crawlerOpts = opts;
      return { run: async () => ({}) as never } as never;
    });

    const { buildProgram, runCli } = await import('./cliProgram.js');
    const { createCrawleeStorageSink } = await import('./sinks.js');
    const { Dataset, KeyValueStore, RequestQueue } = await import('crawlee');
    const program = buildProgram();

    await runCli(program, ['node', 'contextractor', 'extract', '--config', configPath]);

    expect(crawlerOpts).toMatchObject({
      mode: 'recall',
      headless: false,
      cookieStrategy: 'none',
    });
    expect(vi.mocked(createCrawleeStorageSink)).toHaveBeenCalledWith(
      expect.objectContaining({ destinations: ['dataset'], formats: ['txt'] }),
    );
    expect(vi.mocked(KeyValueStore.open)).toHaveBeenCalledWith('config-kvs');
    expect(vi.mocked(Dataset.open)).toHaveBeenCalledWith('config-dataset');
    expect(vi.mocked(RequestQueue.open)).toHaveBeenCalledWith('config-queue');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('lets explicit CLI flags override config values', async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'contextractor-cli-override-'));
    tempDirs.push(tempDir);
    const configPath = path.join(tempDir, 'config.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        startUrls: [{ url: 'https://example.com' }],
        mode: 'recall',
        headless: false,
        closeCookieModals: false,
        save: ['txt'],
        saveDestination: ['dataset'],
      }),
      'utf8',
    );

    let crawlerOpts:
      | Parameters<typeof import('@contextractor/crawler')['createContextractorCrawler']>[0]
      | undefined;

    const { createContextractorCrawler } = await import('@contextractor/crawler');
    vi.mocked(createContextractorCrawler).mockImplementationOnce((opts) => {
      crawlerOpts = opts;
      return { run: async () => ({}) as never } as never;
    });

    const { buildProgram, runCli } = await import('./cliProgram.js');
    const { createCrawleeStorageSink } = await import('./sinks.js');
    const program = buildProgram();

    await runCli(program, [
      'node',
      'contextractor',
      'extract',
      '--config',
      configPath,
      '--mode',
      'precision',
      '--headless',
      '--close-cookie-modals',
      '--save',
      'markdown',
      '--save-destination',
      'key-value-store',
    ]);

    expect(crawlerOpts).toMatchObject({
      mode: 'precision',
      headless: true,
      cookieStrategy: 'ghostery',
    });
    expect(vi.mocked(createCrawleeStorageSink)).toHaveBeenCalledWith(
      expect.objectContaining({ destinations: ['key-value-store'], formats: ['markdown'] }),
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
