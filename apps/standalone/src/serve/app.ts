import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { Dataset } from '../storage/dataset.js';
import { KeyValueStore } from '../storage/key-value-store.js';
import { isLoopback, isRunningInDocker } from './docker.js';

export interface ServeOptions {
  storageDir: string;
  host: string;
  token: string | undefined;
  insecure: boolean;
}

/** Apify-compatible error envelope */
function apiError(type: string, message: string, status: 400 | 401 | 403 | 404 | 500) {
  return new Response(JSON.stringify({ error: { type, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Apify-compatible data envelope for collection responses */
function apiData(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function listDatasets(storageDir: string): Promise<string[]> {
  const dir = path.join(storageDir, 'datasets');
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function listKvStores(storageDir: string): Promise<string[]> {
  const dir = path.join(storageDir, 'key_value_stores');
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

/** Validate startup options and throw a descriptive error if invalid. */
export function validateServeOptions(opts: {
  host: string;
  token: string | undefined;
  insecure: boolean;
}): void {
  const inDocker = isRunningInDocker();

  if (!inDocker && !isLoopback(opts.host)) {
    throw new Error(
      'The npm distribution of contextractor only serves on localhost. ' +
        'To expose the API on the network, use the Docker image ' +
        '(see https://github.com/glueo/contextractor).',
    );
  }

  if (inDocker && !isLoopback(opts.host) && !opts.token && !opts.insecure) {
    throw new Error(
      'CONTEXTRACTOR_API_TOKEN is required when binding to a non-loopback address. ' +
        'Set the env var or pass --insecure (development only).',
    );
  }
}

export function buildServeApp(opts: ServeOptions): Hono {
  const app = new Hono();

  // Auth middleware — applies to /v2/* only (not /healthz).
  app.use('/v2/*', async (c, next) => {
    const inDocker = isRunningInDocker();

    // No auth required on loopback in either mode.
    if (isLoopback(opts.host)) {
      // Still honour the token if set (defence-in-depth).
      if (opts.token) {
        const auth = c.req.header('Authorization');
        if (auth !== `Bearer ${opts.token}`) {
          return apiError('UNAUTHORIZED', 'Invalid or missing Authorization header', 401);
        }
      }
      await next();
      return;
    }

    // Non-loopback Docker mode.
    if (inDocker && opts.insecure) {
      console.error('[WARN] Running with --insecure: no authentication enforced');
      await next();
      return;
    }

    if (opts.token) {
      const auth = c.req.header('Authorization');
      if (auth !== `Bearer ${opts.token}`) {
        return apiError('UNAUTHORIZED', 'Invalid or missing Authorization header', 401);
      }
    }

    await next();
  });

  // ──────────────────────────────────────────
  // /healthz — always unauthenticated
  // ──────────────────────────────────────────
  app.get('/healthz', async () => {
    const names = await listDatasets(opts.storageDir);
    return jsonResponse({
      status: 'ok',
      storageDir: opts.storageDir,
      datasetCount: names.length,
    });
  });

  // ──────────────────────────────────────────
  // Datasets
  // ──────────────────────────────────────────
  app.get('/v2/datasets', async () => {
    const names = await listDatasets(opts.storageDir);
    const items = await Promise.all(
      names.map(async (n) => {
        const ds = new Dataset(opts.storageDir, n);
        return ds.metadata();
      }),
    );
    return apiData({ items, total: items.length });
  });

  app.get('/v2/datasets/:name', async (c) => {
    const name = c.req.param('name');
    const ds = new Dataset(opts.storageDir, name);
    const meta = await ds.metadata();
    return apiData(meta);
  });

  app.delete('/v2/datasets/:name', async (c) => {
    const name = c.req.param('name');
    const ds = new Dataset(opts.storageDir, name);
    await ds.drop();
    return apiData({ deleted: true });
  });

  app.get('/v2/datasets/:name/items', async (c) => {
    const name = c.req.param('name');
    const ds = new Dataset(opts.storageDir, name);

    const offset = Number(c.req.query('offset') ?? '0');
    const limit = Number(c.req.query('limit') ?? '1000');
    const desc = c.req.query('desc') === 'true' || c.req.query('desc') === '1';
    const format = c.req.query('format') ?? 'json';

    const result = await ds.getItems({ offset, limit, desc });

    const headers: Record<string, string> = {
      'X-Apify-Pagination-Total': String(result.total),
      'X-Apify-Pagination-Offset': String(result.offset),
      'X-Apify-Pagination-Limit': String(result.limit),
      'X-Apify-Pagination-Count': String(result.count),
    };

    if (format === 'jsonl') {
      const body = result.items.map((item) => JSON.stringify(item)).join('\n');
      return new Response(body, {
        headers: { ...headers, 'Content-Type': 'application/x-ndjson' },
      });
    }

    if (format === 'csv') {
      const body = toCSV(result.items);
      return new Response(body, {
        headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' },
      });
    }

    return new Response(JSON.stringify(result.items), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  });

  app.post('/v2/datasets/:name/items', async (c) => {
    const name = c.req.param('name');
    const ds = new Dataset(opts.storageDir, name);
    const body: unknown = await c.req.json();
    const items = Array.isArray(body) ? body : [body];
    await ds.pushData(items);
    return apiData({ itemCount: await ds.count() }, 201);
  });

  // ──────────────────────────────────────────
  // Key-Value Stores
  // ──────────────────────────────────────────
  app.get('/v2/key-value-stores', async () => {
    const names = await listKvStores(opts.storageDir);
    const items = await Promise.all(
      names.map(async (n) => {
        const kvs = new KeyValueStore(opts.storageDir, n);
        return kvs.listKeys({ limit: 0 }).then(() => ({ name: n }));
      }),
    );
    return apiData({ items, total: items.length });
  });

  app.get('/v2/key-value-stores/:name/keys', async (c) => {
    const name = c.req.param('name');
    const kvs = new KeyValueStore(opts.storageDir, name);
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;
    const exclusiveStartKey = c.req.query('exclusiveStartKey');
    const result = await kvs.listKeys({ limit, exclusiveStartKey });
    return apiData(result);
  });

  app.get('/v2/key-value-stores/:name/records/:key', async (c) => {
    const name = c.req.param('name');
    const key = c.req.param('key');
    const kvs = new KeyValueStore(opts.storageDir, name);
    const record = await kvs.getValue(key);
    if (!record) return apiError('NOT_FOUND', `Record '${key}' not found`, 404);
    return new Response(new Uint8Array(record.value), {
      headers: { 'Content-Type': record.contentType },
    });
  });

  app.put('/v2/key-value-stores/:name/records/:key', async (c) => {
    const name = c.req.param('name');
    const key = c.req.param('key');
    const contentType = c.req.header('Content-Type') ?? 'application/octet-stream';
    const kvs = new KeyValueStore(opts.storageDir, name);
    const body = await c.req.arrayBuffer();
    await kvs.setValue(key, Buffer.from(new Uint8Array(body)), contentType);
    return apiData({ key });
  });

  app.delete('/v2/key-value-stores/:name/records/:key', async (c) => {
    const name = c.req.param('name');
    const key = c.req.param('key');
    const kvs = new KeyValueStore(opts.storageDir, name);
    await kvs.deleteValue(key);
    return apiData({ deleted: true });
  });

  // ──────────────────────────────────────────
  // contextractor-specific: POST /v2/extract
  // ──────────────────────────────────────────
  // NOTE: actual extraction requires the Playwright crawler which starts a
  // browser — that is too heavy to run inline in the HTTP handler for v1.
  // This endpoint is a placeholder that returns a 501 with a clear message.
  app.post('/v2/extract', async () => {
    return apiError(
      'NOT_IMPLEMENTED',
      'POST /v2/extract is not yet implemented. Use the CLI: contextractor extract <url>',
      500,
    );
  });

  // ──────────────────────────────────────────
  // OpenAPI + Swagger UI
  // ──────────────────────────────────────────
  app.get('/openapi.json', () => {
    return jsonResponse(buildOpenApiSpec());
  });

  app.get('/docs', () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Contextractor API</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" >
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"> </script>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"> </script>
<script>
window.onload = function() {
  SwaggerUIBundle({
    url: "/openapi.json",
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: "StandaloneLayout"
  })
}
</script>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  });

  return app;
}

function toCSV(items: unknown[]): string {
  if (items.length === 0) return '';
  const first = items[0];
  if (!first || typeof first !== 'object') {
    return items.map(String).join('\n');
  }
  const keys = Object.keys(first as object);
  const header = keys.map(csvCell).join(',');
  const rows = items.map((item) => {
    const row = item as Record<string, unknown>;
    return keys.map((k) => csvCell(String(row[k] ?? ''))).join(',');
  });
  return [header, ...rows].join('\n');
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildOpenApiSpec(): unknown {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Contextractor Local API',
      version: '1.0.0',
      description: 'Apify-compatible local storage API for contextractor',
    },
    paths: {
      '/healthz': {
        get: {
          summary: 'Health check',
          responses: { '200': { description: 'OK' } },
        },
      },
      '/v2/datasets': {
        get: {
          summary: 'List datasets',
          responses: { '200': { description: 'OK' } },
        },
      },
      '/v2/datasets/{name}/items': {
        get: {
          summary: 'Get dataset items',
          parameters: [
            { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
            {
              name: 'format',
              in: 'query',
              schema: { type: 'string', enum: ['json', 'jsonl', 'csv'] },
            },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } },
            { name: 'desc', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          summary: 'Append items to dataset',
          responses: { '201': { description: 'Created' } },
        },
      },
      '/v2/key-value-stores/{name}/records/{key}': {
        get: {
          summary: 'Get KVS record',
          parameters: [
            { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'key', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'OK' },
            '404': { description: 'Not found' },
          },
        },
        put: {
          summary: 'Put KVS record',
          responses: { '200': { description: 'OK' } },
        },
        delete: {
          summary: 'Delete KVS record',
          responses: { '200': { description: 'OK' } },
        },
      },
    },
  };
}
