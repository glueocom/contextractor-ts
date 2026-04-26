import { Actor, log } from 'apify';
import { PlaywrightCrawler, type ProxyConfiguration } from 'crawlee';
import {
    buildBrowserContextOptions,
    buildBrowserLaunchOptions,
    buildCrawlConfig,
} from './config.js';
import { ResultsCounter, createRequestHandler } from './handler.js';
import type { ActorInput } from './types.js';

await Actor.init();

try {
    const input = ((await Actor.getInput()) ?? {}) as ActorInput;

    if (input.debugLog) {
        log.setLevel(log.LEVELS.DEBUG);
    }

    const startUrls = (input.startUrls ?? []).map((u) => u.url).filter(Boolean);
    if (startUrls.length === 0) {
        log.info('No URLs provided');
        await Actor.exit();
    }

    const kvs = input.keyValueStoreName
        ? await Actor.openKeyValueStore(input.keyValueStoreName)
        : await Actor.openKeyValueStore();
    const dataset = input.datasetName ? await Actor.openDataset(input.datasetName) : null;

    const config = buildCrawlConfig(input);

    let proxyConfiguration: ProxyConfiguration | undefined;
    if (input.proxyConfiguration) {
        proxyConfiguration = await Actor.createProxyConfiguration(input.proxyConfiguration);
    }

    const counter = new ResultsCounter(input.maxResultsPerCrawl ?? 0);

    const crawler = new PlaywrightCrawler({
        headless: input.headless ?? true,
        launchContext: {
            launcher: undefined,
            launchOptions: buildBrowserLaunchOptions(input),
        },
        browserPoolOptions: {
            useFingerprints: false,
        },
        preNavigationHooks: [
            async ({ page }) => {
                const ctxOpts = buildBrowserContextOptions(input);
                if (ctxOpts?.extraHTTPHeaders) {
                    await page.setExtraHTTPHeaders(
                        ctxOpts.extraHTTPHeaders as Record<string, string>,
                    );
                }
            },
        ],
        navigationTimeoutSecs: input.pageLoadTimeoutSecs ?? 60,
        maxRequestsPerCrawl:
            input.maxPagesPerCrawl && input.maxPagesPerCrawl > 0
                ? input.maxPagesPerCrawl
                : undefined,
        maxRequestRetries: input.maxRequestRetries ?? 3,
        maxConcurrency: input.maxConcurrency ?? 50,
        proxyConfiguration,
        respectRobotsTxtFile: input.respectRobotsTxtFile ?? false,
        requestHandler: createRequestHandler({
            kvs,
            dataset,
            counter,
            config,
            browserLog: input.browserLog ?? false,
        }),
    });

    await crawler.run(
        startUrls.map((url) => ({
            url,
            keepUrlFragment: input.keepUrlFragments ?? false,
            userData: { depth: 0 },
        })),
    );

    await Actor.exit();
} catch (err) {
    log.exception(err as Error, 'Actor failed');
    await Actor.exit({ exitCode: 1 });
}
