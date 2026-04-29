import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PlaywrightBlocker } from '@ghostery/adblocker-playwright';
import type { Page } from 'playwright';

const FILTER_LISTS = [
  'https://easylist-downloads.adblockplus.org/easylist.txt',
  'https://easylist-downloads.adblockplus.org/easyprivacy.txt',
  'https://secure.fanboy.co.nz/fanboy-annoyance.txt',
  'https://secure.fanboy.co.nz/fanboy-cookiemonster.txt',
];

let blockerPromise: Promise<PlaywrightBlocker> | undefined;

export async function getBlocker(
  cachePath = '.cache/adblock-engine.bin',
): Promise<PlaywrightBlocker> {
  blockerPromise ??= mkdir(dirname(cachePath), { recursive: true }).then(() =>
    PlaywrightBlocker.fromLists(globalThis.fetch, FILTER_LISTS, undefined, {
      path: cachePath,
      read: readFile,
      write: writeFile,
    }),
  );

  return blockerPromise;
}

export async function installCookieDefences(page: Page): Promise<void> {
  const blocker = await getBlocker();
  await blocker.enableBlockingInPage(page);
}

interface AutoconsentResult {
  cmp?: string;
  success: boolean;
}

type AutoconsentCtor = new (
  sendMessage: (message: unknown) => void,
  options: {
    enabled: boolean;
    autoAction: 'optOut';
    enableCosmeticRules: boolean;
    detectRetries: number;
  },
  rules: unknown,
) => {
  receiveMessageCallback(message: unknown): void;
};

export async function rejectViaAutoconsent(page: Page): Promise<AutoconsentResult> {
  const mod = await import('@duckduckgo/autoconsent');
  const rulesModule = (await import('@duckduckgo/autoconsent/rules/rules.json', {
    with: { type: 'json' },
  })) as { default?: unknown };

  const AutoConsent = (mod.default ?? mod) as unknown as AutoconsentCtor;
  const rules = rulesModule.default ?? rulesModule;

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

  return page.evaluate<AutoconsentResult>(() => {
    return new Promise((resolve) => {
      window.addEventListener('message', (event) => {
        const message = (event.data as { __autoconsentMsg?: { cmp?: string; type?: string } } | null)
          ?.__autoconsentMsg;

        if (!message) return;
        if (message.type === 'autoconsentDone') resolve({ cmp: message.cmp, success: true });
        if (message.type === 'autoconsentError') resolve({ success: false });
      });

      setTimeout(() => resolve({ success: false }), 8_000);
    });
  });
}
