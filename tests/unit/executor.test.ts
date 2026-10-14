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
    await new Promise((resolve) => setTimeout(resolve, 100));

    const finalSession = storage.getSession(session.id);
    expect(finalSession).toBeDefined();
    expect(finalSession?.status).toBe('completed');
    expect(finalSession?.implementationCompleted).toBe(true);
    expect(finalSession?.verificationPassed).toBe(true);
    expect(finalSession?.verificationResults.length).toBe(2);
  });
});
