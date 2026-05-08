import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isLoopback, isRunningInDocker, LOOPBACK_HOSTS } from './docker.js';

let originalDockerEnv: string | undefined;

beforeEach(() => {
  originalDockerEnv = process.env.CONTEXTRACTOR_DOCKER;
});

afterEach(() => {
  if (originalDockerEnv === undefined) {
    delete process.env.CONTEXTRACTOR_DOCKER;
  } else {
    process.env.CONTEXTRACTOR_DOCKER = originalDockerEnv;
  }
});

describe('isRunningInDocker', () => {
  it('returns true when CONTEXTRACTOR_DOCKER is "1"', () => {
    process.env.CONTEXTRACTOR_DOCKER = '1';
    expect(isRunningInDocker()).toBe(true);
  });

  it('returns false when CONTEXTRACTOR_DOCKER is unset', () => {
    delete process.env.CONTEXTRACTOR_DOCKER;
    expect(isRunningInDocker()).toBe(false);
  });

  it('returns false when CONTEXTRACTOR_DOCKER is "0"', () => {
    process.env.CONTEXTRACTOR_DOCKER = '0';
    expect(isRunningInDocker()).toBe(false);
  });

  it('returns false when CONTEXTRACTOR_DOCKER is "true" (only "1" triggers Docker mode)', () => {
    process.env.CONTEXTRACTOR_DOCKER = 'true';
    expect(isRunningInDocker()).toBe(false);
  });
});

describe('LOOPBACK_HOSTS', () => {
  it('contains 127.0.0.1, ::1, and localhost', () => {
    expect(LOOPBACK_HOSTS.has('127.0.0.1')).toBe(true);
    expect(LOOPBACK_HOSTS.has('::1')).toBe(true);
    expect(LOOPBACK_HOSTS.has('localhost')).toBe(true);
  });
});

describe('isLoopback', () => {
  it('returns true for 127.0.0.1', () => {
    expect(isLoopback('127.0.0.1')).toBe(true);
  });

  it('returns true for ::1', () => {
    expect(isLoopback('::1')).toBe(true);
  });

  it('returns true for localhost', () => {
    expect(isLoopback('localhost')).toBe(true);
  });

  it('returns false for 0.0.0.0', () => {
    expect(isLoopback('0.0.0.0')).toBe(false);
  });

  it('returns false for a public IP address', () => {
    expect(isLoopback('192.168.1.1')).toBe(false);
  });
});
