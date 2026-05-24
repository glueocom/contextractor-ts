import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ReportEntry } from './report-entry.js';
import { OUTPUT_DIR } from './runner.js';
import type { SuiteRunResult } from './suite-run-result.js';

/**
 * Collect all report entries from suite results
 */
function collectReportEntries(suiteResults: SuiteRunResult[]): ReportEntry[] {
  const entries: ReportEntry[] = [];

  for (const suite of suiteResults) {
    for (const [testCaseSlug, result] of suite.results) {
      entries.push({
        suiteName: suite.suiteSlug,
        testCaseSlug,
        url: result.url,
        status: result.status,
        errorMessage: result.errorMessage,
      });
    }
  }

  return entries;
}

/**
 * Generate markdown report table
 */
function generateMarkdownTable(entries: ReportEntry[]): string {
  const lines: string[] = [];

  lines.push('| Suite | Test Case | URL | Status | Error |');
  lines.push('|-------|-----------|-----|--------|-------|');

  for (const entry of entries) {
    const statusIcon = entry.status === 'success' ? '✅' : '❌';
    const errorText = entry.errorMessage
      ? entry.errorMessage.replace(/\|/g, '\\|').slice(0, 100)
      : '-';
    const truncatedUrl = entry.url.length > 60 ? `${entry.url.slice(0, 57)}...` : entry.url;

    lines.push(
      `| ${entry.suiteName} | ${entry.testCaseSlug} | ${truncatedUrl} | ${statusIcon} | ${errorText} |`,
    );
  }

  return lines.join('\n');
}

/**
 * Generate the full report.md content
 */
function generateReportContent(suiteResults: SuiteRunResult[]): string {
  const entries = collectReportEntries(suiteResults);

  const totalTests = entries.length;
  const passedTests = entries.filter((e) => e.status === 'success').length;
  const failedTests = entries.filter((e) => e.status === 'error').length;

  const lines: string[] = [];

  lines.push('# Contextractor Test Results Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total test cases:** ${totalTests}`);
  lines.push(`- **Passed:** ${passedTests} ✅`);
  lines.push(`- **Failed:** ${failedTests} ❌`);
  lines.push('');
  lines.push('## Results');
  lines.push('');
  lines.push(generateMarkdownTable(entries));
  lines.push('');

  if (failedTests > 0) {
    lines.push('## Failed Test Cases');
    lines.push('');
    for (const entry of entries.filter((e) => e.status === 'error')) {
      lines.push(`### ${entry.suiteName}/${entry.testCaseSlug}`);
      lines.push('');
      lines.push(`- **URL:** ${entry.url}`);
      lines.push(`- **Error:** ${entry.errorMessage || 'Unknown'}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Generate and save the report.md file
 */
export async function generateReport(suiteResults: SuiteRunResult[]): Promise<void> {
  const content = generateReportContent(suiteResults);
  const reportPath = path.join(OUTPUT_DIR, 'report.md');

  await fs.writeFile(reportPath, content);
  console.log(`\nReport saved to: ${reportPath}`);
}
