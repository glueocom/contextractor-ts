import { realpathSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dataset } from '../storage/dataset.js';
import { buildServeApp, validateServeOptions } from './app.js';

// Mock isRunningInDocker so tests can exercise both npm and Docker mode
// without needing /.dockerenv on the test host.
vi.mock('./docker.js', () => ({
  isRunningInDocker: vi.fn(() => false),
  isLoopback: (host: string) => ['127.0.0.1', '::1', 'localhost'].includes(host),
  LOOPBACK_HOSTS: new Set(['127.0.0.1', '::1', 'localhost']),
}));

// Import the (mocked) module so we can change the mock per-test.
import * as dockerModule from './docker.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = realpathSync(await mkdtemp(path.join(tmpdir(), 'ctx-serve-test-')));
  // Reset to npm (non-Docker) mode before each test.
  vi.mocked(dockerModule.isRunningInDocker).mockReturnValue(false);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function makeApp(overrides: Partial<Parameters<typeof buildServeApp>[0]> = {}) {
  return buildServeApp({
    storageDir: tmpDir,
    host: '127.0.0.1',
    token: undefined,
    insecure: false,
    ...overrides,
  });
}

describe('GET /healthz', () => {
  it('returns status:ok and datasetCount without auth in all modes', async () => {
    const app = makeApp();
    const res = await app.request('/healthz');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; datasetCount: number };
    expect(body.status).toBe('ok');
    expect(typeof body.datasetCount).toBe('number');
  });
});

describe('GET /v2/datasets/default/items', () => {
  it('returns JSON array with all four pagination headers', async () => {
    const ds = new Dataset(tmpDir, 'default');
    await ds.pushData({ title: 'hello' });

    const app = makeApp();
    const res = await app.request('/v2/datasets/default/items');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Apify-Pagination-Total')).toBe('1');
    expect(res.headers.get('X-Apify-Pagination-Offset')).toBe('0');
    expect(res.headers.get('X-Apify-Pagination-Limit')).not.toBeNull();
    expect(res.headers.get('X-Apify-Pagination-Count')).toBe('1');

    const items = (await res.json()) as unknown[];
    expect(Array.isArray(items)).toBe(true);
  });

  it('returns NDJSON with Content-Type application/x-ndjson when format=jsonl', async () => {
    const ds = new Dataset(tmpDir, 'default');
    await ds.pushData({ a: 1 });

    const app = makeApp();
    const res = await app.request('/v2/datasets/default/items?format=jsonl');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/x-ndjson');
    const text = await res.text();
    expect(text.trim()).toBe('{"a":1}');
  });
});

describe('POST /v2/datasets/default/items', () => {
  it('appends a record; subsequent GET returns it', async () => {
    const app = makeApp();

    const postRes = await app.request('/v2/datasets/default/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'x', text: 'y' }),
    });
    expect(postRes.status).toBe(201);

    const getRes = await app.request('/v2/datasets/default/items');
    const items = (await getRes.json()) as Array<{ url: string; text: string }>;
    expect(items.length).toBe(1);
    expect(items[0]).toMatchObject({ url: 'x', text: 'y' });
  });
});

describe('serve security rules', () => {
  it('npm mode: non-loopback host rejects with the loopback-only error', () => {
    vi.mocked(dockerModule.isRunningInDocker).mockReturnValue(false);

    expect(() =>
      validateServeOptions({ host: '0.0.0.0', token: undefined, insecure: false }),
    ).toThrow(/npm distribution/);
  });

  it('Docker mode: non-loopback host without token rejects with token-required error', () => {
    vi.mocked(dockerModule.isRunningInDocker).mockReturnValue(true);

    expect(() =>
      validateServeOptions({ host: '0.0.0.0', token: undefined, insecure: false }),
    ).toThrow(/CONTEXTRACTOR_API_TOKEN/);
  });

  it('Docker mode: non-loopback host with valid token — missing Auth => 401; valid Auth => 200', async () => {
    vi.mocked(dockerModule.isRunningInDocker).mockReturnValue(true);

    const app = makeApp({ host: '0.0.0.0', token: 'secret-token' });

    const noAuth = await app.request('/v2/datasets');
    expect(noAuth.status).toBe(401);

    const withAuth = await app.request('/v2/datasets', {
      headers: { Authorization: 'Bearer secret-token' },
    });
    expect(withAuth.status).toBe(200);
  });
});
