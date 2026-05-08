import { existsSync } from 'node:fs';

/**
 * Returns true when the process is running inside a Docker container.
 *
 * Detection strategy: check for /.dockerenv (created by Docker automatically
 * in every container) or CONTEXTRACTOR_DOCKER=1 (set in the image ENV for
 * cases where /.dockerenv is absent, e.g. in Kubernetes).
 */
export function isRunningInDocker(): boolean {
  return existsSync('/.dockerenv') || process.env.CONTEXTRACTOR_DOCKER === '1';
}

/** LOOPBACK_HOSTS are the only allowed bind addresses in npm (non-Docker) mode. */
export const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

export function isLoopback(host: string): boolean {
  return LOOPBACK_HOSTS.has(host);
}
