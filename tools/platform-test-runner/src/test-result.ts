/** Result of running a single test case */
export interface TestResult {
  url: string;
  status: 'success' | 'error';
  errorMessage: string | null;
  datasetItemPath: string | null;
}
