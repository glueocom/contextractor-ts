import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/**
 * Resolves the storage root directory using the following precedence (first wins):
 * 1. `storageDir` parameter (from --storage-dir CLI flag)
 * 2. `CONTEXTRACTOR_STORAGE_DIR` env var
 * 3. `./storage` if cwd contains `.actor/` or an existing `./storage/` directory
 * 4. `${XDG_DATA_HOME:-~/.local/share}/contextractor/storage`
 *
 * All returned paths are fully resolved (symlinks expanded) so that callers
 * comparing paths don't trip over macOS /var → /private/var aliasing.
 */
export function resolveStorageDir(opts: { storageDir?: string } = {}): string {
  if (opts.storageDir) {
    return path.resolve(opts.storageDir);
  }

  const envVar = process.env.CONTEXTRACTOR_STORAGE_DIR;
  if (envVar) {
    return path.resolve(envVar);
  }

  // Resolve cwd through symlinks to avoid macOS /var → /private/var mismatches.
  let cwd: string;
  try {
    cwd = realpathSync(process.cwd());
  } catch {
    cwd = process.cwd();
  }

  if (existsSync(path.join(cwd, '.actor')) || existsSync(path.join(cwd, 'storage'))) {
    return path.join(cwd, 'storage');
  }

  const xdgDataHome = process.env.XDG_DATA_HOME ?? path.join(homedir(), '.local', 'share');
  return path.join(xdgDataHome, 'contextractor', 'storage');
}
