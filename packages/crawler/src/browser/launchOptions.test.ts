import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildBrowserLaunchOptions } from './launchOptions.js';

let originalEnv: string | undefined;

beforeEach(() => {
  originalEnv = process.env.CONTEXTRACTOR_NO_SANDBOX;
  delete process.env.CONTEXTRACTOR_NO_SANDBOX;
});

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.CONTEXTRACTOR_NO_SANDBOX;
  } else {
    process.env.CONTEXTRACTOR_NO_SANDBOX = originalEnv;
  }
});

describe('buildBrowserLaunchOptions', () => {
  it('chromium includes --disable-gpu and automation-control flag', () => {
    const opts = buildBrowserLaunchOptions({ launcher: 'chromium' });
    expect(opts.args).toContain('--disable-gpu');
    expect(opts.args).toContain('--disable-blink-features=AutomationControlled');
  });

  it('firefox does not include chromium-specific args', () => {
    const opts = buildBrowserLaunchOptions({ launcher: 'firefox' });
    expect(opts.args).not.toContain('--disable-gpu');
    expect(opts.args).not.toContain('--disable-blink-features=AutomationControlled');
  });

  it('CONTEXTRACTOR_NO_SANDBOX adds --no-sandbox for chromium', () => {
    process.env.CONTEXTRACTOR_NO_SANDBOX = '1';
    const opts = buildBrowserLaunchOptions({ launcher: 'chromium' });
    expect(opts.args).toContain('--no-sandbox');
  });

  it('CONTEXTRACTOR_NO_SANDBOX adds --no-sandbox for firefox too', () => {
    process.env.CONTEXTRACTOR_NO_SANDBOX = '1';
    const opts = buildBrowserLaunchOptions({ launcher: 'firefox' });
    expect(opts.args).toContain('--no-sandbox');
  });

  it('without CONTEXTRACTOR_NO_SANDBOX, --no-sandbox is absent', () => {
    const opts = buildBrowserLaunchOptions({ launcher: 'chromium' });
    expect(opts.args).not.toContain('--no-sandbox');
  });

  it('ignoreSslErrors: true sets ignoreHTTPSErrors to true', () => {
    const opts = buildBrowserLaunchOptions({ launcher: 'chromium', ignoreSslErrors: true });
    expect(opts.ignoreHTTPSErrors).toBe(true);
  });

  it('ignoreSslErrors: false does not set ignoreHTTPSErrors', () => {
    const opts = buildBrowserLaunchOptions({ launcher: 'chromium', ignoreSslErrors: false });
    expect(opts.ignoreHTTPSErrors).toBeUndefined();
  });

  it('returns an object with an args array when no special flags are set', () => {
    const opts = buildBrowserLaunchOptions({ launcher: 'firefox' });
    expect(Array.isArray(opts.args)).toBe(true);
  });
});
