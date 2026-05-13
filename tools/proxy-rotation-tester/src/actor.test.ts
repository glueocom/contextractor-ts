import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Proxy Rotation - Apify Actor', () => {
  const proxies: Server[] = [];
  const proxyPorts = [8081, 8082, 8083];
  let storageDir: string;

  beforeAll(async () => {
    // Create Actor storage directory
    storageDir = join(process.cwd(), 'apps/apify-actor/storage-test');
    mkdirSync(join(storageDir, 'key_value_stores/default'), { recursive: true });
    mkdirSync(join(storageDir, 'datasets/default'), { recursive: true });

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
      rmSync(storageDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should extract content through proxy via Apify Actor', async () => {
    // Create INPUT.json with proxy configuration
    const inputPath = join(storageDir, 'key_value_stores/default/INPUT.json');
    const input = {
      startUrls: [{ url: 'http://example.com' }],
      maxRequestsPerCrawl: 1,
      outputFormat: 'txt',
      proxyConfiguration: {
        proxyUrls: proxyPorts.map((port) => `http://127.0.0.1:${port}`),
      },
      proxyRotation: 'RECOMMENDED',
    };
    writeFileSync(inputPath, JSON.stringify(input));

    const result = await new Promise<{ exitCode: number }>((resolve) => {
      const child = spawn('apify', ['run'], {
        cwd: join(process.cwd(), 'apps/apify-actor'),
        env: {
          ...process.env,
          APIFY_LOCAL_STORAGE_DIR: storageDir,
          PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK: '1',
        },
      });

      child.on('close', (code) => {
        resolve({ exitCode: code ?? 1 });
      });
    });

    // The Actor should complete successfully
    expect(result.exitCode).toBe(0);

    // Check dataset for results containing proxy port information
    const datasetPath = join(storageDir, 'datasets/default');
    const files = readdirSync(datasetPath);
    expect(files.length).toBeGreaterThan(0);

    // Read the dataset file
    const datasetFile = JSON.parse(readFileSync(join(datasetPath, files[0]), 'utf-8'));
    const content = datasetFile.txt || '';

    // Content should contain a proxy port number
    const containsProxyPort = proxyPorts.some((port) => content.includes(port.toString()));
    expect(containsProxyPort).toBe(true);
  });

  it('should rotate proxies with PER_REQUEST mode', async () => {
    // Create INPUT.json with PER_REQUEST rotation
    const inputPath = join(storageDir, 'key_value_stores/default/INPUT.json');
    const input = {
      startUrls: [{ url: 'http://example.com/1' }, { url: 'http://example.com/2' }],
      maxRequestsPerCrawl: 2,
      outputFormat: 'txt',
      proxyConfiguration: {
        proxyUrls: proxyPorts.map((port) => `http://127.0.0.1:${port}`),
      },
      proxyRotation: 'PER_REQUEST',
    };
    writeFileSync(inputPath, JSON.stringify(input));

    const result = await new Promise<{ exitCode: number }>((resolve) => {
      const child = spawn('apify', ['run'], {
        cwd: join(process.cwd(), 'apps/apify-actor'),
        env: {
          ...process.env,
          APIFY_LOCAL_STORAGE_DIR: storageDir,
          PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK: '1',
        },
      });

      child.on('close', (code) => {
        resolve({ exitCode: code ?? 1 });
      });
    });

    expect(result.exitCode).toBe(0);
  });
});
