import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildBrowserLaunchOptions } from './launchOptions.js';

describe('buildBrowserLaunchOptions', () => {
  let savedNoSandbox: string | undefined;

  beforeEach(() => {
    savedNoSandbox = process.env.CONTEXTRACTOR_NO_SANDBOX;
    delete process.env.CONTEXTRACTOR_NO_SANDBOX;
  });

  afterEach(() => {
    if (savedNoSandbox === undefined) {
      delete process.env.CONTEXTRACTOR_NO_SANDBOX;
    } else {
      process.env.CONTEXTRACTOR_NO_SANDBOX = savedNoSandbox;
    }
  });

  it('chromium includes AutomationControlled and disable-gpu args', () => {
    const opts = buildBrowserLaunchOptions({ launcher: 'chromium' });
    expect(opts.args).toContain('--disable-gpu');
    expect(opts.args).toContain('--disable-blink-features=AutomationControlled');
  });

  it('firefox does not include chromium-specific args', () => {
    const opts = buildBrowserLaunchOptions({ launcher: 'firefox' });
    expect(opts.args).not.toContain('--disable-gpu');
    expect(opts.args).not.toContain('--disable-blink-features=AutomationControlled');
  });

  it('sets ignoreHTTPSErrors when ignoreSslErrors is true', () => {
    const opts = buildBrowserLaunchOptions({ launcher: 'chromium', ignoreSslErrors: true });
    expect(opts.ignoreHTTPSErrors).toBe(true);
  });

  it('does not set ignoreHTTPSErrors when ignoreSslErrors is false', () => {
    const opts = buildBrowserLaunchOptions({ launcher: 'chromium', ignoreSslErrors: false });
    expect(opts.ignoreHTTPSErrors).toBeUndefined();
  });

  it('adds --no-sandbox when CONTEXTRACTOR_NO_SANDBOX is set', () => {
    process.env.CONTEXTRACTOR_NO_SANDBOX = '1';
    const opts = buildBrowserLaunchOptions({ launcher: 'chromium' });
    expect(opts.args).toContain('--no-sandbox');
  });
});
