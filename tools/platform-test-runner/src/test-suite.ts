import type { ActorSettings } from './actor-settings.js';

/** Test suite loaded from disk */
export interface TestSuite {
  slug: string;
  description: string;
  settings: ActorSettings;
  testCases: TestCase[];
}

/** Individual test case */
export interface TestCase {
  slug: string;
  url: string;
  suiteSlug: string;
}
