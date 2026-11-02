import { describe, it, expect } from 'vitest';
import {
  stripAnsi,
  parseTypeScriptErrors,
  parseVitestErrors,
  parseESLintErrors,
  parseGenericBuildErrors,
  extractDiagnostics,
  formatSelfHealingPrompt,
} from '../../src/services/diagnostics.js';
import type { VerificationResult } from '../../src/types/execution.js';

describe('Diagnostics & Error Parsing Engine', () => {
  it('strips ANSI escape codes cleanly', () => {
    const raw = '\u001b[31m\u001b[1mError:\u001b[22m\u001b[39m Something broke\u001b[0m\r\nnext line';
    const clean = stripAnsi(raw);
    expect(clean).toBe('Error: Something broke\nnext line');
  });

  it('parses TypeScript compiler errors accurately', () => {
    const tscOutput = `
src/services/git-ops.ts(42,15): error TS2339: Property 'worktree' does not exist on type 'GitStatus'.
src/components/Sidebar.tsx:18:7 - error TS2322: Type 'string' is not assignable to type 'number'.
  The expected type comes from property 'count' which is declared here on type 'BadgeProps'
    <Badge count="5" />
          ~~~~~
Found 2 errors in 2 files.
`;
    const issues = parseTypeScriptErrors(tscOutput);
    expect(issues.length).toBe(2);

    expect(issues[0].file).toBe('src/services/git-ops.ts');
    expect(issues[0].line).toBe(42);
    expect(issues[0].column).toBe(15);
    expect(issues[0].code).toBe('TS2339');
    expect(issues[0].message).toContain("Property 'worktree' does not exist on type 'GitStatus'");

    expect(issues[1].file).toBe('src/components/Sidebar.tsx');
    expect(issues[1].line).toBe(18);
    expect(issues[1].column).toBe(7);
    expect(issues[1].code).toBe('TS2322');
    expect(issues[1].message).toContain("The expected type comes from property 'count'");
  });

  it('parses Vitest test runner failures with assertion differences', () => {
    const vitestOutput = `
 ❯ tests/unit/executor.test.ts (6 tests | 1 failed)
   × ImplementationExecutor > should handle isolated worktree
     → AssertionError: expected false to be true
       - Expected: true
       + Received: false

       at tests/unit/executor.test.ts:88:24
       at file:///node_modules/vitest/dist/runner.js:120:10
`;
    const issues = parseVitestErrors(vitestOutput);
    expect(issues.length).toBe(1);

    expect(issues[0].file).toBe('tests/unit/executor.test.ts');
    expect(issues[0].line).toBe(88);
    expect(issues[0].column).toBe(24);
    expect(issues[0].message).toContain('should handle isolated worktree');
    expect(issues[0].expected).toBe('true');
    expect(issues[0].actual).toBe('false');
  });

  it('parses ESLint rule violations', () => {
    const eslintOutput = `
src/adapters/antigravity.ts
  25:7  error  'unusedVar' is assigned a value but never used  @typescript-eslint/no-unused-vars
  32:1  warning  Unexpected console statement                 no-console
`;
    const issues = parseESLintErrors(eslintOutput);
    expect(issues.length).toBe(2);
    expect(issues[0].file).toBe('src/adapters/antigravity.ts');
    expect(issues[0].line).toBe(25);
    expect(issues[0].column).toBe(7);
    expect(issues[0].code).toBe('@typescript-eslint/no-unused-vars');
    expect(issues[0].message).toContain("'unusedVar' is assigned a value but never used");
  });

  it('extracts build errors with generic fallback parser', () => {
    const buildOutput = `
./src/app/page.tsx:14:10
Type error: Cannot find module '@/components/Missing' or its corresponding type declarations.
`;
    const issues = parseGenericBuildErrors(buildOutput);
    expect(issues.length).toBe(1);
    expect(issues[0].file).toBe('src/app/page.tsx');
    expect(issues[0].line).toBe(14);
    expect(issues[0].column).toBe(10);
  });

  it('aggregates diagnostic report and deduplicates affected files', () => {
    const results: VerificationResult[] = [
      {
        name: 'typecheck',
        command: 'npm run typecheck',
        status: 'failed',
        durationMs: 400,
        output: 'src/app.ts:10:5 - error TS2304: Cannot find name \'Config\'.',
      },
      {
        name: 'test',
        command: 'npm test',
        status: 'failed',
        durationMs: 800,
        output: 'FAIL tests/app.test.ts > suite > test\nAssertionError: expected 1 to be 2\nat tests/app.test.ts:20:10',
      },
      {
        name: 'lint',
        command: 'npm run lint',
        status: 'passed',
        durationMs: 200,
        output: 'All clean',
      },
    ];

    const report = extractDiagnostics(results);
    expect(report.totalErrors).toBe(2);
    expect(report.affectedFiles).toContain('src/app.ts');
    expect(report.affectedFiles).toContain('tests/app.test.ts');
    expect(report.summary).toContain('Found 2 issue(s) across 2 file(s)');
  });

  it('formats an actionable self-healing prompt with stagnation guidance when needed', () => {
    const results: VerificationResult[] = [
      {
        name: 'typecheck',
        command: 'npm run typecheck',
        status: 'failed',
        durationMs: 400,
        output: 'src/app.ts:10:5 - error TS2304: Cannot find name \'Config\'.',
      },
    ];

    const report = extractDiagnostics(results);
    const prompt = formatSelfHealingPrompt({
      report,
      issueIdentifier: 'TEST-101',
      issueTitle: 'Add Config',
      attempt: 2,
      maxAttempts: 3,
      previousIssuesCount: 1, // Stagnation: still 1 error
    });

    expect(prompt).toContain('TEST-101');
    expect(prompt).toContain('Attempt 2 of 3');
    expect(prompt).toContain('Stagnation Warning');
    expect(prompt).toContain('src/app.ts:10:5');
    expect(prompt).toContain('Cannot find name \'Config\'');
    expect(prompt).toContain('CRITICAL RESOLUTION INSTRUCTIONS');
  });
});
