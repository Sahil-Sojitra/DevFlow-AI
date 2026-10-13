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
  Sparkles,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Configured Repositories</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Server-side repository registry. Filesystem operations and planning are strictly confined to these whitelisted paths.
        </p>
      </div>

      {/* Add Local Repository Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
          <Sparkles size={16} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>Register a Local Project Repository</h2>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
          Working on multiple projects? Paste the folder path of any local repository on your system to make it immediately available for Antigravity planning in the dashboard.
        </p>

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Paste local folder path (e.g. d:\D drive\Sobha\RFI\fe-rfi-classification)"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            style={{
              flex: 1,
              minWidth: '280px',
              padding: '0.55rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={adding || !newPath.trim()}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              cursor: 'pointer',
              opacity: adding || !newPath.trim() ? 0.6 : 1,
            }}
          >
            <Plus size={15} />
            <span>{adding ? 'Validating...' : 'Register Repository'}</span>
          </button>
        </form>

        {errorMessage && (
          <div style={{ marginTop: '0.65rem', fontSize: '0.8rem', color: 'var(--danger)' }}>
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div style={{ marginTop: '0.65rem', fontSize: '0.8rem', color: 'var(--success)' }}>
            {successMessage}
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div
        style={{
          backgroundColor: 'var(--accent-subtle)',
          border: '1px solid var(--accent-primary)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.85rem',
        }}
      >
        <ShieldCheck size={20} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
        <span style={{ color: 'var(--text-primary)' }}>
          <strong>Containment Enforced:</strong> The browser cannot execute actions on arbitrary paths. Only explicitly registered repositories shown below are authorized for Antigravity planning.
        </span>
      </div>

      {/* Repositories Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {repositories.map((repo) => (
          <div
            key={repo.id}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: `1px solid ${repo.hasUncommittedChanges ? 'var(--warning)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <FolderGit2 size={20} color="var(--accent-primary)" />
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff' }}>
                  {repo.name}
                </span>
                {repo.packageDetails?.version && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: 'var(--bg-tertiary)',
                      padding: '0.1rem 0.45rem',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    v{repo.packageDetails.version}
                  </span>
                )}
                {repo.isCustomRegistered && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-secondary)',
                      padding: '0.1rem 0.45rem',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    Custom Added
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {repo.exists ? (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      backgroundColor: 'var(--success-subtle)',
                      color: 'var(--success)',
                      padding: '0.15rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <CheckCircle2 size={12} />
                    Verified
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      backgroundColor: 'var(--danger-subtle)',
                      color: 'var(--danger)',
                      padding: '0.15rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <XCircle size={12} />
                    Path Missing
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
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Path */}
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                backgroundColor: 'var(--bg-primary)',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
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
                fontSize: '0.82rem',
                paddingTop: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-muted)' }}>
                <GitBranch size={15} />
                <span>Branch:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {repo.branch}
                </span>
              </div>

              {repo.hasUncommittedChanges ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--warning)', fontWeight: 500 }}>
                  <AlertTriangle size={14} />
                  <span>{repo.uncommittedCount} uncommitted change(s) in working tree</span>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>Working tree clean</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Guide to add more repos via .env */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
        }}
      >
        <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#fff', marginBottom: '0.4rem' }}>
          Configuring Repositories via .env
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          You can also specify multiple default allowed projects in your <code>.env</code> file separated by semicolons:
        </p>
        <pre
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            backgroundColor: 'var(--bg-primary)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            color: '#a5b4fc',
            overflowX: 'auto',
          }}
        >
          {`DEVFLOW_ALLOWED_WORKING_DIRS="d:\\D drive\\DevFlow; d:\\D drive\\Sobha\\RFI\\fe-rfi-classification"`}
        </pre>
      </div>
    </div>
  );
}
