import { Server } from 'proxy-chain';

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

export async function createProxySimulator(config: ProxySimulatorConfig = {}): Promise<ProxySimulator> {
  const startPort = config.startPort ?? 8081;
  const portCount = config.portCount ?? 10;
  const ports: number[] = Array.from({ length: portCount }, (_, i) => startPort + i);
  const servers: Server[] = [];

  return {
    ports,
    proxies: ports.map((port) => `http://127.0.0.1:${port}`),

    async start() {
      for (const port of ports) {
        const server = new Server({
          port,
          prepareRequestFunction: () => ({
            customResponseFunction: () => ({
              statusCode: 200,
              headers: { 'Content-Type': 'text/html' },
              body: `<!DOCTYPE html>
<html>
<head><title>Proxy ${port}</title></head>
<body>
<article>
<p>Request intercepted by proxy on port ${port}</p>
</article>
</body>
</html>`,
            }),
          }),
        });

        await server.listen();
        servers.push(server);
      }
    },

    async stop() {
      for (const server of servers) {
        await server.close(true);
      }
      servers.length = 0;
    },
  };
}
