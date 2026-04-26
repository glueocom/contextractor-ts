import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../fixtures');

export function loadHtmlFixture(suite: string, testCase: string): string {
    return readFileSync(join(FIXTURES_DIR, suite, `${testCase}.html`), 'utf8');
}
