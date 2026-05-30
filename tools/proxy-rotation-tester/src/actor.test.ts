import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProxySimulator } from 'proxy-simulator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

function runActor(storageDir: string, input: unknown): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    writeFileSync(join(storageDir, 'key_value_stores/default/INPUT.json'), JSON.stringify(input));

    const child = spawn('apify', ['run'], {
      cwd: join(REPO_ROOT, 'apps/apify-actor'),
      env: {
        ...process.env,
        APIFY_LOCAL_STORAGE_DIR: storageDir,
        PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK: '1',
      },
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data: Buffer) => {
      stdout += String(data);
    });
    child.stderr?.on('data', (data: Buffer) => {
      stderr += String(data);
    });

    // `apify run` CLI does not exit naturally when the actor completes locally —
    // it keeps running even after the actor's node process calls process.exit().
    // Watch for the CheerioCrawler "Finished!" completion log and kill then.
    const watchInterval = setInterval(() => {
      if (stdout.includes('requestsFinished')) {
        clearInterval(watchInterval);
        // Brief delay to allow dataset writes to flush before killing
        setTimeout(() => {
          child.kill('SIGTERM');
        }, 500);
      }
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(watchInterval);
      child.kill('SIGTERM');
    }, 30_000);

    child.on('close', () => {
      clearInterval(watchInterval);
      clearTimeout(timeout);
      resolve({ stdout, stderr });
    });

    child.on('error', (err) => {
      clearInterval(watchInterval);
      clearTimeout(timeout);
      reject(err);
    });
  });
}

describe('Proxy Rotation - Apify Actor', () => {
  let sim: Awaited<ReturnType<typeof createProxySimulator>>;
  let storageDir: string;

  beforeAll(async () => {
    // Create Actor storage directory under the repo root (not the test's process.cwd())
    storageDir = join(REPO_ROOT, 'apps/apify-actor/storage-test');
    mkdirSync(join(storageDir, 'key_value_stores/default'), { recursive: true });
    mkdirSync(join(storageDir, 'datasets/default'), { recursive: true });

    // Use ports 8087-8089 to avoid conflict with lib (8081-8083) and cli (8084-8086)
    sim = await createProxySimulator({ startPort: 8087, portCount: 3 });
    await sim.start();
  });

  afterAll(async () => {
    await sim.stop();
    try {
      rmSync(storageDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should extract content through proxy via Apify Actor', async () => {
    const result = await runActor(storageDir, {
      startUrls: [{ url: 'http://example.com' }],
      maxRequestsPerCrawl: 1,
      save: ['txt'],
      // Use cheerio to avoid Chromium browser dependency in test environment
      crawlerType: 'cheerio',
      proxyConfiguration: {
        proxyUrls: sim.ports.map((port) => `http://127.0.0.1:${port}`),
      },
      proxyRotation: 'recommended',
    });

    expect(
      result.stdout.includes('requestsFinished'),
      `Actor did not complete. stdout: ${result.stdout.slice(-500)}\nstderr: ${result.stderr.slice(-300)}`,
    ).toBe(true);

    // Check dataset for results containing proxy port information
    const datasetPath = join(storageDir, 'datasets/default');
    const files = readdirSync(datasetPath).sort();
    expect(files.length).toBeGreaterThan(0);

    const datasetFile = JSON.parse(readFileSync(join(datasetPath, files[0] as string), 'utf-8'));
    const content =
      typeof datasetFile.txt === 'string' ? datasetFile.txt : JSON.stringify(datasetFile);
    const containsProxyPort = sim.ports.some((port) => content.includes(port.toString()));
    expect(
      containsProxyPort,
      `Proxy port not found in dataset. content: ${content.slice(0, 300)}`,
    ).toBe(true);
  });

  it('should rotate proxies with per-request mode', async () => {
    const result = await runActor(storageDir, {
      startUrls: [{ url: 'http://example.com/1' }, { url: 'http://example.com/2' }],
      maxRequestsPerCrawl: 2,
      save: ['txt'],
      crawlerType: 'cheerio',
      proxyConfiguration: {
        proxyUrls: sim.ports.map((port) => `http://127.0.0.1:${port}`),
      },
      proxyRotation: 'per-request',
    });

    expect(
      result.stdout.includes('requestsFinished'),
      `Actor did not complete. stdout: ${result.stdout.slice(-500)}`,
    ).toBe(true);
  });
}, 120_000);
