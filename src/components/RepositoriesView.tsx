'use client';

import React, { useState } from 'react';
import {
  FolderGit2,
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Plus,
  Trash2,
  Terminal,
} from 'lucide-react';
import type { RepositoryInfo } from '@/services/repo-registry';

interface RepositoriesViewProps {
  repositories: RepositoryInfo[];
  onAddRepository?: (repoPath: string) => Promise<RepositoryInfo | null>;
  onRemoveRepository?: (repoPath: string) => Promise<boolean>;
}

export function RepositoriesView({
  repositories,
  onAddRepository,
  onRemoveRepository,
}: RepositoriesViewProps) {
  const [newPath, setNewPath] = useState('');
  const [adding, setAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPath.trim()) return;

    setAdding(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (onAddRepository) {
        const added = await onAddRepository(newPath.trim());
        if (added) {
          setSuccessMessage(`Repository "${added.name}" registered successfully!`);
          setNewPath('');
        }
      } else {
        const res = await fetch('/api/repositories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: newPath.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error || 'Failed to add repository.');
        } else {
          setSuccessMessage(`Repository registered successfully!`);
          setNewPath('');
        }
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to register repository.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (repoPath: string) => {
    if (confirm(`Remove "${repoPath}" from dashboard repositories list?`)) {
      if (onRemoveRepository) {
        await onRemoveRepository(repoPath);
      } else {
        await fetch(`/api/repositories?path=${encodeURIComponent(repoPath)}`, {
          method: 'DELETE',
        });
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Target Repositories
          </h1>
          <span
            className="mono-chip"
            style={{
              fontSize: '0.7rem',
              padding: '0.1rem 0.45rem',
              color: 'var(--text-secondary)',
            }}
          >
            {repositories.length} allowed
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
          Repository containment registry. Antigravity operations and plans are strictly confined to these directories.
        </p>
      </div>

      {/* Register Repository Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
          <FolderGit2 size={15} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>Register Local Project Repository</h2>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          Paste an absolute folder path on your machine to authorize it for Antigravity planning and verification.
        </p>

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="e.g. d:\projects\my-app or /Users/dev/repos/backend"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            style={{
              flex: 1,
              minWidth: '240px',
              padding: '0.45rem 0.65rem',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={adding || !newPath.trim()}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-primary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: adding || !newPath.trim() ? 'not-allowed' : 'pointer',
              opacity: adding || !newPath.trim() ? 0.6 : 1,
            }}
          >
            <Plus size={13} />
            <span>{adding ? 'Validating...' : 'Register'}</span>
          </button>
        </form>

        {errorMessage && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
            {successMessage}
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xs)',
          padding: '0.65rem 0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          fontSize: '0.78rem',
        }}
      >
        <ShieldCheck size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
        <span style={{ color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Containment Enforced:</strong> The browser and agent cannot execute outside these directories. Any path traversal is blocked by server middleware.
        </span>
      </div>

      {/* Repositories Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {repositories.map((repo) => (
          <div
            key={repo.id}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: `1px solid ${repo.hasUncommittedChanges ? 'var(--warning-border)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FolderGit2 size={16} color="var(--accent-primary)" />
                <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  {repo.name}
                </span>
                {repo.packageDetails?.version && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: 'var(--bg-tertiary)',
                      padding: '0.05rem 0.35rem',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    v{repo.packageDetails.version}
                  </span>
                )}
                {repo.isCustomRegistered && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-secondary)',
                      padding: '0.05rem 0.35rem',
                      borderRadius: 'var(--radius-xs)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Custom
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                {repo.exists ? (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: 'var(--success-subtle)',
                      border: '1px solid var(--success-border)',
                      color: 'var(--success)',
                      padding: '0.1rem 0.45rem',
                      borderRadius: 'var(--radius-xs)',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <CheckCircle2 size={11} />
                    Verified
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: 'var(--danger-subtle)',
                      border: '1px solid var(--danger-border)',
                      color: 'var(--danger)',
                      padding: '0.1rem 0.45rem',
                      borderRadius: 'var(--radius-xs)',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <XCircle size={11} />
                    Missing
                  </span>
                )}

                {repo.isCustomRegistered && (
                  <button
                    onClick={() => handleRemove(repo.path)}
                    title="Remove from dashboard"
                    style={{
                      color: 'var(--text-muted)',
                      padding: '0.25rem',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Path */}
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                backgroundColor: 'var(--bg-primary)',
                padding: '0.4rem 0.65rem',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                wordBreak: 'break-all',
              }}
            >
              {repo.path}
            </div>

            {/* Git Working Tree Status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.45rem',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                paddingTop: '0.15rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}>
                <GitBranch size={13} />
                <span>Branch:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {repo.branch}
                </span>
              </div>

              {repo.hasUncommittedChanges ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--warning)', fontWeight: 500 }}>
                  <AlertTriangle size={13} />
                  <span>{repo.uncommittedCount} uncommitted change(s) in tree</span>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>Working tree clean</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
