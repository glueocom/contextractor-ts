/**
 * Call contextractor via the Docker Engine API and the contextractor HTTP API.
 *
 * The flow:
 *   1. Create and start a contextractor container via the Docker Engine API
 *      (POST /containers/create + POST /containers/{id}/start).
 *   2. Poll GET /healthz on the contextractor serve endpoint until ready.
 *   3. Run `contextractor extract` inside the container via the Docker Engine
 *      exec API (POST /containers/{id}/exec + POST /exec/{id}/start) —
 *      no Docker CLI subprocess.
 *   4. Retrieve the extraction results via GET /v2/datasets/default/items.
 *   5. Stop and remove the container via the Docker Engine API.
 *
 * Note: POST /v2/extract is not yet implemented in the serve endpoint (returns
 * 501). Extraction is triggered via the Docker Engine exec API instead.
 *
 * All Docker Engine calls go through the Unix socket at /var/run/docker.sock
 * using Node.js's built-in http module — no Docker CLI subprocess is used.
 *
 * Prerequisites:
 *   - Docker Engine running locally (Unix socket at /var/run/docker.sock)
 *   - contextractor Docker image built: docker build -t contextractor:latest .
 *
 * Run:
 *   npm install
 *   npx tsx src/main.ts
 */

import http from 'node:http';

const IMAGE = process.env.CTX_IMAGE ?? 'contextractor:latest';
const API_TOKEN = process.env.CTX_TOKEN ?? 'dev-token';
const HOST_PORT = Number(process.env.CTX_PORT ?? '18080');
const DOCKER_SOCKET = '/var/run/docker.sock';
const CTX_BASE_URL = `http://127.0.0.1:${HOST_PORT}`;
const EXAMPLE_URL = 'https://blog.apify.com/what-is-web-scraping/';

// ── Docker Engine API via Unix socket ─────────────────────────────────────────

interface DockerCreateBody {
  Image: string;
  Cmd: string[];
  Env: string[];
  ExposedPorts: Record<string, Record<string, never>>;
  HostConfig: {
    PortBindings: Record<string, Array<{ HostIp: string; HostPort: string }>>;
  };
}

interface DockerCreateResponse {
  Id: string;
}

function dockerRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      socketPath: DOCKER_SOCKET,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload !== undefined ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const status = res.statusCode ?? 0;
        if (status >= 400) {
          reject(new Error(`Docker API ${method} ${path} → ${status}: ${raw}`));
          return;
        }
        try {
          resolve(raw.length > 0 ? JSON.parse(raw) : null);
        } catch {
          resolve(raw);
        }
      });
    });

    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

async function createContainer(): Promise<string> {
  const body: DockerCreateBody = {
    Image: IMAGE,
    Cmd: ['serve', '--host', '0.0.0.0', '--port', '8080'],
    Env: [`CONTEXTRACTOR_API_TOKEN=${API_TOKEN}`],
    ExposedPorts: { '8080/tcp': {} },
    HostConfig: {
      PortBindings: {
        '8080/tcp': [{ HostIp: '127.0.0.1', HostPort: String(HOST_PORT) }],
      },
    },
  };
  const res = await dockerRequest('POST', '/containers/create', body) as DockerCreateResponse;
  return res.Id;
}

async function startContainer(id: string): Promise<void> {
  await dockerRequest('POST', `/containers/${id}/start`);
}

async function stopContainer(id: string): Promise<void> {
  await dockerRequest('POST', `/containers/${id}/stop`).catch(() => undefined);
  await dockerRequest('DELETE', `/containers/${id}?force=true`).catch(() => undefined);
}

// ── contextractor HTTP API ────────────────────────────────────────────────────

interface HealthzResponse {
  status: string;
  storageDir: string;
  datasetCount: number;
}

interface DockerExecCreateResponse {
  Id: string;
}

interface DatasetItem {
  url?: string;
  loadedUrl?: string;
  markdown?: string;
  txt?: string;
  [key: string]: unknown;
}

async function ctxGet<T>(path: string, auth = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (auth) headers.Authorization = `Bearer ${API_TOKEN}`;

  const res = await fetch(`${CTX_BASE_URL}${path}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Docker Engine exec API (run a command inside a running container) ──────────

async function execInContainer(id: string, cmd: string[]): Promise<void> {
  const create = await dockerRequest('POST', `/containers/${id}/exec`, {
    AttachStdout: false,
    AttachStderr: false,
    Cmd: cmd,
  }) as DockerExecCreateResponse;

  // Start the exec instance (detached — we don't need its output).
  await dockerRequest('POST', `/exec/${create.Id}/start`, { Detach: true });
}

async function waitForHealthy(maxWaitMs = 20_000): Promise<HealthzResponse> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      return await ctxGet<HealthzResponse>('/healthz', false);
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Container did not become healthy within ${maxWaitMs}ms`);
}

async function waitForItems(maxWaitMs = 60_000): Promise<DatasetItem[]> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const items = await ctxGet<DatasetItem[]>('/v2/datasets/default/items?limit=10');
    if (items.length > 0) return items;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`No items appeared within ${maxWaitMs}ms`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`Creating container (image: ${IMAGE})...`);
  const id = await createContainer();
  console.log(`Container created: ${id.slice(0, 12)}`);

  await startContainer(id);
  console.log('Container started.');

  try {
    console.log('Waiting for /healthz...');
    const health = await waitForHealthy();
    console.log(`Healthy: storageDir=${health.storageDir}, datasets=${health.datasetCount}`);

    // Trigger extraction inside the container via the Docker Engine exec API.
    // POST /v2/extract is not yet implemented in the serve endpoint (returns 501).
    console.log(`\nTriggering extraction: ${EXAMPLE_URL}`);
    await execInContainer(id, [
      'node', '/app/dist/cli.js',
      'extract', EXAMPLE_URL,
      '--save', 'markdown',
      '--no-stdout',
    ]);
    console.log('Extraction triggered.');

    // Poll until the item lands in the dataset.
    console.log('Polling for dataset items...');
    const items = await waitForItems();
    console.log(`\nDataset items: ${items.length}`);
    for (const item of items) {
      console.log(JSON.stringify(item, null, 2));
    }
  } finally {
    console.log('\nStopping container...');
    await stopContainer(id);
    console.log('Done.');
  }
}

await main();
