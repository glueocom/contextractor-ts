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
