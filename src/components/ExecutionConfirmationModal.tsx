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
} from 'lucide-react';
import type { LinearIssue } from '@/types/linear';
import type { RepositoryInfo } from '@/services/repo-registry';
import type { SavedPlanDetail } from '@/services/plan-storage';

interface ExecutionConfirmationModalProps {
  isOpen: boolean;
  ticket: LinearIssue | null;
  plan: SavedPlanDetail | null;
  repository: RepositoryInfo | null;
  loading: boolean;
  onConfirm: (useIsolation: boolean) => void;
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

  if (!isOpen || !plan) return null;

  const isDirty = repository?.hasUncommittedChanges ?? false;
  const uncommittedCount = repository?.uncommittedCount ?? 0;

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
          maxWidth: '560px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
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
                Authorize Implementation
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Milestone 4: Controlled Implementation & Verification
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
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
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

          {/* Repository & Working Tree State */}
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Target Repository & Branch
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <FolderGit2 size={15} color="var(--text-muted)" />
              <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {repository?.path || plan.repository}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <GitBranch size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Branch: <strong style={{ color: 'var(--text-primary)' }}>{repository?.branch || plan.branch}</strong>
              </span>
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
              <span>Working tree is clean. Ready for implementation.</span>
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
              DevFlow AI will <strong>never</strong> automatically commit, push, merge, or deploy. You remain in full control.
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
            onClick={() => onConfirm(useIsolation)}
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
            <span>{loading ? 'Starting Execution...' : 'Authorize & Start Implementation'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
