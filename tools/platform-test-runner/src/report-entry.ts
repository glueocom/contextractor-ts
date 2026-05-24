/** Report entry for markdown table */
export interface ReportEntry {
  suiteName: string;
  testCaseSlug: string;
  url: string;
  status: 'success' | 'error';
  errorMessage: string | null;
}
