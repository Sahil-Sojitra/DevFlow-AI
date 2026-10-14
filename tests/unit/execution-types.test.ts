import { describe, it, expect } from 'vitest';
import {
  VALID_STATUS_TRANSITIONS,
  InvalidStateTransitionError,
  CreateExecutionRequestSchema,
  type ExecutionSessionStatus,
} from '../../src/types/execution.js';

describe('Execution Types & State Machine', () => {
  it('defines valid state transitions for execution sessions', () => {
    expect(VALID_STATUS_TRANSITIONS['queued']).toEqual(['running', 'blocked', 'failed', 'cancelled']);
    expect(VALID_STATUS_TRANSITIONS['running']).toEqual(['verifying', 'failed', 'cancelled']);
    expect(VALID_STATUS_TRANSITIONS['verifying']).toEqual(['completed', 'failed', 'cancelled']);
    expect(VALID_STATUS_TRANSITIONS['completed']).toEqual(['running']);
    expect(VALID_STATUS_TRANSITIONS['failed']).toEqual(['running']);
    expect(VALID_STATUS_TRANSITIONS['cancelled']).toEqual([]);
    expect(VALID_STATUS_TRANSITIONS['blocked']).toEqual([]);
  });

  it('instantiates InvalidStateTransitionError with informative message', () => {
    const err = new InvalidStateTransitionError('cancelled', 'running');
    expect(err.name).toBe('InvalidStateTransitionError');
    expect(err.message).toBe('Invalid session status transition from "cancelled" to "running".');
  });

  describe('CreateExecutionRequestSchema', () => {
    it('accepts valid issueIdentifier and options', () => {
      const valid = CreateExecutionRequestSchema.safeParse({
        issueIdentifier: 'SAH-6',
        repoPath: 'D:/sample',
        useIsolation: true,
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.issueIdentifier).toBe('SAH-6');
        expect(valid.data.useIsolation).toBe(true);
      }
    });

    it('rejects empty issueIdentifier', () => {
      const invalid = CreateExecutionRequestSchema.safeParse({
        issueIdentifier: '',
      });
      expect(invalid.success).toBe(false);
    });

    it('rejects malicious characters in issueIdentifier for path traversal protection', () => {
      const traversal = CreateExecutionRequestSchema.safeParse({
        issueIdentifier: '../../../etc/passwd',
      });
      expect(traversal.success).toBe(false);

      const spaces = CreateExecutionRequestSchema.safeParse({
        issueIdentifier: 'SAH 6; rm -rf',
      });
      expect(spaces.success).toBe(false);
    });
  });
});
