import type { TestResult } from './test-result.js';

/** Suite run result */
export interface SuiteRunResult {
  suiteSlug: string;
  results: Map<string, TestResult>;
  runId: string;
  datasetId: string;
}
