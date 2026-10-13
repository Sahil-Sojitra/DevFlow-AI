import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import {
  AntigravityAdapter,
  AntigravitySecurityError,
  AntigravityConcurrencyError,
  sanitizeEnvironment,
} from '../../src/adapters/antigravity.js';
import type { AppConfig } from '../../src/config/env.js';

/**
 * Creates a mock ChildProcess for testing.
 */
function createMockChildProcess(): {
  child: ChildProcess;
  stdout: Readable;
  stderr: Readable;
  emitClose: (code: number, signal?: NodeJS.Signals) => void;
  emitError: (err: Error) => void;
  killMock: ReturnType<typeof vi.fn>;
} {
  const emitter = new EventEmitter() as unknown as ChildProcess;
  const stdout = new Readable({ read() {} });
  const stderr = new Readable({ read() {} });
  const killMock = vi.fn();

  (emitter as any).stdout = stdout;
  (emitter as any).stderr = stderr;
  (emitter as any).kill = killMock;
  (emitter as any).exitCode = null;
  (emitter as any).killed = false;

  const sendStdout = (data: string) => {
    stdout.emit('data', Buffer.from(data));
  };

  const sendStderr = (data: string) => {
    stderr.emit('data', Buffer.from(data));
  };

  const emitClose = (code: number, signal?: NodeJS.Signals) => {
    (emitter as any).exitCode = code;
    emitter.emit('close', code, signal ?? null);
  };

  const emitError = (err: Error) => {
    emitter.emit('error', err);
  };

  return {
    child: emitter,
    stdout,
    stderr,
    sendStdout,
    sendStderr,
    emitClose,
    emitError,
    killMock,
  };
}

describe('AntigravityAdapter', () => {
  const allowedDir = path.resolve('C:\\test-workspace');
  const mockConfig: AppConfig = {
    antigravityBinPath: 'C:\\test\\agy.exe',
    allowedWorkingDirs: [allowedDir],
    defaultTimeoutMs: 5000,
    enableIntegrationTest: false,
  };

  describe('Input Validation & Security', () => {
    it('throws when prompt is empty or only whitespace', async () => {
      const adapter = new AntigravityAdapter(mockConfig);
      await expect(
        adapter.executePrompt({ workingDir: allowedDir, prompt: '' })
      ).rejects.toThrow();

      await expect(
        adapter.executePrompt({ workingDir: allowedDir, prompt: '   \n  \t ' })
      ).rejects.toThrow();
    });

    it('throws AntigravitySecurityError when working directory is not allowed', async () => {
      const adapter = new AntigravityAdapter(mockConfig);
      const unauthorizedDir = path.resolve('C:\\unauthorized-workspace');

      await expect(
        adapter.executePrompt({ workingDir: unauthorizedDir, prompt: 'Say hello' })
      ).rejects.toThrow(AntigravitySecurityError);
    });

    it('rejects path traversal attempts outside allowed directory', async () => {
      const adapter = new AntigravityAdapter(mockConfig);
      const traversalDir = path.join(allowedDir, '..', 'other-workspace');

      await expect(
        adapter.executePrompt({ workingDir: traversalDir, prompt: 'Say hello' })
      ).rejects.toThrow(AntigravitySecurityError);
    });

    it('sanitizes sensitive environment variables', () => {
      const dirtyEnv = {
        PATH: 'C:\\Windows\\system32',
        SYSTEMROOT: 'C:\\Windows',
        OPENAI_API_KEY: 'sk-secret123',
        GITHUB_TOKEN: 'ghp_secret456',
        USER_AUTH_COOKIE: 'session_val',
        DATABASE_PASSWORD: 'supersecret',
        MY_SECRET: 'hidden',
        SAFE_APP_NAME: 'DevFlow',
      };

      const cleanEnv = sanitizeEnvironment(dirtyEnv);

      expect(cleanEnv.PATH).toBe('C:\\Windows\\system32');
      expect(cleanEnv.SAFE_APP_NAME).toBe('DevFlow');
      expect(cleanEnv.OPENAI_API_KEY).toBeUndefined();
      expect(cleanEnv.GITHUB_TOKEN).toBeUndefined();
      expect(cleanEnv.USER_AUTH_COOKIE).toBeUndefined();
      expect(cleanEnv.DATABASE_PASSWORD).toBeUndefined();
      expect(cleanEnv.MY_SECRET).toBeUndefined();
    });
  });

  describe('Process Execution Handling', () => {
    it('successfully executes prompt and parses JSON output', async () => {
      const mock = createMockChildProcess();
      const mockSpawn = vi.fn().mockReturnValue(mock.child);

      const adapter = new AntigravityAdapter(mockConfig, mockSpawn as any);

      const promise = adapter.executePrompt({
        workingDir: allowedDir,
        prompt: 'Return pong',
        outputFormat: 'json',
      });

      // Assert safe spawn arguments were passed
      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const [binPath, args, spawnOpts] = mockSpawn.mock.calls[0];
      expect(binPath).toBe(mockConfig.antigravityBinPath);
      expect(args).toEqual([
        '--print',
        'Return pong',
        '--output-format',
        'json',
        '--disable-slash-commands',
      ]);
      expect(spawnOpts.shell).toBe(false);
      expect(spawnOpts.cwd).toBe(allowedDir);

      // Simulate stdout and process close
      const jsonResponse = JSON.stringify({
        conversation_id: 'test-conv-123',
        status: 'SUCCESS',
        response: 'pong',
        duration_seconds: 1.2,
      });
      mock.sendStdout(jsonResponse);
      mock.emitClose(0);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.parsedOutput).toBeDefined();
      expect(result.parsedOutput?.response).toBe('pong');
      expect(result.parsedOutput?.conversation_id).toBe('test-conv-123');
      expect(result.error).toBeUndefined();
    });

    it('handles non-zero process exit codes', async () => {
      const mock = createMockChildProcess();
      const mockSpawn = vi.fn().mockReturnValue(mock.child);

      const adapter = new AntigravityAdapter(mockConfig, mockSpawn as any);

      const promise = adapter.executePrompt({
        workingDir: allowedDir,
        prompt: 'Invalid prompt',
        outputFormat: 'text',
      });

      mock.sendStderr('Unknown flag error');
      mock.emitClose(1);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown flag error');
      expect(result.error).toContain('non-zero code 1');
    });

    it('handles missing binary launch errors (ENOENT)', async () => {
      const mock = createMockChildProcess();
      const mockSpawn = vi.fn().mockReturnValue(mock.child);

      const adapter = new AntigravityAdapter(mockConfig, mockSpawn as any);

      const promise = adapter.executePrompt({
        workingDir: allowedDir,
        prompt: 'Say hi',
      });

      const enoentErr = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
      mock.emitError(enoentErr);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.exitCode).toBeNull();
      expect(result.error).toContain('Antigravity CLI binary not found at');
    });

    it('handles execution timeouts and terminates child process', async () => {
      const mock = createMockChildProcess();
      const mockSpawn = vi.fn().mockReturnValue(mock.child);

      const adapter = new AntigravityAdapter(mockConfig, mockSpawn as any);

      const promise = adapter.executePrompt({
        workingDir: allowedDir,
        prompt: 'Long running prompt',
        timeoutMs: 50,
      });

      // Wait for timeout to trigger kill
      await new Promise((r) => setTimeout(r, 80));
      expect(mock.killMock).toHaveBeenCalledWith('SIGTERM');

      mock.emitClose(null as any, 'SIGTERM');

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.error).toContain('timed out after 50ms');
    });

    it('prevents concurrent executions on the same directory', async () => {
      const mock1 = createMockChildProcess();
      const mockSpawn = vi.fn().mockReturnValue(mock1.child);

      const adapter = new AntigravityAdapter(mockConfig, mockSpawn as any);

      // Start first execution
      const promise1 = adapter.executePrompt({
        workingDir: allowedDir,
        prompt: 'Prompt 1',
      });

      // Second execution on same directory should immediately reject
      await expect(
        adapter.executePrompt({
          workingDir: allowedDir,
          prompt: 'Prompt 2',
        })
      ).rejects.toThrow(AntigravityConcurrencyError);

      // Finish first execution
      mock1.emitClose(0);
      await promise1;

      // After first completes, a new execution is allowed
      const mock2 = createMockChildProcess();
      mockSpawn.mockReturnValueOnce(mock2.child);

      const promise3 = adapter.executePrompt({
        workingDir: allowedDir,
        prompt: 'Prompt 3',
      });
      mock2.emitClose(0);
      const res3 = await promise3;
      expect(res3.success).toBe(true);
    });
  });
});
