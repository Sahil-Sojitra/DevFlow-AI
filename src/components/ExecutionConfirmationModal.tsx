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
  Layers,
  GitPullRequest,
  ArrowDownToLine,
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
  const [useIsolation, setUseIsolation] = useState(true);
  const [branchOption, setBranchOption] = useState<'ticket' | 'custom' | 'current'>('ticket');

  const defaultTicketBranch = plan
    ? `feat/${plan.issueIdentifier.toLowerCase()}`
    : 'feat/ticket';
  const [customBranchName, setCustomBranchName] = useState(defaultTicketBranch);

  const defaultBaseBranch = repository?.branch === 'master' ? 'master' : 'main';
  const [baseBranch, setBaseBranch] = useState(defaultBaseBranch);

  if (!isOpen || !plan) return null;

  const isDirty = repository?.hasUncommittedChanges ?? false;
  const uncommittedCount = repository?.uncommittedCount ?? 0;

  const handleStart = () => {
    onConfirm({
      useIsolation,
      branchOption,
      customBranchName: branchOption === 'custom' ? customBranchName : undefined,
      baseBranch,
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
                Phase 2: Automated Branch Creation & Controlled Execution
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

          {/* Base Branch & Pull Setting */}
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Base Branch to Pull From:
              </span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {['main', 'master'].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBaseBranch(b)}
                    style={{
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.72rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${baseBranch === b ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      backgroundColor: baseBranch === b ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-secondary)',
                      color: baseBranch === b ? 'var(--accent-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: baseBranch === b ? 600 : 400,
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              <ArrowDownToLine size={13} color="var(--accent-primary)" />
              <span>DevFlow will fetch/pull the latest changes from <strong>{baseBranch}</strong> before creating the feature branch.</span>
            </div>
          </div>

          {/* Feature Branch Naming Options */}
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
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <GitBranch size={14} color="var(--accent-primary)" />
              <span>Ticket Branch Creation:</span>
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
                    Custom branch name
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
                  Use current active branch (<strong style={{ color: 'var(--text-primary)' }}>{repository?.branch || plan.branch}</strong>)
                </span>
              </label>
            </div>
          </div>

          {/* Working Tree Protection Alert */}
          {isDirty ? (
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
                <strong>Working Tree Protection Active:</strong>
                <div>
                  This repository has <strong>{uncommittedCount} uncommitted change(s)</strong>.
                  DevFlow AI will run the implementation in an <strong>isolated Git worktree</strong> so your existing changes are never touched or overwritten.
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '0.85rem 1rem',
                backgroundColor: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                fontSize: '0.82rem',
                color: '#86efac',
              }}
            >
              <CheckCircle2 size={16} color="var(--success)" />
              <span>Working tree is clean. Ready for branch setup & implementation.</span>
            </div>
          )}

          {/* Isolation Option */}
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Layers size={16} color="var(--accent-primary)" />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>
                  Git Worktree Isolation
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {isDirty
                    ? 'Enforced because working tree has uncommitted changes'
                    : 'Executes in a dedicated worktree directory'}
                </div>
              </div>
            </div>

            <input
              type="checkbox"
              checked={useIsolation}
              disabled={isDirty || loading}
              onChange={(e) => setUseIsolation(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: isDirty ? 'not-allowed' : 'pointer' }}
            />
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
              DevFlow AI creates your ticket branch safely. You choose whether to merge into <strong>{baseBranch}</strong> or create a PR after review.
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
            <span>{loading ? 'Setting up branch & starting...' : 'Authorize & Start Implementation'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
