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
  completed: ['running'],
  failed: ['running'],
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

export interface SessionRevision {
  id: string;
  feedback: string;
  planContent: string;
  createdAt: string;
  approvedAt?: string;
  appliedAt?: string;
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
  isDone?: boolean;
  doneAt?: string;
  doneNote?: string;
  revisionCount?: number;
  revisions?: SessionRevision[];
  pendingRevision?: SessionRevision | null;
  autoFixAttempts?: number;
  maxAutoFixAttempts?: number;
  stuckInHallucination?: boolean;
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
  isDone?: boolean;
  doneAt?: string;
  revisionCount?: number;
  autoFixAttempts?: number;
  stuckInHallucination?: boolean;
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

export const RequestRevisionSchema = z.object({
  feedback: z
    .string()
    .min(3, 'Feedback must be at least 3 characters')
    .max(5000, 'Feedback cannot exceed 5000 characters'),
});
export type RequestRevisionInput = z.infer<typeof RequestRevisionSchema>;

export const ApplyRevisionSchema = z.object({
  planContent: z
    .string()
    .min(5, 'Revision plan content must be at least 5 characters')
    .max(50000, 'Revision plan content cannot exceed 50000 characters'),
  feedback: z.string().max(5000).optional(),
});
export type ApplyRevisionInput = z.infer<typeof ApplyRevisionSchema>;

export const MarkDoneSchema = z.object({
  note: z.string().max(1000).optional(),
});
export type MarkDoneInput = z.infer<typeof MarkDoneSchema>;
