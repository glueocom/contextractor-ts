import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveStorageDir } from './resolve-storage-dir.js';

let tmpDir: string;
let originalCwd: string;
let originalEnv: NodeJS.ProcessEnv;

beforeEach(async () => {
  // Resolve symlinks so that path comparisons work on macOS (/var → /private/var).
  tmpDir = realpathSync(await mkdtemp(path.join(tmpdir(), 'ctx-resolve-test-')));
  originalCwd = process.cwd();
  // Capture env vars we will mutate.
  originalEnv = {
    CONTEXTRACTOR_STORAGE_DIR: process.env.CONTEXTRACTOR_STORAGE_DIR,
    XDG_DATA_HOME: process.env.XDG_DATA_HOME,
  };
});

afterEach(async () => {
  process.chdir(originalCwd);
  // Restore env vars.
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  await rm(tmpDir, { recursive: true, force: true });
});

describe('resolveStorageDir', () => {
  it('--storage-dir flag takes precedence over env var and heuristics', () => {
    process.env.CONTEXTRACTOR_STORAGE_DIR = path.join(tmpDir, 'from-env');
    const result = resolveStorageDir({ storageDir: path.join(tmpDir, 'from-flag') });
    expect(result).toBe(path.join(tmpDir, 'from-flag'));
  });

  it('CONTEXTRACTOR_STORAGE_DIR env var takes precedence over .actor/ heuristic and XDG fallback', async () => {
    // Create .actor/ dir in tmpDir so the heuristic would fire.
    await mkdir(path.join(tmpDir, '.actor'), { recursive: true });
    process.chdir(tmpDir);
    const envPath = path.join(tmpDir, 'from-env');
    process.env.CONTEXTRACTOR_STORAGE_DIR = envPath;

    const result = resolveStorageDir();
    expect(result).toBe(envPath);
  });

  it('presence of .actor/ in cwd resolves to ./storage', async () => {
    delete process.env.CONTEXTRACTOR_STORAGE_DIR;
    await mkdir(path.join(tmpDir, '.actor'), { recursive: true });
    process.chdir(tmpDir);

    const result = resolveStorageDir();
    expect(result).toBe(path.join(tmpDir, 'storage'));
  });

  it('falls back to XDG_DATA_HOME/contextractor/storage when no other signal is present', () => {
    delete process.env.CONTEXTRACTOR_STORAGE_DIR;
    process.chdir(tmpDir); // clean dir — no .actor/, no ./storage
    process.env.XDG_DATA_HOME = path.join(tmpDir, 'xdg');

    const result = resolveStorageDir();
    expect(result).toBe(path.join(tmpDir, 'xdg', 'contextractor', 'storage'));
  });
});
