import fs from 'node:fs';
import path from 'node:path';
import { getAppConfig, type AppConfig } from '../config/env.js';
import {
  type ExecutionSessionRecord,
  type ExecutionSessionSummary,
  type ExecutionSessionStatus,
  VALID_STATUS_TRANSITIONS,
  InvalidStateTransitionError,
} from '../types/execution.js';
import { redactSecrets } from './verification.js';

export class ExecutionConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionConcurrencyError';
  }
}

/**
 * In-memory concurrency locks: active repositories and active issues.
 */
const activeRepositoryLocks = new Set<string>();
const activeIssueLocks = new Set<string>();

/**
 * In-memory process cancellation callbacks for active runs.
 */
const activeProcessCancelFns = new Map<string, () => void>();

/**
 * Storage and state machine manager for execution sessions.
 */
export class ExecutionStorageService {
  private readonly config: AppConfig;
  private readonly sessionsDir: string;

  constructor(config?: AppConfig, customSessionsDir?: string) {
    this.config = config ?? getAppConfig();
    this.sessionsDir = customSessionsDir
      ? path.resolve(customSessionsDir)
      : path.resolve('data', 'sessions');
  }

  public getSessionsDir(): string {
    return this.sessionsDir;
  }

  /**
   * Sanitizes session ID to prevent path traversal.
   */
  public sanitizeSessionId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private getSessionFilePath(sessionId: string): string {
    const safeId = this.sanitizeSessionId(sessionId);
    return path.join(this.sessionsDir, `${safeId}.json`);
  }

  /**
   * Acquires concurrency locks for both the repository path and the issue ID.
   */
  public acquireExecutionLock(repoPath: string, issueId: string): () => void {
    const normalizedRepo = path.resolve(repoPath).toLowerCase();
    const normalizedIssue = issueId.trim().toUpperCase();

    if (activeRepositoryLocks.has(normalizedRepo)) {
      throw new ExecutionConcurrencyError(
        `An execution is already running for repository: "${repoPath}"`
      );
    }

    if (activeIssueLocks.has(normalizedIssue)) {
      throw new ExecutionConcurrencyError(
        `An execution is already running for issue: "${issueId}"`
      );
    }

    activeRepositoryLocks.add(normalizedRepo);
    activeIssueLocks.add(normalizedIssue);

    let released = false;
    return () => {
      if (!released) {
        released = true;
        activeRepositoryLocks.delete(normalizedRepo);
        activeIssueLocks.delete(normalizedIssue);
      }
    };
  }

  public isRepoLocked(repoPath: string): boolean {
    return activeRepositoryLocks.has(path.resolve(repoPath).toLowerCase());
  }

  public isIssueLocked(issueId: string): boolean {
    return activeIssueLocks.has(issueId.trim().toUpperCase());
  }

  /**
   * Registers a cancellation function for an active process.
   */
  public registerActiveProcess(sessionId: string, cancelFn: () => void): void {
    activeProcessCancelFns.set(this.sanitizeSessionId(sessionId), cancelFn);
  }

  /**
   * Unregisters a cancellation function.
   */
  public unregisterActiveProcess(sessionId: string): void {
    activeProcessCancelFns.delete(this.sanitizeSessionId(sessionId));
  }

  /**
   * Invokes cancellation if the process is currently active.
   */
  public cancelActiveProcess(sessionId: string): boolean {
    const safeId = this.sanitizeSessionId(sessionId);
    const cancelFn = activeProcessCancelFns.get(safeId);
    if (cancelFn) {
      try {
        cancelFn();
      } finally {
        activeProcessCancelFns.delete(safeId);
      }
      return true;
    }
    return false;
  }

  /**
   * Saves or updates an execution session to disk.
   */
  public saveSession(session: ExecutionSessionRecord): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }

    // Bound logs to 500 entries
    if (session.logs.length > 500) {
      session.logs = session.logs.slice(-500);
    }

    // Ensure all log messages and error messages are redacted
    session.logs = session.logs.map((log) => ({
      ...log,
      message: redactSecrets(log.message),
    }));

    if (session.error) {
      session.error = redactSecrets(session.error);
    }

    if (session.summary) {
      session.summary = redactSecrets(session.summary);
    }

    const filePath = this.getSessionFilePath(session.id);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
  }

  /**
   * Retrieves a session from disk by ID.
   */
  public getSession(sessionId: string): ExecutionSessionRecord | null {
    const filePath = this.getSessionFilePath(sessionId);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data) as ExecutionSessionRecord;
    } catch {
      return null;
    }
  }

  /**
   * Transitions a session to a new status with validation against permitted transitions.
   */
  public transitionSession(
    sessionId: string,
    newStatus: ExecutionSessionStatus,
    updates: Partial<ExecutionSessionRecord> = {}
  ): ExecutionSessionRecord {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found.`);
    }

    const permitted = VALID_STATUS_TRANSITIONS[session.status];
    if (!permitted.includes(newStatus)) {
      throw new InvalidStateTransitionError(session.status, newStatus);
    }

    const updatedSession: ExecutionSessionRecord = {
      ...session,
      ...updates,
      status: newStatus,
    };

    if (
      ['completed', 'failed', 'cancelled', 'blocked'].includes(newStatus) &&
      !updatedSession.endedAt
    ) {
      updatedSession.endedAt = new Date().toISOString();
    }

    this.saveSession(updatedSession);
    return updatedSession;
  }

  /**
   * Updates fields of a session without modifying its state machine status.
   */
  public updateSession(
    sessionId: string,
    updates: Partial<ExecutionSessionRecord>
  ): ExecutionSessionRecord | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const updatedSession: ExecutionSessionRecord = {
      ...session,
      ...updates,
    };

    this.saveSession(updatedSession);
    return updatedSession;
  }

  /**
   * Appends a log entry to a session.
   */
  public appendLog(
    sessionId: string,
    level: 'info' | 'warn' | 'error',
    message: string
  ): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    session.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message: redactSecrets(message),
    });

    this.saveSession(session);
  }

  /**
   * Lists all execution sessions sorted by createdAt descending.
   */
  public listSessions(): ExecutionSessionSummary[] {
    if (!fs.existsSync(this.sessionsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.sessionsDir);
    const sessions: ExecutionSessionSummary[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(this.sessionsDir, file);
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          const rec = JSON.parse(raw) as ExecutionSessionRecord;
          sessions.push({
            id: rec.id,
            issueIdentifier: rec.issueIdentifier,
            issueTitle: rec.issueTitle,
            repositoryPath: rec.repositoryPath,
            branch: rec.branch,
            isIsolated: rec.isIsolated,
            createdAt: rec.createdAt,
            startedAt: rec.startedAt,
            endedAt: rec.endedAt,
            status: rec.status,
            progressMessage: rec.progressMessage,
            changedFilesCount: rec.changedFiles?.length ?? 0,
            verificationPassed: rec.verificationPassed ?? false,
            error: rec.error,
          });
        } catch {
          // Ignore corrupt file
        }
      }
    }

    return sessions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}
