'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  GitBranch,
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
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '0.75rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
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
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <GitBranch size={15} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                Branch Setup & Execution
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Direct Branching Mode · No worktree
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            style={{
              color: 'var(--text-muted)',
              padding: '0.35rem',
              borderRadius: 'var(--radius-xs)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            aria-label="Close dialog"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Target Issue & Plan */}
          <div
            style={{
              padding: '0.75rem 0.85rem',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem', fontFamily: 'var(--font-mono)' }}>
              APPROVED PLAN TARGET
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
              <span
                style={{
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-primary)',
                  fontSize: '0.78rem',
                  backgroundColor: 'var(--accent-subtle)',
                  padding: '0.1rem 0.4rem',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--accent-border)',
                }}
              >
                {plan.issueIdentifier}
              </span>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                {plan.title}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--success)' }}>
              <CheckCircle2 size={12} />
              <span>Plan approved by human reviewer</span>
            </div>
          </div>

          {/* 1. Base Branch Setting */}
          <div
            style={{
              padding: '0.75rem 0.85rem',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <GitFork size={13} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  BASE BRANCH (Pull from)
                </span>
              </div>

              {/* Preset buttons */}
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {(['main', 'master', 'develop', 'custom'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBaseBranchChoice(b)}
                    style={{
                      padding: '0.15rem 0.5rem',
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-mono)',
                      borderRadius: 'var(--radius-xs)',
                      border: `1px solid ${baseBranchChoice === b ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      backgroundColor: baseBranchChoice === b ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                      color: baseBranchChoice === b ? 'var(--accent-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: baseBranchChoice === b ? 600 : 400,
                    }}
                  >
                    {b === 'custom' ? 'Custom...' : b}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            {baseBranchChoice === 'custom' && (
              <input
                type="text"
                value={customBaseBranchInput}
                onChange={(e) => setCustomBaseBranchInput(e.target.value)}
                placeholder="e.g. release/v2.0, staging, sprint-4"
                style={{
                  padding: '0.35rem 0.6rem',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  outline: 'none',
                }}
              />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <ArrowDownToLine size={12} color="var(--accent-primary)" />
              <span>
                DevFlow pulls <strong>{effectiveBaseBranch}</strong> and creates new branch from it.
              </span>
            </div>
          </div>

          {/* 2. Feature Branch Naming Options */}
          <div
            style={{
              padding: '0.75rem 0.85rem',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-mono)' }}>
              <GitBranch size={13} color="var(--accent-primary)" />
              <span>TICKET BRANCH TO CHECKOUT</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {/* Option 1: Default per ticket */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: branchOption === 'ticket' ? 'var(--accent-subtle)' : 'transparent',
                  border: `1px solid ${branchOption === 'ticket' ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
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
                <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                  Per ticket: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{defaultTicketBranch}</strong>
                </span>
              </label>

              {/* Option 2: Custom Branch Name */}
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: branchOption === 'custom' ? 'var(--accent-subtle)' : 'transparent',
                  border: `1px solid ${branchOption === 'custom' ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="radio"
                    name="branchOption"
                    value="custom"
                    checked={branchOption === 'custom'}
                    onChange={() => setBranchOption('custom')}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    Custom branch name
                  </span>
                </div>
                {branchOption === 'custom' && (
                  <input
                    type="text"
                    value={customBranchName}
                    onChange={(e) => setCustomBranchName(e.target.value)}
                    placeholder="e.g. feature/user-auth"
                    style={{
                      marginLeft: '1.4rem',
                      padding: '0.3rem 0.55rem',
                      borderRadius: 'var(--radius-xs)',
                      border: '1px solid var(--border-default)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
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
                  gap: '0.5rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: branchOption === 'current' ? 'var(--accent-subtle)' : 'transparent',
                  border: `1px solid ${branchOption === 'current' ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
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
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Stay on active branch (<strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{repository?.branch || plan.branch}</strong>)
                </span>
              </label>
            </div>
          </div>

          {/* Working Tree Notice */}
          {isDirty && (
            <div
              style={{
                padding: '0.65rem 0.85rem',
                backgroundColor: 'var(--warning-subtle)',
                border: '1px solid var(--warning-border)',
                borderRadius: 'var(--radius-xs)',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle size={15} color="var(--warning)" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div style={{ fontSize: '0.75rem', color: '#fef08a', lineHeight: 1.4 }}>
                <strong>Uncommitted Changes ({uncommittedCount}):</strong>
                <div>Git will carry uncommitted edits over to the new branch if clean.</div>
              </div>
            </div>
          )}

          {/* Strategy Summary */}
          <div
            style={{
              padding: '0.65rem 0.85rem',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.5,
            }}
          >
            <div>1. Pull <span style={{ color: 'var(--text-primary)' }}>{effectiveBaseBranch}</span></div>
            <div>2. Checkout <span style={{ color: 'var(--accent-primary)' }}>{effectiveTicketBranch}</span></div>
            <div>3. Run Antigravity $\to$ Verify $\to$ Review Diff</div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            backgroundColor: 'var(--bg-tertiary)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.5rem',
          }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
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
              padding: '0.45rem 1.15rem',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <Play size={12} fill="currentColor" />
            <span>{loading ? 'Starting...' : 'Checkout & Start Implementation'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
