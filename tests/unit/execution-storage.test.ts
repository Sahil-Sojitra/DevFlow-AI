import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ExecutionStorageService,
  ExecutionConcurrencyError,
} from '../../src/services/execution-storage.js';
import type { ExecutionSessionRecord } from '../../src/types/execution.js';

describe('ExecutionStorageService', () => {
  const testSessionsDir = path.resolve('data', 'test-sessions');

  beforeEach(() => {
    if (fs.existsSync(testSessionsDir)) {
      fs.rmSync(testSessionsDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testSessionsDir)) {
      fs.rmSync(testSessionsDir, { recursive: true, force: true });
    }
  });

  const createMockSession = (id: string, issue: string): ExecutionSessionRecord => ({
    id,
    issueIdentifier: issue,
    issueTitle: 'Test Issue Title',
    planFilePath: '/data/plans/test.md',
    repositoryPath: 'D:/sample-repo',
    workingPath: 'D:/sample-repo',
    isIsolated: false,
    branch: 'main',
    baselineCommit: 'commit123',
    baselineDirtyCount: 0,
    baselineFiles: [],
    createdAt: new Date().toISOString(),
    status: 'queued',
    progressMessage: 'Session queued',
    logs: [{ timestamp: new Date().toISOString(), level: 'info', message: 'Initialized' }],
    changedFiles: [],
    verificationResults: [],
    implementationCompleted: false,
    verificationPassed: false,
  });

  it('saves and retrieves an execution session from disk', () => {
    const storage = new ExecutionStorageService(undefined, testSessionsDir);
    const session = createMockSession('sess_1', 'SAH-1');

    storage.saveSession(session);
    const loaded = storage.getSession('sess_1');

    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe('sess_1');
    expect(loaded?.issueIdentifier).toBe('SAH-1');
    expect(loaded?.status).toBe('queued');
  });

  it('prevents path traversal when retrieving session IDs', () => {
    const storage = new ExecutionStorageService(undefined, testSessionsDir);
    const traversal = storage.getSession('../../windows/system32/cmd');
    expect(traversal).toBeNull();
  });

  it('validates state transitions and updates session record', () => {
    const storage = new ExecutionStorageService(undefined, testSessionsDir);
    const session = createMockSession('sess_2', 'SAH-2');
    storage.saveSession(session);

    // queued -> running is valid
    const running = storage.transitionSession('sess_2', 'running', {
      startedAt: new Date().toISOString(),
      progressMessage: 'Agent is executing...',
    });
    expect(running.status).toBe('running');
    expect(running.startedAt).toBeDefined();

    // running -> verifying is valid
    const verifying = storage.transitionSession('sess_2', 'verifying');
    expect(verifying.status).toBe('verifying');

    // verifying -> completed is valid
    const completed = storage.transitionSession('sess_2', 'completed');
    expect(completed.status).toBe('completed');
    expect(completed.endedAt).toBeDefined();

    // completed -> running is valid for revisions
    const revised = storage.transitionSession('sess_2', 'running');
    expect(revised.status).toBe('running');

    // running -> cancelled is valid
    const cancelled = storage.transitionSession('sess_2', 'cancelled');
    expect(cancelled.status).toBe('cancelled');

    // cancelled -> running is terminal and INVALID and must throw
    expect(() => {
      storage.transitionSession('sess_2', 'running');
    }).toThrow('Invalid session status transition');
  });

  it('enforces concurrency locks to prevent duplicate executions for the same repository or issue', () => {
    const storage = new ExecutionStorageService(undefined, testSessionsDir);
    const repoPath = 'D:/projects/repo-alpha';
    const issueId = 'SAH-10';

    const release = storage.acquireExecutionLock(repoPath, issueId);

    // Attempting to lock same repository must fail
    expect(() => {
      storage.acquireExecutionLock(repoPath, 'OTHER-1');
    }).toThrow(ExecutionConcurrencyError);

    // Attempting to lock same issue must fail
    expect(() => {
      storage.acquireExecutionLock('D:/projects/other-repo', issueId);
    }).toThrow(ExecutionConcurrencyError);

    // Release lock
    release();

    // Now acquiring lock succeeds
    const release2 = storage.acquireExecutionLock(repoPath, issueId);
    expect(release2).toBeDefined();
    release2();
  });

  it('registers and cancels active processes', () => {
    const storage = new ExecutionStorageService(undefined, testSessionsDir);
    let cancelled = false;

    storage.registerActiveProcess('sess_cancel_test', () => {
      cancelled = true;
    });

    const didCancel = storage.cancelActiveProcess('sess_cancel_test');
    expect(didCancel).toBe(true);
    expect(cancelled).toBe(true);

    // Second cancel attempt returns false as process is unregistered
    const didCancelAgain = storage.cancelActiveProcess('sess_cancel_test');
    expect(didCancelAgain).toBe(false);
  });

  it('scrubs secrets from appended logs and error messages', () => {
    const storage = new ExecutionStorageService(undefined, testSessionsDir);
    const session = createMockSession('sess_secrets', 'SAH-3');
    storage.saveSession(session);

    storage.appendLog(
      'sess_secrets',
      'error',
      'Leaked lin_api_mySecretKey123 in stderr'
    );

    const loaded = storage.getSession('sess_secrets');
    const lastLog = loaded?.logs[loaded.logs.length - 1];
    expect(lastLog?.message).not.toContain('lin_api_mySecretKey123');
    expect(lastLog?.message).toContain('[REDACTED_SECRET]');
  });
});
