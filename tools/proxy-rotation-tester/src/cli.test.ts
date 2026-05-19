import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProxySimulator } from 'proxy-simulator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Repo root is 3 levels up from src/
const REPO_ROOT = resolve(__dirname, '../../..');

function readFirstDatasetItem(storageDir: string): string {
  const itemPath = join(storageDir, 'datasets', 'default', '000000001.json');
  return readFileSync(itemPath, 'utf-8');
}

describe('Proxy Rotation - CLI', () => {
  let sim: Awaited<ReturnType<typeof createProxySimulator>>;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(REPO_ROOT, 'tmp-cli-test-'));
    // Use ports 8084-8086 to avoid conflict with lib.test.ts (8081-8083)
    sim = await createProxySimulator({ startPort: 8084, portCount: 3 });
    await sim.start();
  });

  afterAll(async () => {
    await sim.stop();
    try {
      rmSync(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should extract content through proxy via CLI', async () => {
    const storageDir = join(tempDir, 'crawlee-storage');
    const cliBin = join(REPO_ROOT, 'apps/standalone/dist/cli.js');
    const proxyArgs = sim.ports.flatMap((port) => ['--proxy', `http://127.0.0.1:${port}`]);

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
      (resolve) => {
        const child = spawn(
          'node',
          [
            cliBin,
            'extract',
            'http://example.com',
            ...proxyArgs,
            '--proxy-rotation',
            'recommended',
            '--save',
            'txt',
            '--save-destination',
            'dataset',
            '--max-pages',
            '1',
            // Use cheerio to avoid Chromium browser dependency in test environment
            '--crawler-type',
            'cheerio',
          ],
          {
            env: {
              ...process.env,
              PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK: '1',
              CRAWLEE_STORAGE_DIR: storageDir,
            },
          },
        );

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data: Buffer) => {
          stdout += String(data);
        });
        child.stderr?.on('data', (data: Buffer) => {
          stderr += String(data);
        });
        child.on('close', (code) => {
          resolve({ stdout, stderr, exitCode: code ?? 1 });
        });
      },
    );

    expect(result.exitCode, `CLI stderr: ${result.stderr}`).toBe(0);

    // Verify dataset item exists and contains proxy port content
    const rawItem = readFirstDatasetItem(storageDir);
    const item = JSON.parse(rawItem) as Record<string, unknown>;
    const content = String(item.txt ?? '');
    const containsProxyPort = sim.ports.some((port) => content.includes(port.toString()));
    expect(
      containsProxyPort,
      `Content did not contain any proxy port. Content: ${content.slice(0, 200)}`,
    ).toBe(true);
  });
}, 60_000);

describe('Proxy Rotation - CLI (Tiered Proxies)', () => {
  let sim: Awaited<ReturnType<typeof createProxySimulator>>;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(REPO_ROOT, 'tmp-cli-tiered-test-'));
    // Use ports 8095-8097 to avoid conflict with existing cli (8084-8086)
    sim = await createProxySimulator({ startPort: 8095, portCount: 3 });
    await sim.start();
  });

  afterAll(async () => {
    await sim.stop();
    try {
      rmSync(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should route requests through tiered proxies via --proxy-tier flag', async () => {
    const storageDir = join(tempDir, 'crawlee-tier-flag');
    const cliBin = join(REPO_ROOT, 'apps/standalone/dist/cli.js');

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
      (resolve) => {
        const child = spawn(
          'node',
          [
            cliBin,
            'extract',
            'http://example.com',
            '--proxy-tier',
            `${sim.proxies[0]},${sim.proxies[1]}`,
            '--proxy-tier',
            sim.proxies[2]!,
            '--save',
            'txt',
            '--save-destination',
            'dataset',
            '--max-pages',
            '1',
            '--crawler-type',
            'cheerio',
          ],
          {
            env: {
              ...process.env,
              PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK: '1',
              CRAWLEE_STORAGE_DIR: storageDir,
            },
          },
        );
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (d: Buffer) => {
          stdout += String(d);
        });
        child.stderr?.on('data', (d: Buffer) => {
          stderr += String(d);
        });
        child.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
      },
    );

    expect(result.exitCode, `CLI stderr: ${result.stderr}`).toBe(0);
    const rawItem = readFirstDatasetItem(storageDir);
    const item = JSON.parse(rawItem) as Record<string, unknown>;
    const content = String(item.txt ?? '');
    const usedPort = sim.ports.some((port) => content.includes(port.toString()));
    expect(usedPort, `No proxy port found in content: ${content.slice(0, 200)}`).toBe(true);
  });

  it('should route requests through tiered proxies via --proxy-tiers JSON flag', async () => {
    const storageDir = join(tempDir, 'crawlee-tier-json');
    const cliBin = join(REPO_ROOT, 'apps/standalone/dist/cli.js');
    const tiers = JSON.stringify([[sim.proxies[0]!], [sim.proxies[1]!]]);

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
      (resolve) => {
        const child = spawn(
          'node',
          [
            cliBin,
            'extract',
            'http://example.com',
            '--proxy-tiers',
            tiers,
            '--save',
            'txt',
            '--save-destination',
            'dataset',
            '--max-pages',
            '1',
            '--crawler-type',
            'cheerio',
          ],
          {
            env: {
              ...process.env,
              PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK: '1',
              CRAWLEE_STORAGE_DIR: storageDir,
            },
          },
        );
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (d: Buffer) => {
          stdout += String(d);
        });
        child.stderr?.on('data', (d: Buffer) => {
          stderr += String(d);
        });
        child.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
      },
    );

    expect(result.exitCode, `CLI stderr: ${result.stderr}`).toBe(0);
    const rawItem = readFirstDatasetItem(storageDir);
    const item = JSON.parse(rawItem) as Record<string, unknown>;
    const content = String(item.txt ?? '');
    const usedPort = sim.ports.some((port) => content.includes(port.toString()));
    expect(usedPort, `No proxy port found in content: ${content.slice(0, 200)}`).toBe(true);
  });
}, 60_000);
