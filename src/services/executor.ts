import path from 'node:path';
import { getAppConfig, type AppConfig } from '../config/env.js';
import { AntigravityAdapter } from '../adapters/antigravity.js';
import { LinearAdapter } from '../adapters/linear.js';
import { RepositoryRegistry } from './repo-registry.js';
import { PlanStorageService } from './plan-storage.js';
import { ExecutionStorageService } from './execution-storage.js';
import { VerificationService } from './verification.js';
import { extractDiagnostics, formatSelfHealingPrompt } from './diagnostics.js';
import {
  inspectGitWorkingTree,
  createGitWorktree,
  createGitWorktreeWithBranch,
  createAndCheckoutBranch,
  detectBaseBranch,
  generateTicketBranchName,
  sanitizeBranchName,
  pullBaseBranch,
  commitWorktreeChanges,
  mergeBranch,
  pushBranch,
  parseRemoteUrl,
  generatePrWebUrl,
  detectChangedFiles,
  getUnifiedDiff,
} from './git-ops.js';
import type {
  ExecutionSessionRecord,
  CreateExecutionRequest,
  CreatePullRequestInput,
  MergeSessionInput,
  SessionRevision,
  VerificationResult,
  DiagnosticIssue,
} from '../types/execution.js';

export interface ExecutorDependencies {
  config?: AppConfig;
  antigravityAdapter?: AntigravityAdapter;
  linearAdapter?: LinearAdapter;
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
  private readonly linear: LinearAdapter;
  private readonly repoRegistry: RepositoryRegistry;
  private readonly planStorage: PlanStorageService;
  private readonly executionStorage: ExecutionStorageService;
  private readonly verificationService: VerificationService;

  constructor(deps: ExecutorDependencies = {}) {
    this.config = deps.config ?? getAppConfig();
    this.antigravity = deps.antigravityAdapter ?? new AntigravityAdapter(this.config);
    this.linear = deps.linearAdapter ?? new LinearAdapter(this.config);
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
    const { issueIdentifier, useIsolation = false, branchOption, customBranchName } = params;

    // 1. Pre-flight verification
    const { planDetail, targetRepo, gitStatus } = this.validateExecutionEligibility(params);

    // Determine Base Branch and pull latest changes
    const baseBranch = params.baseBranch || detectBaseBranch(targetRepo);
    let pullInfo = { success: true, message: `Using base branch "${baseBranch}".` };
    try {
      pullInfo = pullBaseBranch(targetRepo, baseBranch);
    } catch {
      // Graceful fallback if git pull fails or offline
    }

    // Determine Ticket Feature Branch
    let ticketBranch: string;
    if (branchOption === 'custom' && customBranchName && customBranchName.trim().length > 0) {
      ticketBranch = sanitizeBranchName(customBranchName);
    } else if (branchOption === 'current') {
      ticketBranch = gitStatus.branch;
    } else {
      ticketBranch = generateTicketBranchName(issueIdentifier);
    }

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

    // 3. Direct branch creation or optional worktree isolation
    if (!gitStatus.isClean) {
      if (useIsolation) {
        try {
          const worktreeDir = path.join(targetRepo, '.devflow', 'worktrees', sessionId);
          workingPath = createGitWorktreeWithBranch(targetRepo, worktreeDir, ticketBranch, baseBranch);
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
        workingPath = createGitWorktreeWithBranch(targetRepo, worktreeDir, ticketBranch, baseBranch);
        isIsolated = true;
        worktreePath = workingPath;
      } catch {
        // Fallback to direct repo if clean
        workingPath = targetRepo;
        isIsolated = false;
      }
    } else {
      // Direct branch mode: create & checkout ticket branch directly in repository (no worktree)
      const branchRes = createAndCheckoutBranch(targetRepo, ticketBranch, baseBranch);
      if (!branchRes.success) {
        releaseLock();
        throw new Error(branchRes.error || `Failed to create or checkout branch "${ticketBranch}".`);
      }
      workingPath = targetRepo;
      isIsolated = false;
      worktreePath = undefined;
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
      branch: workingTreeInspect.branch || ticketBranch,
      ticketBranch,
      baseBranch,
      mergeStatus: 'not_merged',
      baselineCommit,
      baselineDirtyCount: baselineFiles.length,
      baselineFiles,
      createdAt: new Date().toISOString(),
      status: 'queued',
      progressMessage: isIsolated
        ? `Queued in isolated worktree on branch "${ticketBranch}" (base: ${baseBranch})`
        : `Queued directly on branch "${ticketBranch}" (base: ${baseBranch})`,
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Session initialized for ${issueIdentifier}. Base branch: "${baseBranch}" (${pullInfo.message}). Ticket branch: "${ticketBranch}". Mode: ${isIsolated ? 'isolated worktree' : 'direct branch (no worktree)'}.`,
        },
      ],
      changedFiles: [],
      verificationResults: [],
      implementationCompleted: false,
      verificationPassed: false,
    };

    this.executionStorage.saveSession(initialSession);

    // Two-way Linear status sync: transition issue to 'started' (In Progress) and post comment
    this.linear
      .syncExecutionStatus(issueIdentifier, 'started', {
        comment: `🚀 **DevFlow AI** started autonomous implementation.\n- Base Branch: \`${baseBranch}\`\n- Ticket Branch: \`${ticketBranch}\`\n- Strategy: Direct repository branch mode`,
      })
      .catch(() => {});

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

## CRITICAL EXECUTION INSTRUCTIONS & SAFETY BOUNDARIES
1. DIRECT FILE CREATION & EDITING ONLY:
   - Create, modify, and delete the necessary code files directly in the repository using file write/edit tools.
   - CRITICAL: Do NOT attempt to execute terminal or shell commands (e.g., RunCommand, npm, npx, pnpm, yarn, bit, git, dir, ls, etc.). Shell/terminal command execution is strictly disabled in headless automation mode and will cause immediate failure.
   - If the implementation plan mentions CLI commands (e.g. "npm init", "npx create-...", "bit init", or scaffolding scripts), do NOT execute them in the shell. Instead, directly create, scaffold, and configure the corresponding files and dependencies directly on disk using file writing tools.
2. AUTOMATED VERIFICATION IS HANDLED BY DEVFLOW:
   - DevFlow AI automatically executes the full verification pipeline (TypeScript compilation, unit tests, linter, build) after your changes are written.
   - Do NOT try to run build, test, or lint commands yourself.
3. PRESERVATION & REPOSITORY CONVENTIONS:
   - Adhere strictly to the existing code patterns, file structure, and design conventions in this repository.
   - Limit modifications to files relevant to this feature. Do NOT perform unnecessary refactorings or modify unrelated files.
   - Provide complete, robust implementations without placeholders or TODO stubs.
4. NO GIT OPERATIONS:
   - Do NOT attempt to run git commands (git commit, git push, git branch, etc.). DevFlow AI strictly manages git operations.
5. REPORT BLOCKERS:
   - Do NOT invent missing backend endpoints or schemas. If an unapproved blocker is found, stop and explain the blocker in your final response.
6. MANDATORY AUTOMATED TEST CASES & SELF-VERIFICATION:
   - For every feature, component, or logic you write, you MUST create or update automated unit/integration test files (e.g. in tests/, __tests__/, or alongside components as *.test.ts/*.test.tsx).
   - The test cases must thoroughly verify the ticket acceptance criteria and edge cases.
   - Strictly avoid dummy tests (e.g. process.exit(0), empty test stubs, or trivial true assertions). The tests must import and execute the code you wrote so automated verification can prove implementation correctness.
`.trim();

      // Implementation execution has NO time limit (0) so Antigravity can take as much time as needed to complete the plan.
      const executionTimeoutMs = 0;

      this.executionStorage.appendLog(
        sessionId,
        'info',
        'Starting Antigravity CLI process with approved plan (Uncapped execution — agent runs until completion)...'
      );

      // Heartbeat timer to provide live UI updates and elapsed time counter while Antigravity runs
      const startTime = Date.now();
      const heartbeatInterval = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
        const currentSession = this.executionStorage.getSession(sessionId);
        if (!currentSession || currentSession.status !== 'running') {
          clearInterval(heartbeatInterval);
          return;
        }

        const timeoutNote = executionTimeoutMs > 0 ? ` / limit ${Math.round(executionTimeoutMs / 1000)}s` : '';
        this.executionStorage.updateSession(sessionId, {
          progressMessage: `Antigravity agent is generating code and scaffolding components... (${elapsedSec}s elapsed${timeoutNote})`,
        });

        if (elapsedSec > 0 && elapsedSec % 10 === 0) {
          this.executionStorage.appendLog(
            sessionId,
            'info',
            `Implementation in progress: agent actively reasoning & writing files (${elapsedSec}s elapsed)...`
          );
        }
      }, 3000);

      let execResult;
      try {
        // Invoke Antigravity CLI with stream-json mode for real-time progress
        execResult = await this.antigravity.executePrompt({
          workingDir: session.workingPath,
          prompt: implementationPrompt,
          outputFormat: 'stream-json',
          mode: 'accept-edits',
          effort: 'medium',
          timeoutMs: executionTimeoutMs,
          dangerouslySkipPermissions: true,
          onProgress: (chunk, stream) => {
            const trimmed = chunk.trim();
            if (trimmed.length > 0) {
              this.executionStorage.appendLog(
                sessionId,
                stream === 'stderr' ? 'warn' : 'info',
                trimmed
              );
            }
          },
        });
      } finally {
        clearInterval(heartbeatInterval);
      }

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

      // Capture model usage and duration
      const usage = execResult.parsedOutput?.usage;
      const durationSeconds = Math.round(execResult.durationMs / 1000);
      const model = process.env.DEVFLOW_MODEL || 'gemini-3.8-flash-high';

      // Transition to 'verifying'
      session = this.executionStorage.transitionSession(sessionId, 'verifying', {
        implementationCompleted: true,
        changedFiles: detectedChanges,
        progressMessage: 'Running configured verification pipeline (tests, typecheck, lint, build)...',
        model,
        usage,
        durationSeconds,
      });

      // Automated Verification & Autonomous Self-Healing Loop (Up to 3 Attempts)
      const MAX_AUTO_FIX_ATTEMPTS = 3;
      let autoFixAttempt = 0;
      let allPassed = false;
      let verificationResults: VerificationResult[] = [];
      let configuredChecks: VerificationResult[] = [];
      let failedChecks: VerificationResult[] = [];
      let previousIssuesCount: number | undefined;
      let latestDiagnostics: DiagnosticIssue[] = [];

      while (autoFixAttempt <= MAX_AUTO_FIX_ATTEMPTS) {
        this.executionStorage.appendLog(
          sessionId,
          'info',
          autoFixAttempt === 0
            ? 'Discovering and executing project verification checks...'
            : `Re-running verification checks after autonomous self-healing fix pass #${autoFixAttempt}...`
        );

        verificationResults = await this.verificationService.runAllChecks(
          session.workingPath,
          60000,
          (checkName, msg) => {
            this.executionStorage.appendLog(sessionId, 'info', msg);
          }
        );

        configuredChecks = verificationResults.filter((r) => r.status !== 'not_configured');
        failedChecks = configuredChecks.filter((r) => r.status === 'failed');
        allPassed = configuredChecks.length === 0 || failedChecks.length === 0;

        for (const res of verificationResults) {
          if (res.status === 'passed') {
            this.executionStorage.appendLog(sessionId, 'info', `✓ [${res.name}] PASSED (${res.durationMs}ms)`);
          } else if (res.status === 'failed') {
            this.executionStorage.appendLog(sessionId, 'error', `✗ [${res.name}] FAILED: ${res.error || 'Check failed'}`);
            if (res.output) {
              const snippetLines = res.output
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0 && !l.startsWith('>') && !l.includes('npm run') && !l.includes('ELIFECYCLE'))
                .slice(0, 5);
              for (const line of snippetLines) {
                this.executionStorage.appendLog(sessionId, 'error', `[${res.name} output] ${line}`);
              }
            }
          } else {
            this.executionStorage.appendLog(sessionId, 'info', `- [${res.name}] NOT CONFIGURED: ${res.output}`);
          }
        }

        // Extract pinpoint diagnostics from verification results
        const diagnosticReport = extractDiagnostics(verificationResults);
        latestDiagnostics = diagnosticReport.issues;

        session = this.executionStorage.updateSession(sessionId, {
          diagnostics: latestDiagnostics,
        })!;

        // If all verification checks passed, break out of loop!
        if (allPassed) {
          break;
        }

        autoFixAttempt++;

        // If attempts remain, dispatch autonomous self-healing prompt to Antigravity
        if (autoFixAttempt <= MAX_AUTO_FIX_ATTEMPTS) {
          this.executionStorage.appendLog(
            sessionId,
            'warn',
            `Verification check(s) failed (${failedChecks.map((c) => c.name).join(', ')}). ${diagnosticReport.summary} Initiating autonomous self-healing fix pass (${autoFixAttempt} of ${MAX_AUTO_FIX_ATTEMPTS})...`
          );

          session = this.executionStorage.updateSession(sessionId, {
            autoFixAttempts: Math.min(autoFixAttempt, MAX_AUTO_FIX_ATTEMPTS),
            maxAutoFixAttempts: MAX_AUTO_FIX_ATTEMPTS,
            progressMessage: `Autonomous self-healing in progress (Attempt ${autoFixAttempt} of ${MAX_AUTO_FIX_ATTEMPTS}): Fixing ${diagnosticReport.totalErrors} issue(s) across ${diagnosticReport.affectedFiles.length} file(s)...`,
          })!;

          const autoFixPrompt = formatSelfHealingPrompt({
            report: diagnosticReport,
            issueIdentifier: session.issueIdentifier,
            issueTitle: session.issueTitle,
            attempt: autoFixAttempt,
            maxAttempts: MAX_AUTO_FIX_ATTEMPTS,
            previousIssuesCount,
          });

          previousIssuesCount = diagnosticReport.totalErrors;

          const fixResult = await this.antigravity.executePrompt({
            workingDir: session.workingPath,
            prompt: autoFixPrompt,
            outputFormat: 'stream-json',
            mode: 'accept-edits',
            effort: 'medium',
            timeoutMs: executionTimeoutMs,
            dangerouslySkipPermissions: true,
            onProgress: (chunk, stream) => {
              const trimmed = chunk.trim();
              if (trimmed.length > 0) {
                this.executionStorage.appendLog(
                  sessionId,
                  stream === 'stderr' ? 'warn' : 'info',
                  trimmed
                );
              }
            },
          });

          if (!fixResult.success) {
            this.executionStorage.appendLog(
              sessionId,
              'error',
              `Self-healing fix pass #${autoFixAttempt} failed to complete: ${fixResult.error || fixResult.stderr}`
            );
          } else if (fixResult.parsedOutput?.response) {
            const firstLine = fixResult.parsedOutput.response.trim().split('\n')[0];
            if (firstLine) {
              this.executionStorage.appendLog(sessionId, 'info', `[agy fix] ${firstLine}`);
            }
          }

          if (fixResult.parsedOutput?.usage) {
            const u = fixResult.parsedOutput.usage;
            const currentUsage = session.usage || {};
            session.usage = {
              input_tokens: (currentUsage.input_tokens || 0) + (u.input_tokens || 0),
              output_tokens: (currentUsage.output_tokens || 0) + (u.output_tokens || 0),
              thinking_tokens: (currentUsage.thinking_tokens || 0) + (u.thinking_tokens || 0),
              cache_read_tokens: (currentUsage.cache_read_tokens || 0) + (u.cache_read_tokens || 0),
              cache_write_tokens: (currentUsage.cache_write_tokens || 0) + (u.cache_write_tokens || 0),
              total_tokens: (currentUsage.total_tokens || 0) + (u.total_tokens || 0),
            };
            session.durationSeconds = (session.durationSeconds || 0) + Math.round(fixResult.durationMs / 1000);
            this.executionStorage.updateSession(sessionId, {
              usage: session.usage,
              durationSeconds: session.durationSeconds,
            });
          }
        }
      }

      // Re-detect changes after all attempts
      detectedChanges = detectChangedFiles(session.workingPath, session.baselineFiles);

      if (detectedChanges.length === 0) {
        this.finishSession(sessionId, 'failed', {
          implementationCompleted: false,
          verificationPassed: false,
          verificationResults,
          diagnostics: latestDiagnostics,
          changedFiles: [],
          autoFixAttempts: Math.min(autoFixAttempt, MAX_AUTO_FIX_ATTEMPTS),
          maxAutoFixAttempts: MAX_AUTO_FIX_ATTEMPTS,
          progressMessage: 'No file changes produced by agent.',
          summary: 'Agent process completed, but 0 files were created or modified on disk. Verify that the approved plan contains actionable code steps.',
          error: 'Agent completed without producing any file modifications.',
        });
      } else if (allPassed) {
        // Auto-commit verified implementation changes in ticket worktree branch
        try {
          const commitSha = commitWorktreeChanges(
            session.workingPath,
            `feat(${session.issueIdentifier}): implement approved plan for ${session.issueTitle}`
          );
          if (commitSha) {
            this.executionStorage.appendLog(
              sessionId,
              'info',
              `✓ Committed verified changes to branch "${session.ticketBranch || session.branch}" (Commit: ${commitSha.slice(0, 7)}).`
            );
          }
        } catch {
          // Commit failure does not block session completion
        }

        this.finishSession(sessionId, 'completed', {
          implementationCompleted: true,
          verificationPassed: true,
          verificationResults,
          diagnostics: latestDiagnostics,
          changedFiles: detectedChanges,
          autoFixAttempts: Math.min(autoFixAttempt, MAX_AUTO_FIX_ATTEMPTS),
          maxAutoFixAttempts: MAX_AUTO_FIX_ATTEMPTS,
          stuckInHallucination: false,
          progressMessage: autoFixAttempt > 0
            ? `Implementation and verification completed successfully (passed after ${autoFixAttempt} autonomous fix pass(es)).`
            : 'Implementation and verification completed successfully.',
          summary: configuredChecks.length > 0
            ? `Implementation finished (${detectedChanges.length} file(s) modified) and ${configuredChecks.length} configured verification checks passed${autoFixAttempt > 0 ? ` after ${autoFixAttempt} autonomous fix pass(es)` : ''}.`
            : `Implementation finished (${detectedChanges.length} file(s) modified). Note: 0 verification checks were configured in package.json.`,
        });

        // Two-way Linear status sync: transition issue to 'in_review'
        const checksSummary = verificationResults.map((v) => `- [x] \`${v.name}\` (${v.status})`).join('\n');
        this.linear
          .syncExecutionStatus(session.issueIdentifier, 'in_review', {
            comment: `✓ **DevFlow AI** completed implementation on branch \`${session.ticketBranch || session.branch}\`.\n\n### Automated Verification Results\n${checksSummary || '- All checks passed'}\n\n*Awaiting approval in DevFlow Dashboard.*`,
          })
          .catch(() => {});
      } else {
        // Failed after 3 attempts -> STUCK IN HALLUCINATION / UNABLE TO SOLVE
        this.executionStorage.appendLog(
          sessionId,
          'error',
          `Autonomous agent is unable to resolve verification errors after ${MAX_AUTO_FIX_ATTEMPTS} attempts. Agent appears stuck in hallucination or conflicting loop. Halting for developer revision & guidance.`
        );

        this.finishSession(sessionId, 'failed', {
          implementationCompleted: true,
          verificationPassed: false,
          verificationResults,
          diagnostics: latestDiagnostics,
          changedFiles: detectedChanges,
          autoFixAttempts: Math.min(autoFixAttempt, MAX_AUTO_FIX_ATTEMPTS),
          maxAutoFixAttempts: MAX_AUTO_FIX_ATTEMPTS,
          stuckInHallucination: true,
          progressMessage: `Agent unable to resolve verification errors after ${MAX_AUTO_FIX_ATTEMPTS} autonomous attempts (Stuck / Hallucination detected). Developer guidance required.`,
          summary: `The autonomous agent completed ${MAX_AUTO_FIX_ATTEMPTS} consecutive self-healing passes, but verification checks are still failing (${failedChecks.map((c) => c.name).join(', ')}). The agent appears stuck in a conflicting loop or hallucination. Developer guidance is required to break out of the loop.`,
          error: `Verification checks failed after ${MAX_AUTO_FIX_ATTEMPTS} autonomous fix attempts: ${failedChecks.map((c) => c.name).join(', ')}.`,
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

  /**
   * Generates a targeted revision/fix plan based on developer feedback and existing worktree changes.
   */
  public async generateRevisionPlan(
    sessionId: string,
    feedback: string
  ): Promise<SessionRevision> {
    const session = this.executionStorage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found.`);
    }

    if (!['completed', 'failed'].includes(session.status)) {
      throw new Error(
        `Revisions can only be requested on completed or failed sessions. Current status: ${session.status}`
      );
    }

    // Retrieve original plan
    const originalPlan = this.planStorage.getPlan(session.issueIdentifier);
    const originalContent = originalPlan?.content || 'No original plan content found.';

    // Inspect current changes in workingPath
    let currentChangesSummary = 'No changes recorded.';
    try {
      const changes = detectChangedFiles(session.workingPath, session.baselineFiles);
      if (changes.length > 0) {
        currentChangesSummary = changes.map((c) => `- ${c.status}: ${c.path}`).join('\n');
      }
    } catch {
      // Ignore
    }

    const revisionPrompt = `
You are an expert software developer creating a targeted REVISION & FIX PLAN for Linear issue ${session.issueIdentifier} ("${session.issueTitle}").

## ORIGINAL IMPLEMENTATION PLAN
${originalContent}

## CURRENT FILES MODIFIED IN WORKSPACE
${currentChangesSummary}

## DEVELOPER FEEDBACK & REQUESTED CHANGES
${feedback}

## INSTRUCTIONS
1. Analyze the developer's requested changes in the context of what has already been built.
2. Outline specific, actionable code edits/additions required to address the developer's feedback.
3. Keep the plan focused directly on the feedback. Do not refactor unrelated working components.
4. Directly create, modify, or delete files. (Do NOT include terminal/shell execution commands).
5. Output the revision plan in clear, structured Markdown.
`.trim();

    this.executionStorage.appendLog(
      sessionId,
      'info',
      `Generating revision fix plan for developer feedback: "${feedback.slice(0, 80)}..."`
    );

    const execResult = await this.antigravity.executePrompt({
      workingDir: session.workingPath,
      prompt: revisionPrompt,
      outputFormat: 'json',
      mode: 'plan',
      effort: 'medium',
      timeoutMs: 0,
      dangerouslySkipPermissions: true,
    });

    if (!execResult.success && !execResult.parsedOutput?.response) {
      const err = execResult.error || 'Failed to generate revision plan from Antigravity CLI.';
      this.executionStorage.appendLog(sessionId, 'error', `Revision plan generation failed: ${err}`);
      throw new Error(err);
    }

    const planContent =
      execResult.parsedOutput?.response?.trim() ||
      execResult.stdout.trim() ||
      'No plan content generated.';

    const revision: SessionRevision = {
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      feedback,
      planContent,
      createdAt: new Date().toISOString(),
    };

    this.executionStorage.updateSession(sessionId, {
      pendingRevision: revision,
    });

    this.executionStorage.appendLog(
      sessionId,
      'info',
      `Revision fix plan ready for developer review (ID: ${revision.id}).`
    );

    return revision;
  }

  /**
   * Applies an approved revision fix plan to the existing session workspace.
   */
  public async applyRevision(
    sessionId: string,
    planContent: string,
    feedback?: string
  ): Promise<ExecutionSessionRecord> {
    const session = this.executionStorage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found.`);
    }

    if (!['completed', 'failed'].includes(session.status)) {
      throw new Error(
        `Revisions can only be applied to completed or failed sessions. Current status: ${session.status}`
      );
    }

    // Acquire lock
    let releaseLock: () => void;
    try {
      releaseLock = this.executionStorage.acquireExecutionLock(session.repositoryPath, session.issueIdentifier);
    } catch (err: unknown) {
      throw err;
    }

    const isDirect = !session.pendingRevision;
    const revision: SessionRevision = session.pendingRevision || {
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      feedback: feedback || 'Direct prompt execution (token-optimized).',
      planContent,
      createdAt: new Date().toISOString(),
    };

    revision.planContent = planContent;
    if (feedback) {
      revision.feedback = feedback;
    }
    revision.approvedAt = new Date().toISOString();

    const existingRevisions = session.revisions || [];
    existingRevisions.push(revision);

    // Reset isDone and record revision
    this.executionStorage.updateSession(sessionId, {
      isDone: false,
      doneAt: undefined,
      doneNote: undefined,
      pendingRevision: null,
      revisions: existingRevisions,
      revisionCount: existingRevisions.length,
    });

    this.executionStorage.appendLog(
      sessionId,
      'info',
      isDirect
        ? `Developer dispatched direct prompt to Antigravity CLI (Token-optimized direct execution, Revision #${existingRevisions.length})...`
        : `Developer approved revision fix plan. Applying modifications to worktree (Revision #${existingRevisions.length})...`
    );

    // Launch pipeline with revision plan
    this.runPipeline(sessionId, planContent, releaseLock).catch(() => {});

    return this.executionStorage.getSession(sessionId)!;
  }

  /**
   * Marks a completed session as officially approved and Done by the developer.
   */
  public markSessionDone(
    sessionId: string,
    note?: string
  ): ExecutionSessionRecord {
    const session = this.executionStorage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found.`);
    }

    if (session.status !== 'completed') {
      throw new Error(
        `Only completed sessions can be marked as Done. Current status: "${session.status}".`
      );
    }

    const updated = this.executionStorage.updateSession(sessionId, {
      isDone: true,
      doneAt: new Date().toISOString(),
      doneNote: note?.trim() || undefined,
      progressMessage: 'Implementation accepted and marked as Done by developer.',
    });

    this.executionStorage.appendLog(
      sessionId,
      'info',
      `Developer accepted implementation changes and marked session as Done.${note ? ` Note: ${note}` : ''}`
    );

    return updated!;
  }
  /**
   * Merges an approved, completed execution session's branch into the base branch (e.g. main/master).
   */
  public mergeSession(
    sessionId: string,
    options: MergeSessionInput = {}
  ): ExecutionSessionRecord {
    const session = this.executionStorage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found.`);
    }

    if (session.status !== 'completed') {
      throw new Error(
        `Only completed execution sessions can be merged. Current status: "${session.status}".`
      );
    }

    const sourceBranch = session.ticketBranch || session.branch;
    const targetBranch = options.targetBranch || session.baseBranch || detectBaseBranch(session.repositoryPath);
    const remote = options.remote || 'origin';
    const pushFeatureBranchFirst = options.pushFeatureBranchFirst !== false;
    const pushBaseBranch = options.pushBaseBranch !== false;

    if (sourceBranch === targetBranch) {
      throw new Error(`Source branch and target branch are identical ("${targetBranch}"). Nothing to merge.`);
    }

    // Step 1: Ensure all changes in worktree / repo are committed to the ticket branch
    this.executionStorage.appendLog(
      sessionId,
      'info',
      `[git] Step 1/3: Committing uncommitted changes on ticket branch "${sourceBranch}"...`
    );
    try {
      commitWorktreeChanges(
        session.workingPath,
        `feat(${session.issueIdentifier}): implement approved plan for ${session.issueTitle}`
      );
    } catch {
      // Ignore
    }

    // Step 2: Push current ticket branch to remote first before merging
    let featureBranchPushed = false;
    if (pushFeatureBranchFirst) {
      this.executionStorage.appendLog(
        sessionId,
        'info',
        `[git] Step 2/3: Pushing current ticket branch "${sourceBranch}" to remote ("${remote}/${sourceBranch}")...`
      );
      this.executionStorage.updateSession(sessionId, {
        progressMessage: `Pushing ticket branch "${sourceBranch}" to remote "${remote}"...`,
      });

      const pushResult = pushBranch(session.repositoryPath, sourceBranch, remote);
      if (pushResult.success) {
        featureBranchPushed = true;
        this.executionStorage.appendLog(
          sessionId,
          'info',
          `[git] ✓ Current ticket branch "${sourceBranch}" successfully pushed to remote ("${remote}/${sourceBranch}").`
        );
      } else if (pushResult.error?.includes('has no remotes configured')) {
        this.executionStorage.appendLog(
          sessionId,
          'info',
          `[git] Note: Repository has no remote configured. Skipping remote push for "${sourceBranch}".`
        );
      } else {
        // Push failed with actual remote error
        this.executionStorage.appendLog(
          sessionId,
          'error',
          `[git] Failed to push ticket branch "${sourceBranch}" to "${remote}": ${pushResult.error || pushResult.message}`
        );
        throw new Error(
          `Failed to push ticket branch "${sourceBranch}" to remote before merging: ${pushResult.error || pushResult.message}`
        );
      }
    }

    // Step 3: Merge ticket branch into base branch
    const commitMessage =
      options.commitMessage ||
      `feat(${session.issueIdentifier}): merge '${sourceBranch}' into ${targetBranch}`;

    this.executionStorage.appendLog(
      sessionId,
      'info',
      `[git] Step 3/3: Merging ticket branch "${sourceBranch}" into base branch "${targetBranch}"...`
    );
    this.executionStorage.updateSession(sessionId, {
      progressMessage: `Merging "${sourceBranch}" into "${targetBranch}"...`,
    });

    const mergeResult = mergeBranch(
      session.repositoryPath,
      sourceBranch,
      targetBranch,
      commitMessage
    );

    if (!mergeResult.success) {
      this.executionStorage.updateSession(sessionId, {
        mergeStatus: 'merge_failed',
      });
      this.executionStorage.appendLog(
        sessionId,
        'error',
        `[git] Merge into "${targetBranch}" failed: ${mergeResult.error}`
      );
      throw new Error(mergeResult.error || `Failed to merge branch into "${targetBranch}".`);
    }

    this.executionStorage.appendLog(
      sessionId,
      'info',
      `[git] ✓ Successfully merged branch "${sourceBranch}" into "${targetBranch}" (Commit: ${mergeResult.commitSha}).`
    );

    // Step 4 (optional): Push the updated base branch to remote
    let baseBranchPushed = false;
    if (pushBaseBranch) {
      const pushBaseResult = pushBranch(session.repositoryPath, targetBranch, remote);
      if (pushBaseResult.success) {
        baseBranchPushed = true;
        this.executionStorage.appendLog(
          sessionId,
          'info',
          `[git] ✓ Updated base branch "${targetBranch}" successfully pushed to remote ("${remote}/${targetBranch}").`
        );
      } else if (pushBaseResult.error?.includes('has no remotes configured')) {
        // No remote configured, ignore
      } else {
        this.executionStorage.appendLog(
          sessionId,
          'warn',
          `[git] Warning: Merged locally, but could not push base branch "${targetBranch}" to "${remote}": ${pushBaseResult.error}`
        );
      }
    }

    const updated = this.executionStorage.updateSession(sessionId, {
      mergeStatus: 'merged',
      mergedAt: new Date().toISOString(),
      mergeCommitSha: mergeResult.commitSha,
      progressMessage: featureBranchPushed
        ? `Branch "${sourceBranch}" pushed to remote and merged into "${targetBranch}" (${mergeResult.commitSha?.slice(0, 7)}).`
        : `Branch "${sourceBranch}" merged into "${targetBranch}" (${mergeResult.commitSha?.slice(0, 7)}).`,
    });

    // Two-way Linear status sync: transition issue to 'completed' (Done)
    this.linear
      .syncExecutionStatus(session.issueIdentifier, 'completed', {
        comment: `🎉 **DevFlow AI** pushed branch \`${sourceBranch}\` to remote and merged into \`${targetBranch}\` (Commit: \`${mergeResult.commitSha?.slice(0, 7)}\`).`,
      })
      .catch(() => {});

    return updated!;
  }

  /**
   * Pushes the ticket branch to remote and creates/generates a Pull Request.
   */
  public async createPullRequest(
    sessionId: string,
    options: CreatePullRequestInput = {}
  ): Promise<{ success: boolean; prUrl?: string; prNumber?: number; message: string; session: ExecutionSessionRecord }> {
    const session = this.executionStorage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found.`);
    }

    if (session.status !== 'completed') {
      throw new Error(
        `Only completed execution sessions can be pushed to create a PR. Current status: "${session.status}".`
      );
    }

    const sourceBranch = session.ticketBranch || session.branch;
    const targetBranch = options.targetBranch || session.baseBranch || detectBaseBranch(session.repositoryPath);

    // Ensure all changes in working path are committed before pushing
    try {
      commitWorktreeChanges(
        session.workingPath,
        `feat(${session.issueIdentifier}): implement approved plan for ${session.issueTitle}`
      );
    } catch {
      // Ignore
    }

    this.executionStorage.appendLog(
      sessionId,
      'info',
      `Pushing branch "${sourceBranch}" to remote origin...`
    );

    // 1. Push branch to remote origin
    const pushResult = pushBranch(session.repositoryPath, sourceBranch, 'origin');
    if (!pushResult.success) {
      this.executionStorage.updateSession(sessionId, {
        prStatus: 'pr_failed',
      });
      this.executionStorage.appendLog(
        sessionId,
        'error',
        `Push to origin failed: ${pushResult.error || pushResult.message}`
      );
      throw new Error(pushResult.error || pushResult.message);
    }

    this.executionStorage.appendLog(
      sessionId,
      'info',
      `✓ Successfully pushed branch "${sourceBranch}" to origin.`
    );

    // 2. Prepare PR Title & Description
    const title = options.title || `feat(${session.issueIdentifier}): ${session.issueTitle}`;
    const checksList =
      session.verificationResults.length > 0
        ? session.verificationResults.map((v) => `- [x] \`${v.name}\` (${v.status})`).join('\n')
        : '- [x] Automated tests and validation checks passed';

    const filesList =
      session.changedFiles.length > 0
        ? session.changedFiles.slice(0, 15).map((f) => `- \`${f.path}\` (${f.status})`).join('\n') +
          (session.changedFiles.length > 15 ? `\n- ...and ${session.changedFiles.length - 15} more file(s)` : '')
        : '- Automated implementation files';

    const body =
      options.body ||
      [
        `## Summary`,
        `Resolves **${session.issueIdentifier}**: ${session.issueTitle}`,
        ``,
        `### Implementation Overview`,
        session.summary || `Approved implementation plan completed and verified autonomously.`,
        ``,
        `### Verification Checklist`,
        checksList,
        ``,
        `### Modified Files (${session.changedFiles.length})`,
        filesList,
        ``,
        `---`,
        `*Created automatically with [DevFlow-AI](https://github.com/Sahil-Sojitra/DevFlow-AI)*`,
      ].join('\n');

    // 3. Inspect Remote Info
    const remoteInfo = parseRemoteUrl(session.repositoryPath, 'origin');

    let prUrl: string | undefined;
    let prNumber: number | undefined;

    // 4. Attempt GitHub API if token available
    if (remoteInfo?.provider === 'github' && remoteInfo.owner && remoteInfo.repo && this.config.githubToken) {
      try {
        this.executionStorage.appendLog(
          sessionId,
          'info',
          `Calling GitHub API to create Pull Request on ${remoteInfo.owner}/${remoteInfo.repo}...`
        );
        const resp = await fetch(
          `https://api.github.com/repos/${remoteInfo.owner}/${remoteInfo.repo}/pulls`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${this.config.githubToken}`,
              'Content-Type': 'application/json',
              'User-Agent': 'DevFlow-AI',
            },
            body: JSON.stringify({
              title,
              body,
              head: sourceBranch,
              base: targetBranch,
              draft: Boolean(options.draft),
            }),
          }
        );

        if (resp.ok) {
          const prData = (await resp.json()) as { html_url: string; number: number };
          prUrl = prData.html_url;
          prNumber = prData.number;
          this.executionStorage.appendLog(
            sessionId,
            'info',
            `✓ Created GitHub Pull Request #${prNumber}: ${prUrl}`
          );
        } else {
          const errText = await resp.text();
          this.executionStorage.appendLog(
            sessionId,
            'warn',
            `GitHub API returned status ${resp.status}: ${errText}. Falling back to 1-click comparison link.`
          );
        }
      } catch (apiErr: unknown) {
        this.executionStorage.appendLog(
          sessionId,
          'warn',
          `GitHub API call error: ${(apiErr as Error).message}. Falling back to 1-click comparison link.`
        );
      }
    }

    // 5. Fallback to 1-click PR comparison URL
    if (!prUrl && remoteInfo) {
      const webUrl = generatePrWebUrl(remoteInfo, sourceBranch, targetBranch, title, body);
      if (webUrl) {
        prUrl = webUrl;
        this.executionStorage.appendLog(
          sessionId,
          'info',
          `Generated 1-click Pull Request creation link for ${remoteInfo.provider}.`
        );
      }
    }

    const updatedSession = this.executionStorage.updateSession(sessionId, {
      prStatus: 'created',
      prUrl,
      prNumber,
      progressMessage: prNumber
        ? `Pull Request #${prNumber} created on ${remoteInfo?.provider || 'remote'}!`
        : `Branch pushed and Pull Request ready for review.`,
    });

    // Two-way Linear status sync: link PR in Linear ticket
    if (prUrl) {
      this.linear
        .syncExecutionStatus(session.issueIdentifier, 'in_review', {
          comment: `🔗 **DevFlow AI** created/linked Pull Request: ${prUrl}${prNumber ? ` (#${prNumber})` : ''} on branch \`${sourceBranch}\`.`,
        })
        .catch(() => {});
    }

    return {
      success: true,
      prUrl,
      prNumber,
      message: prNumber
        ? `Pull Request #${prNumber} created successfully!`
        : `Branch pushed successfully to remote origin.`,
      session: updatedSession!,
    };
  }
}
