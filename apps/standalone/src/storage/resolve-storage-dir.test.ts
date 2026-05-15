import { mkdirSync, mkdtempSync, realpathSync, rmdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveStorageDir } from './resolve-storage-dir.js';

describe('resolveStorageDir', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      CONTEXTRACTOR_STORAGE_DIR: process.env.CONTEXTRACTOR_STORAGE_DIR,
      CRAWLEE_STORAGE_DIR: process.env.CRAWLEE_STORAGE_DIR,
      XDG_DATA_HOME: process.env.XDG_DATA_HOME,
    };
    delete process.env.CONTEXTRACTOR_STORAGE_DIR;
    delete process.env.CRAWLEE_STORAGE_DIR;
    delete process.env.XDG_DATA_HOME;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  });

  it('--storage-dir flag takes precedence over everything', () => {
    process.env.CONTEXTRACTOR_STORAGE_DIR = '/should/not/be/used';
    const result = resolveStorageDir('/my/custom/dir');
    expect(result).toBe(path.resolve('/my/custom/dir'));
  });

  it('CONTEXTRACTOR_STORAGE_DIR takes precedence over CRAWLEE_STORAGE_DIR, heuristics, and XDG', () => {
    process.env.CONTEXTRACTOR_STORAGE_DIR = '/from/contextractor';
    process.env.CRAWLEE_STORAGE_DIR = '/from/crawlee';
    const result = resolveStorageDir();
    expect(result).toBe(path.resolve('/from/contextractor'));
  });

  it('CRAWLEE_STORAGE_DIR takes precedence over heuristics and XDG when CONTEXTRACTOR_STORAGE_DIR is absent', () => {
    process.env.CRAWLEE_STORAGE_DIR = '/from/crawlee';
    const result = resolveStorageDir();
    expect(result).toBe(path.resolve('/from/crawlee'));
  });

  it('resolves to ./storage when .actor/ exists in cwd', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'contextractor-test-'));
    mkdirSync(path.join(tmpDir, '.actor'));
    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const result = resolveStorageDir();
      const realTmpDir = realpathSync(tmpDir);
      expect(result).toBe(path.join(realTmpDir, 'storage'));
    } finally {
      process.chdir(origCwd);
      rmdirSync(path.join(tmpDir, '.actor'));
      rmdirSync(tmpDir);
    }
  });

  it('falls back to XDG_DATA_HOME/contextractor/storage when no other signal is present', () => {
    process.env.XDG_DATA_HOME = '/my/xdg';
    const result = resolveStorageDir();
    expect(result).toBe('/my/xdg/contextractor/storage');
  });

  it('falls back to ~/.local/share/contextractor/storage when XDG_DATA_HOME is absent', () => {
    const result = resolveStorageDir();
    const expected = path.join(os.homedir(), '.local', 'share', 'contextractor', 'storage');
    expect(result).toBe(expected);
  });
});
