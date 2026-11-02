import path from 'node:path';
import type { VerificationResult, DiagnosticIssue } from '../types/execution.js';

export interface DiagnosticReport {
  totalErrors: number;
  issues: DiagnosticIssue[];
  affectedFiles: string[];
  summary: string;
}

/**
 * Strips ANSI terminal color and control escape codes from raw process output.
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r\n/g, '\n');
}

/**
 * Parses TypeScript compiler (tsc) stdout/stderr into structured DiagnosticIssue items.
 */
export function parseTypeScriptErrors(raw: string): DiagnosticIssue[] {
  const clean = stripAnsi(raw);
  const issues: DiagnosticIssue[] = [];
  const lines = clean.split('\n');

  // Common TSC error patterns:
  // 1) src/app.ts(25,10): error TS2322: Type 'string' is not assignable to type 'number'.
  // 2) src/app.ts:25:10 - error TS2322: Type 'string' is not assignable to type 'number'.
  const tscRegex1 = /^([a-zA-Z0-9_.\-\/\\]+\.(?:ts|tsx|js|jsx))\((\d+),(\d+)\):\s*error\s*(TS\d+):\s*(.+)$/;
  const tscRegex2 = /^([a-zA-Z0-9_.\-\/\\]+\.(?:ts|tsx|js|jsx)):(\d+):(\d+)\s*-\s*error\s*(TS\d+):\s*(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    let match = line.match(tscRegex1);
    if (!match) {
      match = line.match(tscRegex2);
    }

    if (match) {
      const file = match[1].replace(/\\/g, '/');
      const lineNum = parseInt(match[2], 10);
      const colNum = parseInt(match[3], 10);
      const code = match[4];
      let message = match[5].trim();

      // Check if subsequent lines are indented descriptions of this error
      let nextIdx = i + 1;
      const snippetLines: string[] = [];
      while (nextIdx < lines.length && (lines[nextIdx].startsWith('  ') || lines[nextIdx].startsWith('\t'))) {
        const subLine = lines[nextIdx].trim();
        if (subLine.length > 0) {
          if (!subLine.startsWith('~') && !subLine.startsWith('^')) {
            snippetLines.push(subLine);
          }
        }
        nextIdx++;
      }

      if (snippetLines.length > 0) {
        message = `${message} (${snippetLines.join(' ')})`;
      }

      issues.push({
        check: 'typecheck',
        file,
        line: lineNum,
        column: colNum,
        code,
        message,
      });
    }
  }

  return issues;
}

/**
 * Parses Vitest / Jest test runner failures into structured DiagnosticIssue items.
 */
export function parseVitestErrors(raw: string): DiagnosticIssue[] {
  const clean = stripAnsi(raw);
  const issues: DiagnosticIssue[] = [];
  const lines = clean.split('\n');

  let currentTestFile: string | undefined;
  let currentTestName: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 1) File header:
    // e.g. "FAIL tests/unit/executor.test.ts" or "❯ tests/unit/executor.test.ts (6 tests | 1 failed)"
    const fileHeaderMatch = line.match(/^(?:FAIL|❯)\s+([a-zA-Z0-9_.\-\/\\]+\.(?:test|spec)\.(?:ts|tsx|js|jsx))/);
    if (fileHeaderMatch) {
      currentTestFile = fileHeaderMatch[1].replace(/\\/g, '/');
    }

    // 2) Suite / test name header:
    // e.g. "× ImplementationExecutor > should handle isolated worktree"
    // or "FAIL tests/unit/executor.test.ts > suite > test"
    const testNameMatch = line.match(/^(?:×|✗|FAIL)\s+(?:[a-zA-Z0-9_.\-\/\\]+\.(?:test|spec)\.(?:ts|tsx|js|jsx)\s*>\s*)?(.+)/);
    if (testNameMatch) {
      currentTestName = testNameMatch[1].trim();
    }

    // Matching assertion error: AssertionError: expected false to be true
    const assertionMatch = line.match(/(?:AssertionError|Error):\s*(.+)/);
    if (assertionMatch) {
      const assertionMessage = assertionMatch[1].trim();

      // Look ahead for expected / actual / stack trace lines
      let expected: string | undefined;
      let actual: string | undefined;
      let failingFile = currentTestFile;
      let lineNum: number | undefined;
      let colNum: number | undefined;

      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const lookAhead = lines[j].trim();
        if (lookAhead.startsWith('- Expected') || lookAhead.startsWith('Expected:')) {
          expected = lookAhead.replace(/^-\s*Expected:?\s*/, '').trim();
        } else if (lookAhead.startsWith('+ Received') || lookAhead.startsWith('Received:') || lookAhead.startsWith('+ Actual')) {
          actual = lookAhead.replace(/^\+\s*(?:Received|Actual):?\s*/, '').trim();
        }

        // Stack trace line: at tests/unit/executor.test.ts:78:22
        const stackMatch = lookAhead.match(/at\s+(?:.+?\s+\()?([a-zA-Z0-9_.\-\/\\]+\.(?:test|spec|ts|tsx|js|jsx)):(\d+):(\d+)\)?/);
        if (stackMatch && !stackMatch[1].includes('node_modules')) {
          failingFile = stackMatch[1].replace(/\\/g, '/');
          lineNum = parseInt(stackMatch[2], 10);
          colNum = parseInt(stackMatch[3], 10);
          break;
        }
      }

      issues.push({
        check: 'test',
        file: failingFile,
        line: lineNum,
        column: colNum,
        message: currentTestName ? `[${currentTestName}] ${assertionMessage}` : assertionMessage,
        expected,
        actual,
      });
    }
  }

  // If Vitest returned non-zero but regex didn't catch assertion, capture summary
  if (issues.length === 0 && (clean.includes('FAIL') || clean.includes('Failed') || clean.includes('ERR_'))) {
    const errorLine = lines.find((l) => l.includes('Error:') || l.includes('FAIL')) || lines[0];
    issues.push({
      check: 'test',
      file: currentTestFile,
      message: errorLine.trim(),
    });
  }

  return issues;
}

/**
 * Parses ESLint output into structured DiagnosticIssue items.
 */
export function parseESLintErrors(raw: string): DiagnosticIssue[] {
  const clean = stripAnsi(raw);
  const issues: DiagnosticIssue[] = [];
  const lines = clean.split('\n');

  let currentFile: string | undefined;

  // ESLint standard format:
  // /path/to/file.ts
  //   15:3  error  'foo' is defined but never used  @typescript-eslint/no-unused-vars
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    if (trimmed.match(/^[a-zA-Z0-9_.\-\/\\]+\.(?:ts|tsx|js|jsx)$/)) {
      currentFile = trimmed.replace(/\\/g, '/');
      continue;
    }

    const ruleMatch = trimmed.match(/^(\d+):(\d+)\s+(error|warning)\s+(.+?)(?:\s{2,}([a-zA-Z0-9_\-\/@]+))?$/);
    if (ruleMatch) {
      issues.push({
        check: 'lint',
        file: currentFile,
        line: parseInt(ruleMatch[1], 10),
        column: parseInt(ruleMatch[2], 10),
        code: ruleMatch[5],
        message: `${ruleMatch[4]}${ruleMatch[5] ? ` (${ruleMatch[5]})` : ''}`,
      });
    }
  }

  return issues;
}

/**
 * Fallback parser for build and packaging errors (Next.js, Webpack, esbuild).
 */
export function parseGenericBuildErrors(raw: string): DiagnosticIssue[] {
  const clean = stripAnsi(raw);
  const issues: DiagnosticIssue[] = [];
  const lines = clean.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern: ./src/app/page.tsx:12:5
    // Type error: Cannot find name 'XYZ'
    const buildFileMatch = trimmed.match(/^(?:\.\/)?([a-zA-Z0-9_.\-\/\\]+\.(?:ts|tsx|js|jsx|css|mjs)):(\d+):(\d+)/);
    if (buildFileMatch) {
      issues.push({
        check: 'build',
        file: buildFileMatch[1].replace(/\\/g, '/'),
        line: parseInt(buildFileMatch[2], 10),
        column: parseInt(buildFileMatch[3], 10),
        message: trimmed,
      });
      continue;
    }

    if (trimmed.startsWith('Failed to compile') || trimmed.includes('Module not found') || trimmed.includes('SyntaxError')) {
      issues.push({
        check: 'build',
        message: trimmed,
      });
    }
  }

  if (issues.length === 0) {
    issues.push({
      check: 'build',
      message: clean.slice(0, 300) || 'Build check exited with non-zero exit code.',
    });
  }

  return issues;
}

/**
 * Extracts and aggregates all diagnostic issues across all verification checks.
 */
export function extractDiagnostics(verificationResults: VerificationResult[]): DiagnosticReport {
  const issues: DiagnosticIssue[] = [];

  for (const result of verificationResults) {
    if (result.status !== 'failed') continue;

    const raw = `${result.output}\n${result.error || ''}`;

    if (result.name === 'typecheck') {
      const parsed = parseTypeScriptErrors(raw);
      if (parsed.length > 0) {
        issues.push(...parsed);
      } else {
        issues.push({
          check: 'typecheck',
          message: stripAnsi(raw).slice(0, 400) || 'TypeScript compilation failed.',
        });
      }
    } else if (result.name === 'test') {
      const parsed = parseVitestErrors(raw);
      if (parsed.length > 0) {
        issues.push(...parsed);
      } else {
        issues.push({
          check: 'test',
          message: stripAnsi(raw).slice(0, 400) || 'Test runner failed.',
        });
      }
    } else if (result.name === 'lint') {
      const parsed = parseESLintErrors(raw);
      if (parsed.length > 0) {
        issues.push(...parsed);
      } else {
        issues.push({
          check: 'lint',
          message: stripAnsi(raw).slice(0, 400) || 'Linter reported violations.',
        });
      }
    } else if (result.name === 'build') {
      const parsed = parseGenericBuildErrors(raw);
      issues.push(...parsed);
    }
  }

  // Deduplicate files affected
  const affectedFilesSet = new Set<string>();
  for (const issue of issues) {
    if (issue.file) {
      affectedFilesSet.add(issue.file);
    }
  }

  const affectedFiles = Array.from(affectedFilesSet);
  const totalErrors = issues.length;

  const summary = totalErrors === 0
    ? 'All verification checks passed with 0 diagnostic errors.'
    : `Found ${totalErrors} issue(s) across ${affectedFiles.length} file(s) (${issues.map((i) => i.check).filter((v, idx, a) => a.indexOf(v) === idx).join(', ')}).`;

  return {
    totalErrors,
    issues,
    affectedFiles,
    summary,
  };
}

/**
 * Formats a laser-focused, structured self-healing prompt for Antigravity.
 */
export function formatSelfHealingPrompt(params: {
  report: DiagnosticReport;
  issueIdentifier: string;
  issueTitle: string;
  attempt: number;
  maxAttempts: number;
  previousIssuesCount?: number;
}): string {
  const { report, issueIdentifier, issueTitle, attempt, maxAttempts, previousIssuesCount } = params;

  // Group issues by check
  const grouped: Record<string, DiagnosticIssue[]> = {};
  for (const issue of report.issues) {
    if (!grouped[issue.check]) {
      grouped[issue.check] = [];
    }
    grouped[issue.check].push(issue);
  }

  const sections: string[] = [];

  for (const [checkName, checkIssues] of Object.entries(grouped)) {
    const listItems = checkIssues
      .map((issue) => {
        const fileLoc = issue.file
          ? `${issue.file}${issue.line ? `:${issue.line}${issue.column ? `:${issue.column}` : ''}` : ''}`
          : 'Repository';
        const codeTag = issue.code ? `[${issue.code}] ` : '';
        const expectedActual = issue.expected && issue.actual
          ? `\n    - Expected: ${issue.expected}\n    - Received: ${issue.actual}`
          : '';
        return `- **${fileLoc}**: ${codeTag}${issue.message}${expectedActual}`;
      })
      .join('\n');

    sections.push(`### [${checkName.toUpperCase()}] Issues (${checkIssues.length}):\n${listItems}`);
  }

  let progressNote = '';
  if (previousIssuesCount !== undefined) {
    if (report.totalErrors < previousIssuesCount) {
      progressNote = `> [!NOTE] Progress: Error count decreased from ${previousIssuesCount} to ${report.totalErrors}. Keep resolving the remaining issues below.`;
    } else if (report.totalErrors >= previousIssuesCount && attempt > 1) {
      progressNote = `> [!WARNING] Stagnation Warning: The error count did not decrease from the last attempt (${report.totalErrors} errors remain). Review your previous approach and consider fixing the underlying interface or test assertion directly.`;
    }
  }

  return `
You are an expert software developer resolving automated verification failures for Linear issue ${issueIdentifier} ("${issueTitle}").
This is Autonomous Self-Healing Attempt ${attempt} of ${maxAttempts}.

${progressNote ? `${progressNote}\n` : ''}
## DETECTED DIAGNOSTIC ISSUES (${report.totalErrors} errors in ${report.affectedFiles.length} file(s))
${sections.join('\n\n')}

## CRITICAL RESOLUTION INSTRUCTIONS:
1. TARGETED CODE REPAIR:
   - Edit the exact files and lines identified above to fix compiler errors, missing types, and failing test assertions.
   - Do NOT rewrite unrelated modules or refactor unrelated code.
2. FIX THE ROOT CAUSE:
   - If TypeScript errors: provide the exact missing props, interface definitions, or correct import paths.
   - If test assertion failures: inspect whether the implementation has a logic bug or if the test expectations need aligning with the approved requirements.
   - If build errors: ensure all imports exist, exports match, and syntax is valid.
3. DIRECT FILE WRITING ONLY:
   - Create or edit the code files directly using file editing tools.
   - (CRITICAL: Do NOT execute shell/terminal commands like npm, npx, git, etc. Terminal execution is disabled in headless mode).
4. VERIFICATION IS AUTOMATED:
   - DevFlow will automatically re-run the full verification pipeline after your edits are written.
`.trim();
}
