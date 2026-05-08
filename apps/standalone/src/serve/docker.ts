/**
 * Returns true when the process is running inside a Docker container.
 *
 * Detection strategy: check for CONTEXTRACTOR_DOCKER=1 (set in the image ENV).
 * Using a single explicit env-var check makes the behaviour predictable and
 * testable without filesystem mocking.
 */
export function isRunningInDocker(): boolean {
  return process.env.CONTEXTRACTOR_DOCKER === '1';
}

/** LOOPBACK_HOSTS are the only allowed bind addresses in npm (non-Docker) mode. */
export const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

export function isLoopback(host: string): boolean {
  return LOOPBACK_HOSTS.has(host);
}
