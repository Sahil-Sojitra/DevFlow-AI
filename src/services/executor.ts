import path from 'node:path';
import { getAppConfig, type AppConfig } from '../config/env.js';
import { AntigravityAdapter } from '../adapters/antigravity.js';
import { RepositoryRegistry } from './repo-registry.js';
import { PlanStorageService } from './plan-storage.js';
import { ExecutionStorageService } from './execution-storage.js';
import { VerificationService } from './verification.js';
import {
  inspectGitWorkingTree,
  createGitWorktree,
  detectChangedFiles,
  getUnifiedDiff,
} from './git-ops.js';
import type {
  ExecutionSessionRecord,
  CreateExecutionRequest,
} from '../types/execution.js';

export interface ExecutorDependencies {
  config?: AppConfig;
  antigravityAdapter?: AntigravityAdapter;
  repoRegistry?: RepositoryRegistry;
  planStorage?: PlanStorageService;
  executionStorage?: ExecutionStorageService;
  verificationService?: VerificationService;
}

/**
 * Orchestrator for controlled implementation and verification.
 */
export class ImplementationExecutor {
  private readonly config: AppConfig;
  private readonly antigravity: AntigravityAdapter;
  private readonly repoRegistry: RepositoryRegistry;
  private readonly planStorage: PlanStorageService;
  private readonly executionStorage: ExecutionStorageService;
  private readonly verificationService: VerificationService;

  constructor(deps: ExecutorDependencies = {}) {
    this.config = deps.config ?? getAppConfig();
    this.antigravity = deps.antigravityAdapter ?? new AntigravityAdapter(this.config);
    this.repoRegistry = deps.repoRegistry ?? new RepositoryRegistry(this.config);
    this.planStorage = deps.planStorage ?? new PlanStorageService(this.config);
    this.executionStorage = deps.executionStorage ?? new ExecutionStorageService(this.config);
    this.verificationService = deps.verificationService ?? new VerificationService();
  }

  /**
   * Generates a unique, stable session ID.
   */
  private generateSessionId(issueId: string): string {
    const safeIssue = issueId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `sess_${safeIssue}_${timestamp}_${randomSuffix}`;
  }

  /**
   * Pre-flight authorization and validation check before execution begins.
   */
  public validateExecutionEligibility(params: CreateExecutionRequest): {
    planDetail: NonNullable<ReturnType<PlanStorageService['getPlan']>>;
    targetRepo: string;
    gitStatus: ReturnType<typeof inspectGitWorkingTree>;
  } {
    const { issueIdentifier, repoPath } = params;

    // 1. Verify Plan exists
    const planDetail = this.planStorage.getPlan(issueIdentifier);
    if (!planDetail) {
      throw new Error(`No implementation plan found for issue "${issueIdentifier}". Generate a plan first.`);
    }

    // 2. Strict Check: Review Status must be 'approved'
    if (planDetail.reviewStatus !== 'approved') {
      throw new Error(
        `Plan for issue "${issueIdentifier}" cannot be executed because its review status is "${planDetail.reviewStatus}". Only explicitly approved plans can be executed.`
      );
    }

    // 3. Validate repository allowlist containment
    const candidateRepo = repoPath || planDetail.repository || this.config.allowedWorkingDirs[0] || process.cwd();
    const targetRepo = this.repoRegistry.resolveAndValidateRepo(candidateRepo);

    // 4. Inspect working tree
    const gitStatus = inspectGitWorkingTree(targetRepo);

    return { planDetail, targetRepo, gitStatus };
  }

  /**
   * Starts implementation session asynchronously.
   * Returns immediately with the initialized session record.
   */
  public async startExecutionSession(
    params: CreateExecutionRequest
  ): Promise<ExecutionSessionRecord> {
    const { issueIdentifier, useIsolation = true } = params;

    // 1. Pre-flight verification
    const { planDetail, targetRepo, gitStatus } = this.validateExecutionEligibility(params);

    const sessionId = this.generateSessionId(issueIdentifier);

    // 2. Acquire concurrency lock
    let releaseLock: () => void;
    try {
      releaseLock = this.executionStorage.acquireExecutionLock(targetRepo, issueIdentifier);
    } catch (err: unknown) {
      throw err;
    }

    let workingPath = targetRepo;
    let isIsolated = false;
    let worktreePath: string | undefined;

    // 3. Working tree isolation decision
    if (!gitStatus.isClean) {
      // Repository has uncommitted changes - MUST use isolation or block
      if (useIsolation) {
        try {
          const worktreeDir = path.join(targetRepo, '.devflow', 'worktrees', sessionId);
          workingPath = createGitWorktree(targetRepo, worktreeDir, 'HEAD');
          isIsolated = true;
          worktreePath = workingPath;
        } catch (worktreeErr: unknown) {
          releaseLock();
          // Create blocked session record for inspection
          const blockedSession: ExecutionSessionRecord = {
            id: sessionId,
            issueIdentifier,
            issueTitle: planDetail.title,
            planFilePath: planDetail.filePath,
            repositoryPath: targetRepo,
            workingPath: targetRepo,
            isIsolated: false,
            branch: gitStatus.branch,
            baselineCommit: gitStatus.headCommit,
            baselineDirtyCount: gitStatus.allUncommitted.length,
            baselineFiles: gitStatus.allUncommitted,
            createdAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            status: 'blocked',
            progressMessage: `Execution blocked: Repository has ${gitStatus.allUncommitted.length} uncommitted changes and git worktree isolation failed: ${(worktreeErr as Error).message}`,
            logs: [
              {
                timestamp: new Date().toISOString(),
                level: 'error',
                message: `Failed to create isolated git worktree: ${(worktreeErr as Error).message}`,
              },
            ],
            changedFiles: [],
            verificationResults: [],
            implementationCompleted: false,
            verificationPassed: false,
            error: `Repository has uncommitted changes. Please commit or stash your changes, or resolve worktree setup: ${(worktreeErr as Error).message}`,
          };
          this.executionStorage.saveSession(blockedSession);
          throw new Error(blockedSession.error);
        }
      } else {
        releaseLock();
        throw new Error(
          `Repository "${targetRepo}" has ${gitStatus.allUncommitted.length} uncommitted changes. Execution without isolation is blocked to protect your changes.`
        );
      }
    } else if (useIsolation) {
      // Working tree is clean, but isolation was requested
      try {
        const worktreeDir = path.join(targetRepo, '.devflow', 'worktrees', sessionId);
        workingPath = createGitWorktree(targetRepo, worktreeDir, 'HEAD');
        isIsolated = true;
        worktreePath = workingPath;
      } catch {
        // Fallback to direct repo if clean
        workingPath = targetRepo;
        isIsolated = false;
      }
    }

    // 4. Capture baseline state
    const workingTreeInspect = inspectGitWorkingTree(workingPath);
    const baselineCommit = workingTreeInspect.headCommit;
    const baselineFiles = workingTreeInspect.allUncommitted;

    // 5. Initialize session record in 'queued' status
    const initialSession: ExecutionSessionRecord = {
      id: sessionId,
      issueIdentifier,
      issueTitle: planDetail.title,
      planFilePath: planDetail.filePath,
      repositoryPath: targetRepo,
      workingPath,
      isIsolated,
      worktreePath,
      branch: gitStatus.branch,
      baselineCommit,
      baselineDirtyCount: baselineFiles.length,
      baselineFiles,
      createdAt: new Date().toISOString(),
      status: 'queued',
      progressMessage: isIsolated
        ? `Queued in isolated worktree (${path.relative(targetRepo, workingPath).replace(/\\/g, '/')})`
        : 'Queued in main repository working tree',
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Session initialized for ${issueIdentifier} on branch ${gitStatus.branch}. Isolation: ${isIsolated ? 'active' : 'inactive'}.`,
        },
      ],
      changedFiles: [],
      verificationResults: [],
      implementationCompleted: false,
      verificationPassed: false,
    };

    this.executionStorage.saveSession(initialSession);

    // 6. Launch background execution pipeline
    this.runPipeline(sessionId, planDetail.content, releaseLock).catch((pipelineErr) => {
      // Pipeline error logging handled internally
    });

    return initialSession;
  }

  /**
   * Internal asynchronous execution pipeline runner.
   */
  private async runPipeline(
    sessionId: string,
    planContent: string,
    releaseLock: () => void
  ): Promise<void> {
    try {
      let session = this.executionStorage.getSession(sessionId);
      if (!session) return;

      // Transition to 'running'
      session = this.executionStorage.transitionSession(sessionId, 'running', {
        startedAt: new Date().toISOString(),
        progressMessage: 'Antigravity agent is implementing the approved plan...',
      });
      this.executionStorage.appendLog(
        sessionId,
        'info',
        'Starting Antigravity CLI process with approved plan...'
      );

      // Register cancellation callback
      let processCancelled = false;
      this.executionStorage.registerActiveProcess(sessionId, () => {
        processCancelled = true;
        this.executionStorage.appendLog(
          sessionId,
          'warn',
          'Cancellation requested by user. Aborting execution...'
        );
      });

      // Construct prompt
      const implementationPrompt = `
You are an expert software developer implementing an APPROVED implementation plan for Linear issue ${session.issueIdentifier} ("${session.issueTitle}").

## APPROVED IMPLEMENTATION PLAN
${planContent}

## EXECUTION INSTRUCTIONS & SAFETY BOUNDARIES
1. Implement the tasks specified in the approved plan.
2. Adhere strictly to the existing code patterns, file structure, and design conventions in this repository.
3. Limit modifications to files relevant to this feature. Do NOT perform unnecessary refactorings or modify unrelated files.
4. Do NOT attempt to commit, push, or merge git branches. DevFlow AI strictly manages git operations.
5. Do NOT invent missing backend endpoints or schemas. If an unapproved blocker is found, stop and report the blocker.
6. Verify your changes before completing.
`.trim();

      // Invoke Antigravity CLI with accept-edits mode
      const execResult = await this.antigravity.executePrompt({
        workingDir: session.workingPath,
        prompt: implementationPrompt,
        outputFormat: 'json',
        mode: 'accept-edits',
        effort: 'high',
        timeoutMs: this.config.defaultTimeoutMs,
      });

      this.executionStorage.unregisterActiveProcess(sessionId);

      // Check if cancelled
      if (processCancelled) {
        this.finishSession(sessionId, 'cancelled', {
          implementationCompleted: false,
          verificationPassed: false,
          progressMessage: 'Session was cancelled by user.',
          summary: 'Implementation process was terminated upon developer cancellation. Already-written files may need manual review.',
          error: 'Execution cancelled by user.',
        });
        return;
      }

      if (!execResult.success) {
        const errorMsg = execResult.error || execResult.stderr || 'Antigravity execution failed';
        this.executionStorage.appendLog(sessionId, 'error', `Agent execution failure: ${errorMsg}`);

        this.finishSession(sessionId, 'failed', {
          implementationCompleted: false,
          verificationPassed: false,
          exitCode: execResult.exitCode,
          progressMessage: 'Antigravity agent execution failed.',
          summary: `Antigravity CLI process failed: ${errorMsg}`,
          error: errorMsg,
        });
        return;
      }

      // Check changed files relative to baseline
      let detectedChanges = detectChangedFiles(session.workingPath, session.baselineFiles);
      if (detectedChanges.length === 0) {
        this.executionStorage.appendLog(sessionId, 'warn', 'Agent completed run, but 0 files were modified or created on disk.');
      } else {
        this.executionStorage.appendLog(
          sessionId,
          'info',
          `Agent implementation completed in ${Math.round(execResult.durationMs / 1000)}s with ${detectedChanges.length} file(s) changed.`
        );
      }

      // Transition to 'verifying'
      session = this.executionStorage.transitionSession(sessionId, 'verifying', {
        implementationCompleted: true,
        changedFiles: detectedChanges,
        progressMessage: 'Running configured verification pipeline (tests, typecheck, lint, build)...',
      });

      // Run Verification Checks
      this.executionStorage.appendLog(sessionId, 'info', 'Discovering and executing project verification checks...');
      const verificationResults = await this.verificationService.runAllChecks(
        session.workingPath,
        60000,
        (checkName, msg) => {
          this.executionStorage.appendLog(sessionId, 'info', msg);
        }
      );

      // Determine verification outcome
      const configuredChecks = verificationResults.filter((r) => r.status !== 'not_configured');
      const failedChecks = configuredChecks.filter((r) => r.status === 'failed');
      const allPassed = configuredChecks.length === 0 || failedChecks.length === 0;

      for (const res of verificationResults) {
        if (res.status === 'passed') {
          this.executionStorage.appendLog(sessionId, 'info', `✓ [${res.name}] PASSED (${res.durationMs}ms)`);
        } else if (res.status === 'failed') {
          this.executionStorage.appendLog(sessionId, 'error', `✗ [${res.name}] FAILED: ${res.error || 'Check failed'}`);
        } else {
          this.executionStorage.appendLog(sessionId, 'info', `- [${res.name}] NOT CONFIGURED: ${res.output}`);
        }
      }

      // Re-detect changes after verification in case verification created/modified files
      detectedChanges = detectChangedFiles(session.workingPath, session.baselineFiles);

      if (detectedChanges.length === 0) {
        this.finishSession(sessionId, 'failed', {
          implementationCompleted: false,
          verificationPassed: false,
          verificationResults,
          changedFiles: [],
          progressMessage: 'No file changes produced by agent.',
          summary: 'Agent process completed, but 0 files were created or modified on disk. Verify that the approved plan contains actionable code steps.',
          error: 'Agent completed without producing any file modifications.',
        });
      } else if (allPassed) {
        this.finishSession(sessionId, 'completed', {
          implementationCompleted: true,
          verificationPassed: true,
          verificationResults,
          changedFiles: detectedChanges,
          progressMessage: 'Implementation and verification completed successfully.',
          summary: configuredChecks.length > 0
            ? `Implementation finished (${detectedChanges.length} file(s) modified) and ${configuredChecks.length} configured verification checks passed.`
            : `Implementation finished (${detectedChanges.length} file(s) modified). Note: 0 verification checks were configured in package.json.`,
        });
      } else {
        this.finishSession(sessionId, 'failed', {
          implementationCompleted: true,
          verificationPassed: false,
          verificationResults,
          changedFiles: detectedChanges,
          progressMessage: `Verification failed: ${failedChecks.map((c) => c.name).join(', ')} failed.`,
          summary: `Implementation finished (${detectedChanges.length} file(s) modified), but ${failedChecks.length} verification check(s) failed (${failedChecks.map((c) => c.name).join(', ')}).`,
          error: `Verification checks failed: ${failedChecks.map((c) => c.name).join(', ')}.`,
        });
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Unexpected error during pipeline run';
      this.finishSession(sessionId, 'failed', {
        implementationCompleted: false,
        verificationPassed: false,
        progressMessage: `Pipeline error: ${msg}`,
        error: msg,
        summary: `Execution aborted due to unexpected error: ${msg}`,
      });
    } finally {
      releaseLock();
    }
  }

  /**
   * Helper to detect final changed files and transition session to terminal status.
   */
  private finishSession(
    sessionId: string,
    status: 'completed' | 'failed' | 'cancelled',
    updates: Partial<ExecutionSessionRecord>
  ): void {
    const session = this.executionStorage.getSession(sessionId);
    if (!session) return;

    // Detect changed files relative to baseline
    let changedFiles = session.changedFiles;
    try {
      changedFiles = detectChangedFiles(session.workingPath, session.baselineFiles);
    } catch {
      // Ignore
    }

    try {
      this.executionStorage.transitionSession(sessionId, status, {
        ...updates,
        changedFiles,
        endedAt: new Date().toISOString(),
      });
    } catch {
      // Ignore transition error if already terminal
    }
  }
}
