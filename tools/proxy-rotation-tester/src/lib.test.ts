import {
  buildRequests,
  createContextractorCrawler,
  memorySink,
  ProxyConfiguration,
} from '@contextractor/crawler';
import { createProxySimulator } from 'proxy-simulator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Proxy Rotation - Library (Direct API)', () => {
  let sim: Awaited<ReturnType<typeof createProxySimulator>>;

  beforeAll(async () => {
    sim = await createProxySimulator({ startPort: 8081, portCount: 3 });
    await sim.start();
  });

  afterAll(async () => {
    await sim.stop();
  });

  it('should route requests through a proxy and identify the proxy port in content', async () => {
    const sink = memorySink();
    const startUrls = ['http://example.com'];
    const crawler = createContextractorCrawler({
      startUrls,
      crawlerType: 'cheerio',
      proxyConfiguration: new ProxyConfiguration({ proxyUrls: sim.proxies }),
      proxyRotation: 'RECOMMENDED',
      formats: ['txt'],
      sink,
    });

    await crawler.run(buildRequests(startUrls));

    expect(sink.results.length, 'Crawler returned no results').toBeGreaterThan(0);

    const content = sink.results[0]?.formats?.txt ?? '';
    const containsProxyPort = sim.ports.some((port) => content.includes(port.toString()));
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
      proxyConfiguration: new ProxyConfiguration({ proxyUrls: sim.proxies }),
      proxyRotation: 'PER_REQUEST',
      formats: ['txt'],
      sink,
    });

    await crawler.run(buildRequests(startUrls));

    expect(sink.results.length, 'Crawler returned no results').toBe(2);

    for (const result of sink.results) {
      const content = result.formats?.txt ?? '';
      const containsProxyPort = sim.ports.some((port) => content.includes(port.toString()));
      expect(
        containsProxyPort,
        `Result did not include any proxy port. Content: "${content.slice(0, 200)}"`,
      ).toBe(true);
    }
  });
}, 60_000);

describe('Proxy Rotation - Library (Tiered Proxies)', () => {
  let sim: Awaited<ReturnType<typeof createProxySimulator>>;

  beforeAll(async () => {
    sim = await createProxySimulator({ startPort: 8091, portCount: 4 });
    await sim.start();
  });

  afterAll(async () => {
    await sim.stop();
  });

  it('should route requests through tiered proxies', async () => {
    const sink = memorySink();
    // Use a distinct URL to avoid Crawlee's in-memory request queue deduplication
    // against http://example.com already processed by the first describe block.
    const startUrls = ['http://example.com/tiered-proxy-lib'];
    const crawler = createContextractorCrawler({
      startUrls,
      crawlerType: 'cheerio',
      proxyConfiguration: new ProxyConfiguration({
        tieredProxyUrls: [
          [sim.proxies[0] as string, sim.proxies[1] as string],
          [sim.proxies[2] as string, sim.proxies[3] as string],
        ],
      }),
      formats: ['txt'],
      sink,
    });

    await crawler.run(buildRequests(startUrls));

    expect(sink.results.length).toBeGreaterThan(0);
    const content = sink.results[0]?.formats?.txt ?? '';
    const usedPort = sim.ports.some((port) => content.includes(port.toString()));
    expect(
      usedPort,
      `Content did not include any proxy port. Content: "${content.slice(0, 300)}"`,
    ).toBe(true);
  });
}, 60_000);
