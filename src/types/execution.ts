import { z } from 'zod';

export type ExecutionSessionStatus =
  | 'queued'
  | 'running'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked';

/**
 * Permitted state transitions between session statuses.
 * Prevents invalid out-of-order transitions.
 */
export const VALID_STATUS_TRANSITIONS: Record<ExecutionSessionStatus, ExecutionSessionStatus[]> = {
  queued: ['running', 'blocked', 'failed', 'cancelled'],
  running: ['verifying', 'failed', 'cancelled'],
  verifying: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
  blocked: [],
};

export class InvalidStateTransitionError extends Error {
  constructor(from: ExecutionSessionStatus, to: ExecutionSessionStatus) {
    super(`Invalid session status transition from "${from}" to "${to}".`);
    this.name = 'InvalidStateTransitionError';
  }
}

export type VerificationCheckName = 'typecheck' | 'test' | 'lint' | 'build';
export type VerificationCheckStatus = 'passed' | 'failed' | 'not_configured' | 'skipped';

export interface VerificationResult {
  name: VerificationCheckName;
  command: string;
  status: VerificationCheckStatus;
  durationMs: number;
  output: string;
  error?: string;
}

export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  isPreExisting: boolean;
}

export interface SessionLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface ExecutionSessionRecord {
  id: string;
  issueIdentifier: string;
  issueTitle: string;
  planFilePath: string;
  repositoryPath: string;
  workingPath: string;
  isIsolated: boolean;
  worktreePath?: string;
  branch: string;
  baselineCommit: string;
  baselineDirtyCount: number;
  baselineFiles: string[];
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  status: ExecutionSessionStatus;
  progressMessage: string;
  logs: SessionLogEntry[];
  changedFiles: ChangedFile[];
  verificationResults: VerificationResult[];
  implementationCompleted: boolean;
  verificationPassed: boolean;
  exitCode?: number | null;
  error?: string;
  summary?: string;
}

export interface ExecutionSessionSummary {
  id: string;
  issueIdentifier: string;
  issueTitle: string;
  repositoryPath: string;
  branch: string;
  isIsolated: boolean;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  status: ExecutionSessionStatus;
  progressMessage: string;
  changedFilesCount: number;
  verificationPassed: boolean;
  error?: string;
}

/**
 * Validation schema for starting an execution session.
 */
export const CreateExecutionRequestSchema = z.object({
  issueIdentifier: z
    .string()
    .min(1, 'issueIdentifier is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'issueIdentifier must be alphanumeric with dashes or underscores'),
  repoPath: z.string().optional(),
  useIsolation: z.boolean().optional(),
});

export type CreateExecutionRequest = z.infer<typeof CreateExecutionRequestSchema>;
