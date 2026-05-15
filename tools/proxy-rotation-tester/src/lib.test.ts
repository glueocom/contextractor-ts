import {
  buildRequests,
  createContextractorCrawler,
  memorySink,
  ProxyConfiguration,
} from '@contextractor/crawler';
import { Server } from 'proxy-chain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Proxy Rotation - Library (Direct API)', () => {
  const servers: Server[] = [];
  const proxyPorts = [8081, 8082, 8083];
  const proxyUrls = proxyPorts.map((port) => `http://127.0.0.1:${port}`);

  beforeAll(async () => {
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
  });

  it('should route requests through a proxy and identify the proxy port in content', async () => {
    const sink = memorySink();
    const startUrls = ['http://example.com'];
    const crawler = createContextractorCrawler({
      startUrls,
      crawlerType: 'cheerio',
      proxyConfiguration: new ProxyConfiguration({ proxyUrls }),
      proxyRotation: 'RECOMMENDED',
      formats: ['txt'],
      sink,
    });

    await crawler.run(buildRequests(startUrls));

    expect(sink.results.length, 'Crawler returned no results').toBeGreaterThan(0);

    const content = sink.results[0]?.formats?.txt ?? '';
    const containsProxyPort = proxyPorts.some((port) => content.includes(port.toString()));
    expect(
      containsProxyPort,
      `Content did not include any proxy port. Content: "${content.slice(0, 300)}"`,
    ).toBe(true);
  });

  it('should route each request through a different proxy with PER_REQUEST mode', async () => {
    const sink = memorySink();
    const startUrls = ['http://example.com/page1', 'http://example.com/page2'];
    const crawler = createContextractorCrawler({
      startUrls,
      crawlerType: 'cheerio',
      proxyConfiguration: new ProxyConfiguration({ proxyUrls }),
      proxyRotation: 'PER_REQUEST',
      formats: ['txt'],
      sink,
    });

    await crawler.run(buildRequests(startUrls));

    expect(sink.results.length, 'Crawler returned no results').toBe(2);

    for (const result of sink.results) {
      const content = result.formats?.txt ?? '';
      const containsProxyPort = proxyPorts.some((port) => content.includes(port.toString()));
      expect(
        containsProxyPort,
        `Result did not include any proxy port. Content: "${content.slice(0, 200)}"`,
      ).toBe(true);
    }
  });
}, 60_000);
