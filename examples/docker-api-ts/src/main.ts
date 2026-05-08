/**
 * Call contextractor via the HTTP API served by the Docker image.
 *
 * The flow:
 *   1. Start a contextractor container in serve mode via the Docker Engine API.
 *   2. Poll GET /healthz until the container is ready.
 *   3. Use the CLI inside the container to extract a URL into local storage.
 *   4. Retrieve the extraction results via GET /v2/datasets/default/items.
 *   5. Stop and remove the container.
 *
 * Prerequisites:
 *   - Docker Engine running locally (Unix socket at /var/run/docker.sock)
 *   - contextractor Docker image built: docker build -t contextractor:latest .
 *
 * Run:
 *   npm install
 *   npx tsx src/main.ts
 */

import { execSync } from 'node:child_process';

const IMAGE = process.env.CTX_IMAGE ?? 'contextractor:latest';
const API_TOKEN = process.env.CTX_TOKEN ?? 'dev-token';
const HOST_PORT = process.env.CTX_PORT ?? '18080';
const BASE_URL = `http://127.0.0.1:${HOST_PORT}`;
const EXAMPLE_URL = 'https://blog.apify.com/what-is-web-scraping/';

interface HealthzResponse {
  status: string;
  storageDir: string;
  datasetCount: number;
}

interface DatasetItem {
  url?: string;
  loadedUrl?: string;
  markdown?: string;
  [key: string]: unknown;
}

// ── Docker container lifecycle ────────────────────────────────────────────────

function startContainer(): string {
  const out = execSync(
    [
      'docker run -d',
      `--name ctx-api-example-${Date.now()}`,
      `--publish 127.0.0.1:${HOST_PORT}:8080`,
      `--env CONTEXTRACTOR_API_TOKEN=${API_TOKEN}`,
      IMAGE,
      'serve --host 0.0.0.0 --port 8080',
    ].join(' '),
    { encoding: 'utf8' },
  ).trim();
  return out; // container ID
}

function stopContainer(id: string): void {
  execSync(`docker stop ${id}`, { stdio: 'ignore' });
  execSync(`docker rm ${id}`, { stdio: 'ignore' });
}

function execInContainer(id: string, args: string): string {
  return execSync(
    `docker exec ${id} node /app/dist/cli.js ${args}`,
    { encoding: 'utf8' },
  );
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function get<T>(path: string, auth = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (auth) headers.Authorization = `Bearer ${API_TOKEN}`;

  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Poll until healthy ────────────────────────────────────────────────────────

async function waitForHealthy(maxWaitMs = 15_000): Promise<HealthzResponse> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      return await get<HealthzResponse>('/healthz', false);
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Container did not become healthy within ${maxWaitMs}ms`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`Starting container (image: ${IMAGE})...`);
  const containerId = startContainer();
  console.log(`Container started: ${containerId.slice(0, 12)}`);

  try {
    console.log('Waiting for /healthz...');
    const health = await waitForHealthy();
    console.log(`Healthy: storageDir=${health.storageDir}, datasets=${health.datasetCount}`);

    // Run extraction inside the container using the CLI.
    console.log(`\nExtracting: ${EXAMPLE_URL}`);
    execInContainer(
      containerId,
      `extract "${EXAMPLE_URL}" --save markdown --no-stdout`,
    );
    console.log('Extraction complete.');

    // Retrieve results via the HTTP API.
    const items = await get<DatasetItem[]>('/v2/datasets/default/items?limit=10');
    console.log(`\nDataset items: ${items.length}`);
    for (const item of items) {
      console.log(JSON.stringify(item, null, 2));
    }
  } finally {
    console.log('\nStopping container...');
    stopContainer(containerId);
    console.log('Done.');
  }
}

await main();
