#!/usr/bin/env tsx
/**
 * Dev utility for managing the contextractor global CLI installation.
 *
 * Commands:
 *   ensureuninstalled   Remove contextractor from npm global store and pnpm global store
 *   install     Build from source and install globally via pnpm
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BIN_NAME = "contextractor";
const STANDALONE_PKG = "@contextractor/standalone";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const STANDALONE_DIR = path.join(REPO_ROOT, "apps/standalone");

const SHELL = process.env.SHELL ?? "/bin/zsh";

function run(cmd: string, cwd?: string): void {
  console.log(`  > ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd, shell: SHELL });
}

function tryRun(cmd: string, cwd?: string): boolean {
  try {
    run(cmd, cwd);
    return true;
  } catch {
    return false;
  }
}

function uninstall(): void {
  console.log(`\n[pkg] Uninstalling ${BIN_NAME}…`);

  const removedNpm = tryRun(`npm uninstall -g ${BIN_NAME}`);
  if (!removedNpm) {
    const removedNpmScoped = tryRun(`npm uninstall -g ${STANDALONE_PKG}`);
    if (!removedNpmScoped) {
      console.log(`  (npm global: not installed or already removed)`);
    }
  }

  const removedPnpm = tryRun(`pnpm uninstall -g ${BIN_NAME}`);
  if (!removedPnpm) {
    const removedPnpmScoped = tryRun(`pnpm uninstall -g ${STANDALONE_PKG}`);
    if (!removedPnpmScoped) {
      console.log(`  (pnpm global: not installed or already removed)`);
    }
  }

  console.log(`[pkg] Uninstall complete.`);
}

function install(): void {
  uninstall();

  console.log(`\n[pkg] Building ${STANDALONE_PKG} from source…`);
  run("pnpm build", STANDALONE_DIR);

  console.log(`\n[pkg] Installing ${BIN_NAME} globally via npm…`);
  run(`npm install -g .`, STANDALONE_DIR);

  console.log(`\n[pkg] Install complete. Test with: ${BIN_NAME} --help`);
}

const command = process.argv[2];

if (command === "ensureuninstalled") {
  uninstall();
} else if (command === "install") {
  install();
} else {
  console.error(`Usage: pkg.ts <ensureuninstalled|install>`);
  process.exit(1);
}
