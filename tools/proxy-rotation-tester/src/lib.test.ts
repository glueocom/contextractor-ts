import type { Server } from 'node:http';
import { createServer } from 'node:http';
import { createContextractorCrawler, memorySink } from '@contextractor/crawler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Proxy Rotation - Library (Direct API)', () => {
  const proxies: Server[] = [];
  const proxyPorts = [8081, 8082, 8083];
  const proxyUrls = proxyPorts.map((port) => `http://127.0.0.1:${port}`);

  beforeAll(async () => {
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
  });

  it('should extract content through a proxy and identify the proxy port', async () => {
    const sink = memorySink();
    const crawler = createContextractorCrawler({
      startUrls: [{ url: 'http://example.com' }],
      proxyConfiguration: {
        proxyUrls,
      },
      proxyRotation: 'RECOMMENDED',
      sink,
    });

    await crawler.run();

    expect(sink.results.length).toBeGreaterThan(0);

    const content = sink.results[0]?.formats?.txt || '';
    // Content should contain one of the proxy port numbers
    const containsProxyPort = proxyPorts.some((port) => content.includes(port.toString()));
    expect(containsProxyPort).toBe(true);
  });

  it('should rotate proxies with PER_REQUEST mode', async () => {
    const sink = memorySink();
    const crawler = createContextractorCrawler({
      startUrls: [{ url: 'http://example.com/1' }, { url: 'http://example.com/2' }],
      proxyConfiguration: {
        proxyUrls,
      },
      proxyRotation: 'PER_REQUEST',
      sink,
    });

    await crawler.run();

    expect(sink.results.length).toBe(2);

    // Each result should have content from a proxy
    for (const result of sink.results) {
      const content = result.formats?.txt || '';
      const containsProxyPort = proxyPorts.some((port) => content.includes(port.toString()));
      expect(containsProxyPort).toBe(true);
    }
  });
});
