'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  GitBranch,
  FolderGit2,
  AlertTriangle,
  CheckCircle2,
  Play,
  X,
  ArrowDownToLine,
  GitFork,
} from 'lucide-react';
import type { LinearIssue } from '@/types/linear';
import type { RepositoryInfo } from '@/services/repo-registry';
import type { SavedPlanDetail } from '@/services/plan-storage';

export interface ExecutionOptions {
  useIsolation: boolean;
  branchOption: 'ticket' | 'custom' | 'current';
  customBranchName?: string;
  baseBranch: string;
}

interface ExecutionConfirmationModalProps {
  isOpen: boolean;
  ticket: LinearIssue | null;
  plan: SavedPlanDetail | null;
  repository: RepositoryInfo | null;
  loading: boolean;
  onConfirm: (options: ExecutionOptions) => void;
  onClose: () => void;
}

export function ExecutionConfirmationModal({
  isOpen,
  ticket,
  plan,
  repository,
  loading,
  onConfirm,
  onClose,
}: ExecutionConfirmationModalProps) {
  // Preset or custom base branch
  const initialBase = repository?.branch === 'master' ? 'master' : 'main';
  const [baseBranchChoice, setBaseBranchChoice] = useState<'main' | 'master' | 'develop' | 'custom'>(
    initialBase === 'master' ? 'master' : 'main'
  );
  const [customBaseBranchInput, setCustomBaseBranchInput] = useState('');

  // Feature branch options
  const [branchOption, setBranchOption] = useState<'ticket' | 'custom' | 'current'>('ticket');
  const defaultTicketBranch = plan
    ? `feat/${plan.issueIdentifier.toLowerCase()}`
    : 'feat/ticket';
  const [customBranchName, setCustomBranchName] = useState(defaultTicketBranch);

  if (!isOpen || !plan) return null;

  const isDirty = repository?.hasUncommittedChanges ?? false;
  const uncommittedCount = repository?.uncommittedCount ?? 0;

  // Resolve base branch
  const effectiveBaseBranch =
    baseBranchChoice === 'custom' && customBaseBranchInput.trim().length > 0
      ? customBaseBranchInput.trim()
      : baseBranchChoice === 'custom'
      ? 'main'
      : baseBranchChoice;

  const effectiveTicketBranch =
    branchOption === 'custom' && customBranchName.trim().length > 0
      ? customBranchName.trim()
      : branchOption === 'current'
      ? repository?.branch || plan.branch
      : defaultTicketBranch;

  const handleStart = () => {
    onConfirm({
      useIsolation: false, // Direct branch mode: no worktree created
      branchOption,
      customBranchName: branchOption === 'custom' ? customBranchName : undefined,
      baseBranch: effectiveBaseBranch,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-tertiary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success)',
              }}
            >
              <Play size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                Authorize Implementation & Branch Setup
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Direct Branching Mode (No worktree created)
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Target Issue & Plan */}
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Selected Ticket & Approved Plan
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontSize: '0.9rem' }}>
                {plan.issueIdentifier}
              </span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                {plan.title}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--success)' }}>
              <CheckCircle2 size={13} />
              <span>Plan review status is APPROVED</span>
            </div>
          </div>

          {/* 1. Base Branch Setting (Any custom branch or preset) */}
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <GitFork size={14} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Base Branch (Pull & Branch from):
                </span>
              </div>

              {/* Preset buttons */}
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {(['main', 'master', 'develop', 'custom'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBaseBranchChoice(b)}
                    style={{
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.72rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${baseBranchChoice === b ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      backgroundColor: baseBranchChoice === b ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-secondary)',
                      color: baseBranchChoice === b ? 'var(--accent-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: baseBranchChoice === b ? 700 : 400,
                    }}
                  >
                    {b === 'custom' ? 'Custom...' : b}
                  </button>
                ))}
              </div>
            </div>

            {/* If Custom is selected, show custom text input */}
            {baseBranchChoice === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                <input
                  type="text"
                  value={customBaseBranchInput}
                  onChange={(e) => setCustomBaseBranchInput(e.target.value)}
                  placeholder="Enter any base branch name (e.g. release/v2.0, staging, sprint-4)"
                  style={{
                    padding: '0.4rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              <ArrowDownToLine size={13} color="var(--accent-primary)" />
              <span>
                DevFlow will fetch/pull <strong>{effectiveBaseBranch}</strong> and branch from it directly.
              </span>
            </div>
          </div>

          {/* 2. Feature Branch Naming Options */}
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <GitBranch size={14} color="var(--accent-primary)" />
              <span>Ticket Branch to Create in Repository:</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {/* Option 1: Default per ticket */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: branchOption === 'ticket' ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                  border: `1px solid ${branchOption === 'ticket' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="branchOption"
                  value="ticket"
                  checked={branchOption === 'ticket'}
                  onChange={() => setBranchOption('ticket')}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  Default per ticket: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{defaultTicketBranch}</strong>
                </span>
              </label>

              {/* Option 2: Custom Branch Name */}
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: branchOption === 'custom' ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                  border: `1px solid ${branchOption === 'custom' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <input
                    type="radio"
                    name="branchOption"
                    value="custom"
                    checked={branchOption === 'custom'}
                    onChange={() => setBranchOption('custom')}
                  />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    Custom ticket branch name
                  </span>
                </div>
                {branchOption === 'custom' && (
                  <input
                    type="text"
                    value={customBranchName}
                    onChange={(e) => setCustomBranchName(e.target.value)}
                    placeholder="e.g. feature/user-authentication"
                    style={{
                      marginLeft: '1.6rem',
                      padding: '0.35rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  />
                )}
              </label>

              {/* Option 3: Current Branch */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: branchOption === 'current' ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                  border: `1px solid ${branchOption === 'current' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="branchOption"
                  value="current"
                  checked={branchOption === 'current'}
                  onChange={() => setBranchOption('current')}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Stay on current active branch (<strong style={{ color: 'var(--text-primary)' }}>{repository?.branch || plan.branch}</strong>)
                </span>
              </label>
            </div>
          </div>

          {/* Working Tree Notice */}
          {isDirty && (
            <div
              style={{
                padding: '0.85rem 1rem',
                backgroundColor: 'var(--warning-subtle)',
                border: '1px solid var(--warning)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.82rem', color: '#fef08a', lineHeight: 1.45 }}>
                <strong>Uncommitted Changes Detected ({uncommittedCount}):</strong>
                <div>
                  Your current working tree has uncommitted edits. Git will carry them over to the new branch if there are no conflicts.
                </div>
              </div>
            </div>
          )}

          {/* Summary Banner */}
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(56, 189, 248, 0.06)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
              Direct Branch Strategy Summary:
            </div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              1. Pull latest from <strong>{effectiveBaseBranch}</strong><br />
              2. Create & switch directly to <strong>{effectiveTicketBranch}</strong> in this repository<br />
              3. Run implementation, verify tests, and merge into <strong>{effectiveBaseBranch}</strong> after your approval
            </div>
          </div>

          {/* Safety Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              padding: '0 0.25rem',
            }}
          >
            <ShieldAlert size={15} color="var(--text-muted)" />
            <span>
              DevFlow AI will create and checkout branch <strong>{effectiveTicketBranch}</strong>. You decide when to merge into <strong>{effectiveBaseBranch}</strong>.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            backgroundColor: 'var(--bg-tertiary)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleStart}
            disabled={loading}
            style={{
              padding: '0.55rem 1.35rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--success)',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 0 14px rgba(34, 197, 94, 0.35)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            <Play size={15} fill="#fff" />
            <span>{loading ? 'Creating branch & starting...' : 'Create Branch & Start Implementation'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
