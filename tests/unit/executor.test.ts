import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { ImplementationExecutor } from '../../src/services/executor.js';
import { PlanStorageService } from '../../src/services/plan-storage.js';
import { RepositoryRegistry, setRegistryFileForTesting } from '../../src/services/repo-registry.js';
import { ExecutionStorageService } from '../../src/services/execution-storage.js';
import { AntigravityAdapter } from '../../src/adapters/antigravity.js';
import { VerificationService } from '../../src/services/verification.js';
import * as gitOps from '../../src/services/git-ops.js';
import type { AppConfig } from '../../src/config/env.js';

describe('ImplementationExecutor', () => {
  const testRoot = path.resolve('data', 'test-executor');
  const allowedRepo = path.join(testRoot, 'sample-repo');
  const plansDir = path.join(testRoot, 'plans');
  const sessionsDir = path.join(testRoot, 'sessions');

  const mockConfig: AppConfig = {
    antigravityBinPath: 'C:\\agy.exe',
    allowedWorkingDirs: [allowedRepo],
    defaultTimeoutMs: 15000,
    enableIntegrationTest: false,
    linearApiUrl: 'https://api.linear.app/graphql',
    enableLinearIntegrationTest: false,
    plansDir,
  };

  beforeEach(() => {
    setRegistryFileForTesting(path.join(testRoot, 'repositories.json'));
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(allowedRepo, { recursive: true });
    fs.mkdirSync(plansDir, { recursive: true });
    fs.mkdirSync(sessionsDir, { recursive: true });

    // Mock clean git tree by default
    vi.spyOn(gitOps, 'inspectGitWorkingTree').mockReturnValue({
      isClean: true,
      branch: 'main',
      headCommit: 'abc123456',
      staged: [],
      unstaged: [],
      untracked: [],
      allUncommitted: [],
    });

    vi.spyOn(gitOps, 'detectChangedFiles').mockReturnValue([
      { path: 'src/app.ts', status: 'modified', isPreExisting: false },
    ]);
  });

  afterEach(() => {
    setRegistryFileForTesting();
    vi.restoreAllMocks();
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  const setupPlan = (issueId: string, status: 'pending' | 'approved' | 'rejected') => {
    const planFile = path.join(plansDir, `${issueId}.md`);
    const content = `---
issue: "${issueId}"
title: "Implement Auth Flow"
repository: "${allowedRepo.replace(/\\/g, '/')}"
branch: "main"
generated_at: "2026-10-14T10:00:00.000Z"
---

# Implementation Plan for ${issueId}
Step 1: Create auth middleware.
`;
    fs.writeFileSync(planFile, content, 'utf8');

    const reviewsFile = path.join(plansDir, 'reviews.json');
    const reviews = {
      [issueId]: {
        issueIdentifier: issueId,
        status,
        updatedAt: new Date().toISOString(),
      },
    };
    fs.writeFileSync(reviewsFile, JSON.stringify(reviews, null, 2), 'utf8');
  };

  it('rejects execution when no implementation plan exists for the issue', async () => {
    const executor = new ImplementationExecutor({
      config: mockConfig,
      repoRegistry: new RepositoryRegistry(mockConfig),
      planStorage: new PlanStorageService(mockConfig),
      executionStorage: new ExecutionStorageService(mockConfig, sessionsDir),
    });

    await expect(
      executor.startExecutionSession({ issueIdentifier: 'NON-EXISTENT' })
    ).rejects.toThrow('No implementation plan found for issue "NON-EXISTENT"');
  });

  it('rejects execution when plan review status is pending', async () => {
    setupPlan('SAH-PENDING', 'pending');

    const executor = new ImplementationExecutor({
      config: mockConfig,
      repoRegistry: new RepositoryRegistry(mockConfig),
      planStorage: new PlanStorageService(mockConfig),
      executionStorage: new ExecutionStorageService(mockConfig, sessionsDir),
    });

    await expect(
      executor.startExecutionSession({ issueIdentifier: 'SAH-PENDING' })
    ).rejects.toThrow('Only explicitly approved plans can be executed');
  });

  it('rejects execution when plan review status is rejected', async () => {
    setupPlan('SAH-REJECTED', 'rejected');

    const executor = new ImplementationExecutor({
      config: mockConfig,
      repoRegistry: new RepositoryRegistry(mockConfig),
      planStorage: new PlanStorageService(mockConfig),
      executionStorage: new ExecutionStorageService(mockConfig, sessionsDir),
    });

    await expect(
      executor.startExecutionSession({ issueIdentifier: 'SAH-REJECTED' })
    ).rejects.toThrow('review status is "rejected"');
  });

  it('rejects execution when target repository is not in allowlist', async () => {
    setupPlan('SAH-UNAUTHORIZED', 'approved');

    const executor = new ImplementationExecutor({
      config: mockConfig,
      repoRegistry: new RepositoryRegistry(mockConfig),
      planStorage: new PlanStorageService(mockConfig),
      executionStorage: new ExecutionStorageService(mockConfig, sessionsDir),
    });

    await expect(
      executor.startExecutionSession({
        issueIdentifier: 'SAH-UNAUTHORIZED',
        repoPath: 'D:/some/unauthorized/path',
      })
    ).rejects.toThrow('not in the configured allowed repositories list');
  });

  it('blocks execution on a dirty repository if isolation is disabled', async () => {
    setupPlan('SAH-DIRTY', 'approved');

    // Mock dirty working tree
    vi.spyOn(gitOps, 'inspectGitWorkingTree').mockReturnValue({
      isClean: false,
      branch: 'main',
      headCommit: 'abc123456',
      staged: ['src/app.ts'],
      unstaged: ['src/config.ts'],
      untracked: [],
      allUncommitted: ['src/app.ts', 'src/config.ts'],
    });

    const executor = new ImplementationExecutor({
      config: mockConfig,
      repoRegistry: new RepositoryRegistry(mockConfig),
      planStorage: new PlanStorageService(mockConfig),
      executionStorage: new ExecutionStorageService(mockConfig, sessionsDir),
    });

    await expect(
      executor.startExecutionSession({
        issueIdentifier: 'SAH-DIRTY',
        useIsolation: false, // Isolation turned off
      })
    ).rejects.toThrow('has 2 uncommitted changes. Execution without isolation is blocked');
  });

  it('successfully starts an authorized execution session for an approved plan', async () => {
    setupPlan('SAH-APPROVED', 'approved');

    const mockAntigravity = new AntigravityAdapter(mockConfig);
    vi.spyOn(mockAntigravity, 'executePrompt').mockResolvedValue({
      success: true,
      exitCode: 0,
      signal: null,
      stdout: '{"status":"SUCCESS"}',
      stderr: '',
      durationMs: 1200,
      timedOut: false,
    });

    const mockVerification = new VerificationService();
    vi.spyOn(mockVerification, 'runAllChecks').mockResolvedValue([
      {
        name: 'typecheck',
        command: 'npm run typecheck',
        status: 'passed',
        durationMs: 300,
        output: 'Found 0 errors.',
      },
      {
        name: 'test',
        command: 'npm test',
        status: 'passed',
        durationMs: 400,
        output: 'Tests: 12 passed.',
      },
    ]);

    const storage = new ExecutionStorageService(mockConfig, sessionsDir);
    const executor = new ImplementationExecutor({
      config: mockConfig,
      antigravityAdapter: mockAntigravity,
      repoRegistry: new RepositoryRegistry(mockConfig),
      planStorage: new PlanStorageService(mockConfig),
      executionStorage: storage,
      verificationService: mockVerification,
    });

    const session = await executor.startExecutionSession({
      issueIdentifier: 'SAH-APPROVED',
      useIsolation: false,
    });

    expect(session).toBeDefined();
    expect(session.issueIdentifier).toBe('SAH-APPROVED');
    expect(session.status).toBe('queued');

    // Wait briefly for background pipeline to complete
    await new Promise((resolve) => setTimeout(resolve, 150));

    const finalSession = storage.getSession(session.id);
    expect(finalSession).toBeDefined();
    expect(finalSession?.status).toBe('completed');
    expect(finalSession?.implementationCompleted).toBe(true);
    expect(finalSession?.verificationPassed).toBe(true);
    expect(finalSession?.verificationResults.length).toBe(2);
  });

  it('autonomously recovers from verification failure via pinpoint self-healing loop', async () => {
    setupPlan('SAH-AUTOFIX', 'approved');

    const mockAntigravity = new AntigravityAdapter(mockConfig);
    const promptSpy = vi.spyOn(mockAntigravity, 'executePrompt').mockResolvedValue({
      success: true,
      exitCode: 0,
      signal: null,
      stdout: '{"status":"SUCCESS"}',
      stderr: '',
      durationMs: 800,
      timedOut: false,
    });

    const mockVerification = new VerificationService();
    // First verification call fails, second call passes after self-healing
    vi.spyOn(mockVerification, 'runAllChecks')
      .mockResolvedValueOnce([
        {
          name: 'typecheck',
          command: 'npm run typecheck',
          status: 'failed',
          durationMs: 300,
          output: "src/app.ts:10:5 - error TS2304: Cannot find name 'Config'.",
        },
      ])
      .mockResolvedValueOnce([
        {
          name: 'typecheck',
          command: 'npm run typecheck',
          status: 'passed',
          durationMs: 300,
          output: 'Found 0 errors.',
        },
      ]);

    const storage = new ExecutionStorageService(mockConfig, sessionsDir);
    const executor = new ImplementationExecutor({
      config: mockConfig,
      antigravityAdapter: mockAntigravity,
      repoRegistry: new RepositoryRegistry(mockConfig),
      planStorage: new PlanStorageService(mockConfig),
      executionStorage: storage,
      verificationService: mockVerification,
    });

    const session = await executor.startExecutionSession({
      issueIdentifier: 'SAH-AUTOFIX',
      useIsolation: false,
    });

    // Wait briefly for background pipeline to finish both passes
    await new Promise((resolve) => setTimeout(resolve, 250));

    const finalSession = storage.getSession(session.id);
    expect(finalSession).toBeDefined();
    expect(finalSession?.status).toBe('completed');
    expect(finalSession?.autoFixAttempts).toBe(1);
    expect(finalSession?.verificationPassed).toBe(true);

    // Verify self-healing prompt was dispatched with pinpoint diagnostic details
    expect(promptSpy).toHaveBeenCalledTimes(2);
    const repairPrompt = promptSpy.mock.calls[1][0].prompt;
    expect(repairPrompt).toContain('Autonomous Self-Healing Attempt 1 of 3');
    expect(repairPrompt).toContain('src/app.ts:10:5');
    expect(repairPrompt).toContain('[TS2304]');
    expect(repairPrompt).toContain('Cannot find name \'Config\'');
  });

  it('marks session as failed and attaches pinpoint diagnostics when auto-repair budget is exhausted', async () => {
    setupPlan('SAH-EXHAUSTED', 'approved');

    const mockAntigravity = new AntigravityAdapter(mockConfig);
    vi.spyOn(mockAntigravity, 'executePrompt').mockResolvedValue({
      success: true,
      exitCode: 0,
      signal: null,
      stdout: '{"status":"SUCCESS"}',
      stderr: '',
      durationMs: 500,
      timedOut: false,
    });

    const mockVerification = new VerificationService();
    // Always fails with TS error
    vi.spyOn(mockVerification, 'runAllChecks').mockResolvedValue([
      {
        name: 'typecheck',
        command: 'npm run typecheck',
        status: 'failed',
        durationMs: 250,
        output: "src/app.ts:10:5 - error TS2304: Cannot find name 'Config'.",
      },
    ]);

    const storage = new ExecutionStorageService(mockConfig, sessionsDir);
    const executor = new ImplementationExecutor({
      config: mockConfig,
      antigravityAdapter: mockAntigravity,
      repoRegistry: new RepositoryRegistry(mockConfig),
      planStorage: new PlanStorageService(mockConfig),
      executionStorage: storage,
      verificationService: mockVerification,
    });

    const session = await executor.startExecutionSession({
      issueIdentifier: 'SAH-EXHAUSTED',
      useIsolation: false,
    });

    // Wait for all 3 retry passes to complete
    await new Promise((resolve) => setTimeout(resolve, 350));

    const finalSession = storage.getSession(session.id);
    expect(finalSession).toBeDefined();
    expect(finalSession?.status).toBe('failed');
    expect(finalSession?.autoFixAttempts).toBe(3);
    expect(finalSession?.stuckInHallucination).toBe(true);
    expect(finalSession?.diagnostics).toBeDefined();
    expect(finalSession?.diagnostics?.length).toBe(1);
    expect(finalSession?.diagnostics?.[0].file).toBe('src/app.ts');
    expect(finalSession?.diagnostics?.[0].code).toBe('TS2304');
  });
  it('creates ticket branch and preserves baseBranch on execution session', async () => {
    setupPlan('SAH-BRANCH', 'approved');

    const mockAntigravity = new AntigravityAdapter(mockConfig);
    vi.spyOn(mockAntigravity, 'executePrompt').mockResolvedValue({
      success: true,
      exitCode: 0,
      signal: null,
      stdout: '{"status":"SUCCESS"}',
      stderr: '',
      durationMs: 400,
      timedOut: false,
    });

    const mockVerification = new VerificationService();
    vi.spyOn(mockVerification, 'runAllChecks').mockResolvedValue([]);

    const storage = new ExecutionStorageService(mockConfig, sessionsDir);
    const executor = new ImplementationExecutor({
      config: mockConfig,
      antigravityAdapter: mockAntigravity,
      repoRegistry: new RepositoryRegistry(mockConfig),
      planStorage: new PlanStorageService(mockConfig),
      executionStorage: storage,
      verificationService: mockVerification,
    });

    const session = await executor.startExecutionSession({
      issueIdentifier: 'SAH-BRANCH',
      useIsolation: false,
      branchOption: 'custom',
      customBranchName: 'feature/sah-login-flow',
      baseBranch: 'main',
    });

    expect(session.ticketBranch).toBe('feature/sah-login-flow');
    expect(session.baseBranch).toBe('main');
    expect(session.mergeStatus).toBe('not_merged');
  });

  it('merges completed session branch into base branch successfully', async () => {
    setupPlan('SAH-MERGE', 'approved');

    vi.spyOn(gitOps, 'mergeBranch').mockReturnValue({
      success: true,
      commitSha: 'commit_merged_789',
    });

    const storage = new ExecutionStorageService(mockConfig, sessionsDir);
    const executor = new ImplementationExecutor({
      config: mockConfig,
      repoRegistry: new RepositoryRegistry(mockConfig),
      planStorage: new PlanStorageService(mockConfig),
      executionStorage: storage,
    });

    // Create session in completed state
    const completedSession = storage.saveSession({
      id: 'sess_merge_test',
      issueIdentifier: 'SAH-MERGE',
      issueTitle: 'Implement Auth Flow',
      planFilePath: 'plans/SAH-MERGE.md',
      repositoryPath: allowedRepo,
      workingPath: allowedRepo,
      isIsolated: false,
      branch: 'main',
      ticketBranch: 'feat/sah-merge',
      baseBranch: 'main',
      mergeStatus: 'not_merged',
      baselineCommit: 'abc123456',
      baselineDirtyCount: 0,
      baselineFiles: [],
      createdAt: new Date().toISOString(),
      status: 'completed',
      progressMessage: 'Completed',
      logs: [],
      changedFiles: [],
      verificationResults: [],
      implementationCompleted: true,
      verificationPassed: true,
      isDone: true,
    });

    const merged = executor.mergeSession('sess_merge_test');
    expect(merged.mergeStatus).toBe('merged');
    expect(merged.mergeCommitSha).toBe('commit_merged_789');
    expect(merged.mergedAt).toBeDefined();
  });

  it('rejects merge when session is not completed', async () => {
    const storage = new ExecutionStorageService(mockConfig, sessionsDir);
    const executor = new ImplementationExecutor({
      config: mockConfig,
      repoRegistry: new RepositoryRegistry(mockConfig),
      planStorage: new PlanStorageService(mockConfig),
      executionStorage: storage,
    });

    storage.saveSession({
      id: 'sess_running_test',
      issueIdentifier: 'SAH-RUNNING',
      issueTitle: 'Running',
      planFilePath: 'plans/SAH-RUNNING.md',
      repositoryPath: allowedRepo,
      workingPath: allowedRepo,
      isIsolated: false,
      branch: 'main',
      ticketBranch: 'feat/sah-running',
      baseBranch: 'main',
      baselineCommit: 'abc123456',
      baselineDirtyCount: 0,
      baselineFiles: [],
      createdAt: new Date().toISOString(),
      status: 'running',
      progressMessage: 'Running',
      logs: [],
      changedFiles: [],
      verificationResults: [],
      implementationCompleted: false,
      verificationPassed: false,
    });

    expect(() => executor.mergeSession('sess_running_test')).toThrow(
      'Only completed execution sessions can be merged'
    );
  });
});
