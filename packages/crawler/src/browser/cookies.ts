import { readFile, writeFile } from 'node:fs/promises';
import { PlaywrightBlocker } from '@ghostery/adblocker-playwright';
import type { Page } from 'playwright';

const FILTER_LISTS = [
  'https://easylist-downloads.adblockplus.org/easylist.txt',
  'https://easylist-downloads.adblockplus.org/easyprivacy.txt',
  'https://secure.fanboy.co.nz/fanboy-annoyance.txt',
  'https://secure.fanboy.co.nz/fanboy-cookiemonster.txt',
];

let blockerPromise: Promise<PlaywrightBlocker> | undefined;

export async function getBlocker(cachePath = '.cache/adblock-engine.bin'): Promise<PlaywrightBlocker> {
  if (!blockerPromise) {
    blockerPromise = PlaywrightBlocker.fromLists(globalThis.fetch, FILTER_LISTS, undefined, {
      path: cachePath,
      read: readFile,
      write: writeFile,
    });
  }
  return blockerPromise;
}

export async function installCookieDefences(page: Page): Promise<void> {
  const blocker = await getBlocker();
  await blocker.enableBlockingInPage(page);
}

export async function rejectViaAutoconsent(
  page: Page,
): Promise<{ cmp?: string; success: boolean }> {
  const mod = await import('@duckduckgo/autoconsent');
  const rulesModule = await import('@duckduckgo/autoconsent/rules/rules.json', {
    with: { type: 'json' },
  });
  const AutoConsent = (mod as { default: unknown }).default ?? mod;
  const rules = (rulesModule as { default: unknown }).default ?? rulesModule;

  const scriptContent = `(function(AutoConsentClass, rulesJson) {
    const ac = new AutoConsentClass(
      function(msg) {
        window.postMessage({ __autoconsentMsg: msg }, '*');
      },
      { enabled: true, autoAction: 'optOut', enableCosmeticRules: true, detectRetries: 20 },
      rulesJson
    );
    window.addEventListener('message', function(e) {
      if (e.data && e.data.__autoconsentReply) {
        ac.receiveMessageCallback(e.data.__autoconsentReply);
      }
    });
  })(${String(AutoConsent)}, ${JSON.stringify(rules)})`;

  await page.addInitScript({ content: scriptContent });

  return page.evaluate(() => {
    return new Promise<{ cmp?: string; success: boolean }>((resolve) => {
      window.addEventListener('message', (e) => {
        const msg = (e as MessageEvent<{ __autoconsentMsg?: { type: string; cmp?: string } }>).data?.__autoconsentMsg;
        if (!msg) return;
        if (msg.type === 'autoconsentDone') resolve({ cmp: msg.cmp, success: true });
        if (msg.type === 'autoconsentError') resolve({ success: false });
      });
      setTimeout(() => resolve({ success: false }), 8000);
    });
  });
}
