# Proxy Simulator

Mock HTTP proxy server for testing proxy rotation in Contextractor.

## Overview

This tool simulates multiple HTTP proxy servers listening on consecutive ports. Each proxy intercepts requests and returns a simple HTML response containing the port number, allowing tests to verify which proxy was used.

## Configuration

- **startPort**: Starting port number (default: 8081)
- **portCount**: Number of proxy instances to create (default: 10)

Default configuration creates proxies on ports 8081–8090.

## Usage

```typescript
import { createProxySimulator } from './main.js';

const simulator = await createProxySimulator({
  startPort: 8081,
  portCount: 5,
});

await simulator.start();
console.log('Proxies available at:', simulator.proxies);
// Output: ['http://127.0.0.1:8081', 'http://127.0.0.1:8082', ...]

// ... run tests ...

await simulator.stop();
```

## Environment Requirements

When testing with Chromium/Playwright:

```bash
export PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1
```

Without this variable, Chromium silently bypasses proxies for localhost targets, preventing the mock proxies from receiving traffic.

## Response Format

Each proxy returns HTML with the port number in the body:

```html
<!DOCTYPE html>
<html>
<head><title>Proxy 8081</title></head>
<body>
<p>Request intercepted by proxy on port 8081</p>
</body>
</html>
```

## Target URLs

Use `http://example.com` for all test URLs. The proxies intercept HTTP requests before the real host is contacted and return the mock response.

Do not use HTTPS targets—the mock proxies only implement HTTP (they don't handle CONNECT tunnels for SSL/TLS).

## Testing

Run tests from the root of the repo (proxy-rotation-tester tool uses this simulator).
