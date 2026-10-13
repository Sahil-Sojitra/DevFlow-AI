import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { getAppConfig, type AppConfig } from '../config/env.js';
import {
  AntigravityJsonOutputSchema,
  AntigravityPromptOptionsSchema,
  type AntigravityExecutionResult,
  type AntigravityPromptOptions,
} from '../types/antigravity.js';

/**
 * Custom error types for adapter operations.
 */
export class AntigravitySecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AntigravitySecurityError';
  }
}

export class AntigravityConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AntigravityConcurrencyError';
  }
}

/**
 * Minimal set of safe environment variable names or patterns to inherit.
 * Excludes all API keys, secrets, tokens, cookies, and auth credentials.
 */
const SENSITIVE_KEY_PATTERNS = [
  /key/i,
  /secret/i,
  /token/i,
  /cookie/i,
  /auth/i,
  /pass(word)?/i,
  /cred(ential)?/i,
  /private/i,
];

/**
 * Filter host environment variables to ensure no secrets or sensitive tokens
 * are leaked to the child agent process.
 */
export function sanitizeEnvironment(
  rawEnv: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const cleanEnv: NodeJS.ProcessEnv = {};

  for (const [key, value] of Object.entries(rawEnv)) {
    if (value === undefined) continue;

    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (!isSensitive) {
      cleanEnv[key] = value;
    }
  }

  return cleanEnv;
}

/**
 * Adapter for invoking the Antigravity CLI in a safe, non-interactive, and monitored manner.
 */
export class AntigravityAdapter {
  private readonly config: AppConfig;
  private readonly spawnProcess: typeof spawn;
  private readonly activeDirectories = new Set<string>();

  constructor(
    config?: AppConfig,
    spawnFn: typeof spawn = spawn
  ) {
    this.config = config ?? getAppConfig();
    this.spawnProcess = spawnFn;
  }

  /**
   * Asserts that the working directory is allowed by current configuration.
   */
  public validateWorkingDirectory(workingDir: string): string {
    const resolvedDir = path.resolve(workingDir);

    const isAllowed = this.config.allowedWorkingDirs.some((allowed) => {
      const resolvedAllowed = path.resolve(allowed);
      // Equal to allowed dir or sub-path of allowed dir
      const relative = path.relative(resolvedAllowed, resolvedDir);
      return !relative.startsWith('..') && !path.isAbsolute(relative);
    });

    if (!isAllowed) {
      throw new AntigravitySecurityError(
        `Working directory "${resolvedDir}" is not permitted. Allowed paths: ${this.config.allowedWorkingDirs.join(', ')}`
      );
    }

    return resolvedDir;
  }

  /**
   * Executes a harmless, read-only prompt against the Antigravity CLI non-interactively.
   */
  public async executePrompt(
    rawOptions: AntigravityPromptOptions
  ): Promise<AntigravityExecutionResult> {
    // 1. Validate inputs via Zod schema
    const options = AntigravityPromptOptionsSchema.parse(rawOptions);

    // 2. Validate and resolve working directory security restriction
    const resolvedWorkingDir = this.validateWorkingDirectory(options.workingDir);

    // 3. Concurrency guard: prevent concurrent execution on the same directory
    if (this.activeDirectories.has(resolvedWorkingDir)) {
      throw new AntigravityConcurrencyError(
        `An Antigravity execution is already in progress for directory: ${resolvedWorkingDir}`
      );
    }

    this.activeDirectories.add(resolvedWorkingDir);

    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs;

    // 4. Construct argument-safe CLI arguments
    const args: string[] = [
      '--print',
      options.prompt,
      '--output-format',
      options.outputFormat,
      '--disable-slash-commands',
    ];

    if (options.effort) {
      args.push('--effort', options.effort);
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    const cleanEnv = sanitizeEnvironment();

    try {
      return await this.runProcess({
        cliPath: this.config.antigravityBinPath,
        args,
        cwd: resolvedWorkingDir,
        env: cleanEnv,
        timeoutMs,
        outputFormat: options.outputFormat,
        startTime,
      });
    } finally {
      this.activeDirectories.delete(resolvedWorkingDir);
    }
  }

  /**
   * Internal runner to handle child process lifecycle, streaming buffers, and timeouts.
   */
  private runProcess(params: {
    cliPath: string;
    args: string[];
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeoutMs: number;
    outputFormat: 'json' | 'text';
    startTime: number;
  }): Promise<AntigravityExecutionResult> {
    return new Promise((resolve) => {
      let stdoutData = '';
      let stderrData = '';
      let timedOut = false;
      let timer: NodeJS.Timeout | null = null;
      let child: ChildProcess;

      try {
        child = this.spawnProcess(params.cliPath, params.args, {
          cwd: params.cwd,
          env: params.env,
          shell: false, // Security: Never invoke via shell
          windowsHide: true,
        });
      } catch (err: unknown) {
        const durationMs = Date.now() - params.startTime;
        const message = err instanceof Error ? err.message : String(err);
        return resolve({
          success: false,
          exitCode: null,
          signal: null,
          stdout: '',
          stderr: '',
          durationMs,
          timedOut: false,
          error: `Failed to launch Antigravity CLI process: ${message}`,
        });
      }

      if (params.timeoutMs > 0) {
        timer = setTimeout(() => {
          timedOut = true;
          try {
            child.kill('SIGTERM');
            // Grace fallback on Windows if process does not exit promptly
            setTimeout(() => {
              if (child.exitCode === null && !child.killed) {
                child.kill('SIGKILL');
              }
            }, 2000).unref();
          } catch {
            // Ignore kill errors
          }
        }, params.timeoutMs);
      }

      if (child.stdout) {
        child.stdout.on('data', (chunk) => {
          stdoutData += chunk.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          stderrData += chunk.toString();
        });
      }

      child.on('error', (err: NodeJS.ErrnoException) => {
        if (timer) clearTimeout(timer);
        const durationMs = Date.now() - params.startTime;

        let errorMsg = `Antigravity CLI process error: ${err.message}`;
        if (err.code === 'ENOENT') {
          errorMsg = `Antigravity CLI binary not found at "${params.cliPath}". Ensure it is installed and configured in ANTIGRAVITY_BIN_PATH.`;
        }

        resolve({
          success: false,
          exitCode: null,
          signal: null,
          stdout: stdoutData,
          stderr: stderrData,
          durationMs,
          timedOut: false,
          error: errorMsg,
        });
      });

      child.on('close', (code, signal) => {
        if (timer) clearTimeout(timer);
        const durationMs = Date.now() - params.startTime;

        if (timedOut) {
          return resolve({
            success: false,
            exitCode: code,
            signal,
            stdout: stdoutData,
            stderr: stderrData,
            durationMs,
            timedOut: true,
            error: `Antigravity CLI execution timed out after ${params.timeoutMs}ms`,
          });
        }

        const success = code === 0;
        let parsedOutput: AntigravityExecutionResult['parsedOutput'] = null;
        let parseError: string | undefined;

        if (params.outputFormat === 'json' && stdoutData.trim().length > 0) {
          try {
            const rawJson = JSON.parse(stdoutData.trim());
            const validated = AntigravityJsonOutputSchema.safeParse(rawJson);
            if (validated.success) {
              parsedOutput = validated.data;
            } else {
              parseError = `Failed to validate Antigravity JSON output: ${validated.error.message}`;
            }
          } catch (jsonErr: unknown) {
            parseError = `Failed to parse Antigravity output as JSON: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`;
          }
        }

        let errorMessage: string | undefined;
        if (!success) {
          errorMessage = `Antigravity CLI process exited with non-zero code ${code}${signal ? ` (signal: ${signal})` : ''}`;
        } else if (parseError) {
          errorMessage = parseError;
        }

        resolve({
          success: success && !parseError,
          exitCode: code,
          signal,
          stdout: stdoutData,
          stderr: stderrData,
          durationMs,
          timedOut: false,
          parsedOutput,
          error: errorMessage,
        });
      });
    });
  }
}
