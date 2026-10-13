'use client';

import React from 'react';
import {
  Shield,
  CheckCircle2,
  Lock,
  Cpu,
  KeyRound,
  FileCode,
  HardDrive,
} from 'lucide-react';

interface SettingsViewProps {
  statusData: {
    antigravity?: {
      binaryPath: string;
      existsOnDisk: boolean;
    };
    linear?: {
      configured: boolean;
      authenticatedUser?: { id: string; name: string; email?: string } | null;
      error?: string | null;
    };
    repositoriesCount?: number;
    plansDirectory?: string;
  } | null;
}

export function SettingsView({ statusData }: SettingsViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Environment & Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Validated server configuration and active safety boundaries. All secrets remain strictly on the server.
        </p>
      </div>

      {/* Security Policies Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Shield size={18} color="var(--success)" />
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>Security & Containment Policies</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff', marginBottom: '0.2rem' }}>Localhost Only</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>The server binds strictly to 127.0.0.1. No external or public network exposure.</div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff', marginBottom: '0.2rem' }}>Secret Redaction</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>LINEAR_API_KEY and local env variables are scrubbed before reaching the browser or Antigravity.</div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff', marginBottom: '0.2rem' }}>No Automatic Writes</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Read-only planning only. Plan approval does NOT trigger code changes or git commits.</div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff', marginBottom: '0.2rem' }}>Repository Allowlist</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Arbitrary filesystem path submissions are rejected by the server registry.</div>
          </div>
        </div>
      </div>

      {/* Integration Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Antigravity CLI */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={18} color="var(--accent-primary)" />
              <span style={{ fontWeight: 600, color: '#fff' }}>Antigravity CLI</span>
            </div>
            <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--success-subtle)', color: 'var(--success)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
              {statusData?.antigravity?.existsOnDisk ? 'Verified' : 'Missing'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Binary Path</span>
            <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
              {statusData?.antigravity?.binaryPath || 'Not set'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Execution Mode</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
              Non-interactive (<code>--print</code> with structured JSON)
            </span>
          </div>
        </div>

        {/* Linear Integration */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <KeyRound size={18} color="var(--info)" />
              <span style={{ fontWeight: 600, color: '#fff' }}>Linear GraphQL API</span>
            </div>
            <span style={{ fontSize: '0.75rem', backgroundColor: statusData?.linear?.configured ? 'var(--success-subtle)' : 'var(--warning-subtle)', color: statusData?.linear?.configured ? 'var(--success)' : 'var(--warning)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
              {statusData?.linear?.configured ? 'Configured' : 'Missing Key'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Authenticated User</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {statusData?.linear?.authenticatedUser?.name || 'N/A'} {statusData?.linear?.authenticatedUser?.email ? `(${statusData.linear.authenticatedUser.email})` : ''}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Permissions</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
              Read-only queries (viewer & assigned issues)
            </span>
          </div>
        </div>
      </div>

      {/* Storage Information */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <HardDrive size={18} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>Local Plan Storage</h2>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Target Directory:</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {statusData?.plansDirectory || 'data/plans'}
          </span>
        </div>
      </div>
    </div>
  );
}
