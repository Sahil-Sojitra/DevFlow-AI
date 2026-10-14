import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sanitizeEnvironment } from '../adapters/antigravity.js';
import type { VerificationCheckName, VerificationResult } from '../types/execution.js';

export interface ScriptCommandSpec {
  name: VerificationCheckName;
  command: string;
}

/**
 * Secret redaction pattern for verification output logs.
 */
const SECRET_REGEX = /(?:lin_api_[a-zA-Z0-9_-]+|ghp_[a-zA-Z0-9_-]+|bearer\s+[a-zA-Z0-9_\-\.]+)/gi;

export function redactSecrets(text: string): string {
  return text.replace(SECRET_REGEX, '[REDACTED_SECRET]');
}

/**
 * Service to discover and execute configured repository verification checks.
 */
export class VerificationService {
  /**
   * Discovers available configured verification checks in the repository's package.json.
   * Does NOT invent scripts that are not configured.
   */
  public static discoverChecks(targetDir: string): {
    configured: ScriptCommandSpec[];
    unconfigured: { name: VerificationCheckName; reason: string }[];
  } {
    const pkgPath = path.join(targetDir, 'package.json');
    const configured: ScriptCommandSpec[] = [];
    const unconfigured: { name: VerificationCheckName; reason: string }[] = [];

    let scripts: Record<string, string> = {};
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.scripts && typeof pkg.scripts === 'object') {
          scripts = pkg.scripts;
        }
      } catch {
        // Ignore json parse error
      }
    }

    // 1. Typecheck
    if (scripts['typecheck']) {
      configured.push({ name: 'typecheck', command: 'npm run typecheck' });
    } else if (scripts['type-check']) {
      configured.push({ name: 'typecheck', command: 'npm run type-check' });
    } else {
      unconfigured.push({
        name: 'typecheck',
        reason: 'No "typecheck" or "type-check" script found in package.json',
      });
    }

    // 2. Test
    if (scripts['test']) {
      configured.push({ name: 'test', command: 'npm test' });
    } else {
      unconfigured.push({
        name: 'test',
        reason: 'No "test" script found in package.json',
      });
    }

    // 3. Lint
    if (scripts['lint']) {
      configured.push({ name: 'lint', command: 'npm run lint' });
    } else {
      unconfigured.push({
        name: 'lint',
        reason: 'No "lint" script found in package.json',
      });
    }

    // 4. Build
    if (scripts['build']) {
      configured.push({ name: 'build', command: 'npm run build' });
    } else {
      unconfigured.push({
        name: 'build',
        reason: 'No "build" script found in package.json',
      });
    }

    return { configured, unconfigured };
  }

  /**
   * Executes all configured verification checks and records unconfigured ones.
   */
  public async runAllChecks(
    targetDir: string,
    timeoutMs = 60000,
    onProgress?: (checkName: string, status: string) => void
  ): Promise<VerificationResult[]> {
    const { configured, unconfigured } = VerificationService.discoverChecks(targetDir);
    const results: VerificationResult[] = [];

    // Run configured checks sequentially
    for (const spec of configured) {
      if (onProgress) {
        onProgress(spec.name, `Running ${spec.name} (${spec.command})...`);
      }

      const result = await this.runSingleCheck(targetDir, spec, timeoutMs);
      results.push(result);
    }

    // Record unconfigured checks
    for (const unconf of unconfigured) {
      results.push({
        name: unconf.name,
        command: 'N/A',
        status: 'not_configured',
        durationMs: 0,
        output: unconf.reason,
      });
    }

    return results;
  }

  /**
   * Runs a single check process safely with environment sanitization and bounded output.
   */
  private async runSingleCheck(
    targetDir: string,
    spec: ScriptCommandSpec,
    timeoutMs: number
  ): Promise<VerificationResult> {
    const startTime = Date.now();
    const cleanEnv = sanitizeEnvironment();

    try {
      // Split command (e.g., npm run typecheck -> npm, ['run', 'typecheck'])
      const tokens = spec.command.split(' ');
      const executable = tokens[0];
      const args = tokens.slice(1);

      // On Windows, npm is a batch file (npm.cmd)
      const isWindows = process.platform === 'win32';
      const actualExec = isWindows && executable === 'npm' ? 'npm.cmd' : executable;

      const proc = spawnSync(actualExec, args, {
        cwd: targetDir,
        env: cleanEnv,
        timeout: timeoutMs,
        shell: isWindows,
        windowsHide: true,
        maxBuffer: 2 * 1024 * 1024,
        encoding: 'utf8',
      });

      const durationMs = Date.now() - startTime;

      if (proc.error) {
        const isTimeout = (proc.error as any).code === 'ETIMEDOUT';
        const msg = isTimeout
          ? `Check timed out after ${timeoutMs}ms`
          : `Process error: ${proc.error.message}`;

        return {
          name: spec.name,
          command: spec.command,
          status: 'failed',
          durationMs,
          output: redactSecrets(msg),
          error: redactSecrets(msg),
        };
      }

      const stdout = proc.stdout || '';
      const stderr = proc.stderr || '';
      const combined = (stdout + (stderr ? `\n--- STDERR ---\n${stderr}` : '')).trim();

      // Bounded output snippet
      const truncated =
        combined.length > 4000
          ? combined.slice(0, 4000) + '\n... [output truncated for review] ...'
          : combined;

      const passed = proc.status === 0;

      return {
        name: spec.name,
        command: spec.command,
        status: passed ? 'passed' : 'failed',
        durationMs,
        output: redactSecrets(truncated || (passed ? 'Check passed with no output.' : 'Check failed with no output.')),
        error: passed ? undefined : `Exited with status code ${proc.status}`,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const msg = err instanceof Error ? err.message : String(err);
      return {
        name: spec.name,
        command: spec.command,
        status: 'failed',
        durationMs,
        output: redactSecrets(`Execution exception: ${msg}`),
        error: redactSecrets(msg),
      };
    }
  }
}
