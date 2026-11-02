import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { getAppConfig, type AppConfig } from '../config/env.js';
import { getCustomRepositories } from '../services/repo-registry.js';
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
  rawEnv: Record<string, string | undefined> = process.env
): NodeJS.ProcessEnv {
  const cleanEnv: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(rawEnv)) {
    if (value === undefined) continue;

    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (!isSensitive) {
      cleanEnv[key] = value;
    }
  }

  return cleanEnv as NodeJS.ProcessEnv;
}

/**
 * Formats an NDJSON stream line from Antigravity CLI into a clean human-readable log message.
 */
export function formatAgyStreamEvent(eventObj: any): string | null {
  if (!eventObj || typeof eventObj !== 'object') return null;

  if (eventObj.event === 'step_update' && eventObj.step_update) {
    const step = eventObj.step_update;

    // Tool usage events (file writes, edits, reads, searches)
    if (step.step_type === 'tool' && step.tool_info) {
      const toolName = step.tool_name || step.tool_info.name || 'tool';
      const params = step.tool_info.parameters || {};
      const rawPath = params.Path || params.path || params.file_path || '';
      const displayPath = rawPath ? rawPath.replace(/\\/g, '/').split('/').slice(-3).join('/') : '';

      if (step.state === 'ACTIVE') {
        if (toolName === 'write_to_file' || toolName === 'replace_file_content' || toolName === 'sed_file') {
          return `[agy] 📝 Writing file: ${displayPath || rawPath}`;
        } else if (toolName === 'view_file' || toolName === 'read_resource' || toolName === 'read_url_content') {
          return `[agy] 🔍 Reading file: ${displayPath || rawPath}`;
        } else if (toolName === 'grep_search' || toolName === 'find_by_name') {
          return `[agy] 🔎 Searching codebase: "${params.query || params.pattern || ''}"`;
        } else {
          return `[agy] ⚙️ Tool active: ${toolName}`;
        }
      } else if (step.state === 'DONE') {
        if (toolName === 'write_to_file' || toolName === 'replace_file_content') {
          return `[agy] ✓ Saved modifications to ${displayPath || rawPath}`;
        }
      } else if (step.state === 'ERROR') {
        const errorMsg = step.tool_info.error?.message || 'Tool execution error';
        return `[agy] ⚠️ Tool failed (${toolName}): ${errorMsg.slice(0, 200)}`;
      }
    }

    // Agent response / thinking events
    if (step.step_type === 'agent_response') {
      if (step.text_delta && typeof step.text_delta === 'string') {
        const trimmed = step.text_delta.trim();
        if (trimmed.length > 0) {
          return `[agy agent] ${trimmed}`;
        }
      } else if (step.state === 'DONE' && step.duration_seconds) {
        const tokenMsg = step.usage?.total_tokens ? ` (${step.usage.total_tokens} tokens)` : '';
        return `[agy] Step #${step.step_index} finished in ${step.duration_seconds.toFixed(1)}s${tokenMsg}`;
      }
    }
  }

  if (eventObj.event === 'result' && eventObj.result) {
    const res = eventObj.result;
    const dur = res.duration_seconds ? `${res.duration_seconds.toFixed(1)}s` : '';
    const tokens = res.usage?.total_tokens ? `${res.usage.total_tokens} tokens` : '';
    const stats = [dur, tokens].filter(Boolean).join(', ');
    return `[agy result] Agent completed execution${stats ? ` (${stats})` : ''}.`;
  }

  return null;
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

    const customRepos = getCustomRepositories();
    const allAllowed = [...this.config.allowedWorkingDirs, ...customRepos];

    const isAllowed = allAllowed.some((allowed) => {
      const resolvedAllowed = path.resolve(allowed);
      // Equal to allowed dir or sub-path of allowed dir
      const relative = path.relative(resolvedAllowed, resolvedDir);
      return !relative.startsWith('..') && !path.isAbsolute(relative);
    });

    if (!isAllowed) {
      throw new AntigravitySecurityError(
        `Working directory "${resolvedDir}" is not permitted. Allowed paths: ${allAllowed.join(', ')}`
      );
    }

    return resolvedDir;
  }

  /**
   * Executes a prompt against the Antigravity CLI non-interactively.
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

    if (options.mode) {
      args.push('--mode', options.mode);
    }

    if (options.effort) {
      args.push('--effort', options.effort);
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    if (options.dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
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
        onProgress: options.onProgress,
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
    outputFormat: 'json' | 'text' | 'stream-json';
    startTime: number;
    onProgress?: (chunk: string, stream: 'stdout' | 'stderr') => void;
  }): Promise<AntigravityExecutionResult> {
    return new Promise((resolve) => {
      let stdoutData = '';
      let stderrData = '';
      let stdoutLineBuffer = '';
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
          const str = chunk.toString();
          stdoutData += str;

          if (params.outputFormat === 'stream-json') {
            stdoutLineBuffer += str;
            const lines = stdoutLineBuffer.split('\n');
            stdoutLineBuffer = lines.pop() || ''; // Keep partial line in buffer

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const parsed = JSON.parse(trimmed);
                const formatted = formatAgyStreamEvent(parsed);
                if (formatted && params.onProgress) {
                  params.onProgress(formatted, 'stdout');
                }
              } catch {
                // If line isn't valid JSON, still surface it if meaningful
                if (params.onProgress && !trimmed.startsWith('{')) {
                  params.onProgress(`[agy] ${trimmed}`, 'stdout');
                }
              }
            }
          } else {
            if (params.onProgress) {
              params.onProgress(str, 'stdout');
            }
          }
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          const str = chunk.toString();
          stderrData += str;
          if (params.onProgress) {
            params.onProgress(str, 'stderr');
          }
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

        if (params.outputFormat === 'stream-json' && stdoutData.trim().length > 0) {
          try {
            const lines = stdoutData.trim().split('\n');
            let foundResult: any = null;

            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              if (line.includes('"event":"result"')) {
                try {
                  const data = JSON.parse(line);
                  if (data.result) {
                    foundResult = data.result;
                    break;
                  }
                } catch {
                  // Continue searching
                }
              }
            }

            if (foundResult) {
              const validated = AntigravityJsonOutputSchema.safeParse(foundResult);
              if (validated.success) {
                parsedOutput = validated.data;
              } else {
                parsedOutput = foundResult;
              }
            } else {
              // Fallback: search backwards for any line with response or status
              for (let i = lines.length - 1; i >= 0; i--) {
                try {
                  const parsed = JSON.parse(lines[i].trim());
                  if (parsed.response !== undefined || parsed.status !== undefined) {
                    parsedOutput = parsed;
                    break;
                  }
                } catch {
                  // Continue
                }
              }
            }
          } catch (streamErr: unknown) {
            parseError = `Failed to parse Antigravity stream-json: ${streamErr instanceof Error ? streamErr.message : String(streamErr)}`;
          }
        } else if (params.outputFormat === 'json' && stdoutData.trim().length > 0) {
          try {
            const rawJson = JSON.parse(stdoutData.trim());
            const validated = AntigravityJsonOutputSchema.safeParse(rawJson);
            if (validated.success) {
              parsedOutput = validated.data;
              if (
                parsedOutput.denied_actions &&
                parsedOutput.denied_actions.length > 0 &&
                (!parsedOutput.response || parsedOutput.response.trim().length === 0)
              ) {
                parseError = `Antigravity CLI action was denied in headless mode: ${parsedOutput.denied_actions.map((a) => a.display_name || a.action).join(', ')}`;
              }
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
