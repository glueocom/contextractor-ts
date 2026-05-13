# Autonomous Proxy Rotation Testing

- we need to test proxy rotation for
    - Apify actor running locally
    - NPM CLI runnoig locally from a console
    - calling the contextractor NPM from a typescript file

- create a tool for helping with proxy testing at a subfolder of `/Users/miroslavsekera/r/contextractor-ts/tools`. the new tool will HTTP listen to multiple ports (around 10) and will simulate proxy servers. Then the proxy server test tool will return for each HTTP request a simple html containing just the port number to distinguishe the proxy
- create another project or projects (or keep it within the proxy rotation simulator, decide whats better, problably splitting is better) that will do the actual proxy rotation testing, that will call the Contextractor aa the Apify actor running locally, the Contextractor as the  NPM CLI running locally, the Contextractor as the  NPM lib running locally  