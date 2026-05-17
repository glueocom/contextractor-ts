import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'proxy-chain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Repo root is 3 levels up from src/
const REPO_ROOT = resolve(__dirname, '../../..');

describe('Proxy Rotation - CLI', () => {
  const servers: Server[] = [];
  // Use ports 8084-8086 to avoid conflict with lib.test.ts (8081-8083)
  const proxyPorts = [8084, 8085, 8086];
  let tempDir: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(REPO_ROOT, 'tmp-cli-test-'));

    for (const port of proxyPorts) {
      const server = new Server({
        port,
        prepareRequestFunction: () => ({
          customResponseFunction: () => ({
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `<!DOCTYPE html>
<html>
<head><title>Test page from proxy ${port}</title></head>
<body>
<article>
<p>This response was intercepted by proxy on port ${port}</p>
</article>
</body>
</html>`,
          }),
        }),
      });

      await server.listen();
      servers.push(server);
    }
  });

  afterAll(async () => {
    for (const server of servers) {
      await server.close(true);
    }
    try {
      rmSync(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should extract content through proxy via CLI', async () => {
    const outputDir = join(tempDir, 'output');
    const cliBin = join(REPO_ROOT, 'apps/standalone/dist/cli.js');
    const proxyArgs = proxyPorts.flatMap((port) => ['--proxy', `http://127.0.0.1:${port}`]);

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
      (resolve) => {
        const child = spawn(
          'node',
          [
            cliBin,
            'http://example.com',
            '--output-dir',
            outputDir,
            ...proxyArgs,
            '--proxy-rotation',
            'recommended',
            '--save',
            'txt',
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
              CRAWLEE_STORAGE_DIR: join(tempDir, 'crawlee-storage'),
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

    // Verify output file exists and contains proxy port content
    const files = readdirSync(outputDir).filter((f) => f.endsWith('.txt'));
    expect(files.length, 'Expected at least one .txt output file').toBeGreaterThan(0);

    const content = readFileSync(join(outputDir, files[0]), 'utf-8');
    const containsProxyPort = proxyPorts.some((port) => content.includes(port.toString()));
    expect(
      containsProxyPort,
      `Content did not contain any proxy port. Content: ${content.slice(0, 200)}`,
    ).toBe(true);
  });
}, 60_000);
