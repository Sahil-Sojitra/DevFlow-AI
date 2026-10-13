'use client';

import React from 'react';
import {
  FolderGit2,
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import type { RepositoryInfo } from '@/services/repo-registry';

interface RepositoriesViewProps {
  repositories: RepositoryInfo[];
  onSelectRepo?: (repo: RepositoryInfo) => void;
}

export function RepositoriesView({ repositories }: RepositoriesViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Configured Repositories</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Server-side repository registry. Filesystem operations and planning are strictly confined to these whitelisted paths.
        </p>
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
          <strong>Containment Enforced:</strong> The browser cannot submit arbitrary filesystem paths. Only paths configured in <code>DEVFLOW_ALLOWED_WORKING_DIRS</code> are permitted for planning sessions.
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
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

      {/* Guide to add more repos */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
        }}
      >
        <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#fff', marginBottom: '0.4rem' }}>
          Adding Additional Allowed Repositories
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          To allow DevFlow AI to inspect and plan for another local repository, update <code>DEVFLOW_ALLOWED_WORKING_DIRS</code> in your <code>.env</code> file:
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
          {`DEVFLOW_ALLOWED_WORKING_DIRS="d:\\D drive\\DevFlow; C:\\Projects\\MyOtherApp"`}
        </pre>
      </div>
    </div>
  );
}
