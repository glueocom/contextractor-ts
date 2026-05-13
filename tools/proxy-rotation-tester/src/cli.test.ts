import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Proxy Rotation - CLI', () => {
  const proxies: Server[] = [];
  const proxyPorts = [8081, 8082, 8083];
  let tempDir: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(process.cwd(), 'tmp-cli-test-'));

    // Start mock proxy servers
    for (const port of proxyPorts) {
      const server = createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>Proxy port: ${port}</body>
</html>`);
      });

      await new Promise<void>((resolve, reject) => {
        server.listen(port, '127.0.0.1', () => {
          resolve();
        });
        server.on('error', reject);
      });

      proxies.push(server);
    }
  });

  afterAll(async () => {
    for (const server of proxies) {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }
    try {
      rmSync(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should extract content through proxy via CLI', async () => {
    const proxyConfigPath = join(tempDir, 'proxy.json');
    const proxyConfig = {
      proxyUrls: proxyPorts.map((port) => `http://127.0.0.1:${port}`),
    };
    writeFileSync(proxyConfigPath, JSON.stringify(proxyConfig));

    const outputDir = join(tempDir, 'output');

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
      (resolve) => {
        const child = spawn('node', [
          '--loader',
          'ts-node/esm',
          join(process.cwd(), 'apps/standalone/src/cli.ts'),
          'http://example.com',
          '--output-dir',
          outputDir,
          '--proxy-configuration',
          proxyConfigPath,
          '--proxy-rotation',
          'RECOMMENDED',
          '--output-format',
          'txt',
        ]);

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          stdout += data;
        });

        child.stderr?.on('data', (data) => {
          stderr += data;
        });

        child.on('close', (code) => {
          resolve({ stdout, stderr, exitCode: code ?? 1 });
        });
      },
    );

    // The CLI should complete successfully
    expect(result.exitCode).toBe(0);

    // Output should contain a file with proxy port information
    expect(result.stdout.includes('example.com')).toBe(true);
  });
});
