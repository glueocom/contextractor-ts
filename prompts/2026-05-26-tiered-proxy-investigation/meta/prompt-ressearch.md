> **TLDR**: Investigate whether contextractor's tiered proxy input design — exposing `tieredProxyUrls`, `tieredProxyConfig`, and `proxyConfiguration` as separate schema fields — follows Apify/Crawlee conventions. Research how official Apify actors handle tiered proxy configuration and whether this architecture is sound. Produce a report to `context/`.

in my apify actor /Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/

currently there are tiered proxy configuration fields: `tieredProxyUrls` `tieredProxyConfig`
/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/.actor/input_schema.json

but there is also the standard `proxyConfiguration` field

Should that be configured like that?

deeply investigate on the web and in the codebase

are there any other actors (look for Apify ones) that configure tiered proxies this way?

![Apify Console - Proxy section showing proxyConfiguration, proxyRotation, tieredProxyUrls, tieredProxyConfig, sessionPoolName, maxSessionRotations fields](apify-console-proxy-section.png)

create a report to '/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-26-tiered-proxy-investigation/context/' 
