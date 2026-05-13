import type { Server } from 'node:http';
import { createServer } from 'node:http';

export interface ProxySimulatorConfig {
  startPort?: number;
  portCount?: number;
}

export interface ProxySimulator {
  start(): Promise<void>;
  stop(): Promise<void>;
  ports: number[];
  proxies: string[];
}

export async function createProxySimulator(
  config: ProxySimulatorConfig = {},
): Promise<ProxySimulator> {
  const startPort = config.startPort ?? 8081;
  const portCount = config.portCount ?? 10;
  const ports: number[] = Array.from({ length: portCount }, (_, i) => startPort + i);
  const servers: Server[] = [];

  return {
    ports,
    proxies: ports.map((port) => `http://127.0.0.1:${port}`),

    async start() {
      for (const port of ports) {
        const server = createServer((_req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<!DOCTYPE html>
<html>
<head><title>Proxy ${port}</title></head>
<body>
<p>Request intercepted by proxy on port ${port}</p>
</body>
</html>`);
        });

        await new Promise<void>((resolve, reject) => {
          server.listen(port, '127.0.0.1', () => {
            resolve();
          });
          server.on('error', reject);
        });

        servers.push(server);
      }
    },

    async stop() {
      for (const server of servers) {
        await new Promise<void>((resolve) => {
          server.close(() => {
            resolve();
          });
        });
      }
      servers.length = 0;
    },
  };
}
