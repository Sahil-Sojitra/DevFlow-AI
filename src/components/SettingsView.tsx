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
  GitBranch,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          Environment & Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
          Validated server configuration and active safety boundaries. All secrets remain strictly on the local machine.
        </p>
      </div>

      {/* Security Policies Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
          <Shield size={16} color="var(--success)" />
          <h2 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>Security & Containment Policies</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
          <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.75rem 0.85rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '0.2rem', fontFamily: 'var(--font-mono)' }}>
              LOCAL-FIRST RUNTIME
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Next.js server binds strictly to 127.0.0.1:4000. No external or public port forwarding.
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.75rem 0.85rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '0.2rem', fontFamily: 'var(--font-mono)' }}>
              SECRET REDACTION
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              API keys and local env secrets are scrubbed before reaching the browser or Antigravity prompts.
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.75rem 0.85rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '0.2rem', fontFamily: 'var(--font-mono)' }}>
              HUMAN-AUTHORIZED ACTIONS
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Execution runs, remote branch pushes, and merges require explicit human confirmation.
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.75rem 0.85rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '0.2rem', fontFamily: 'var(--font-mono)' }}>
              PATH CONTAINMENT
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Operations are strictly verified against DEVFLOW_ALLOWED_WORKING_DIRS. Path traversal is blocked.
            </div>
          </div>
        </div>
      </div>

      {/* Integration Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
        {/* Antigravity CLI */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Cpu size={16} color="var(--accent-primary)" />
              <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Antigravity CLI</span>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                backgroundColor: statusData?.antigravity?.existsOnDisk ? 'var(--success-subtle)' : 'var(--danger-subtle)',
                border: `1px solid ${statusData?.antigravity?.existsOnDisk ? 'var(--success-border)' : 'var(--danger-border)'}`,
                color: statusData?.antigravity?.existsOnDisk ? 'var(--success)' : 'var(--danger)',
                padding: '0.1rem 0.45rem',
                borderRadius: 'var(--radius-xs)',
                fontWeight: 500,
              }}
            >
              {statusData?.antigravity?.existsOnDisk ? 'Verified' : 'Missing'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontFamily: 'var(--font-mono)' }}>
              BINARY PATH
            </span>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
              {statusData?.antigravity?.binaryPath || 'Not set'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontFamily: 'var(--font-mono)' }}>
              EXECUTION MODE
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              Non-interactive (--print json output)
            </span>
          </div>
        </div>

        {/* Linear Integration */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <KeyRound size={16} color="var(--info)" />
              <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Linear GraphQL API</span>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                backgroundColor: statusData?.linear?.configured ? 'var(--success-subtle)' : 'var(--warning-subtle)',
                border: `1px solid ${statusData?.linear?.configured ? 'var(--success-border)' : 'var(--warning-border)'}`,
                color: statusData?.linear?.configured ? 'var(--success)' : 'var(--warning)',
                padding: '0.1rem 0.45rem',
                borderRadius: 'var(--radius-xs)',
                fontWeight: 500,
              }}
            >
              {statusData?.linear?.configured ? 'Connected' : 'Missing Key'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontFamily: 'var(--font-mono)' }}>
              AUTHENTICATED VIEWER
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              {statusData?.linear?.authenticatedUser?.name || 'N/A'} {statusData?.linear?.authenticatedUser?.email ? `(${statusData.linear.authenticatedUser.email})` : ''}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontFamily: 'var(--font-mono)' }}>
              TWO-WAY CAPABILITIES
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              Issue queries · Workflow state sync · Run log comments
            </span>
          </div>
        </div>
      </div>

      {/* Storage Information */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.65rem' }}>
          <HardDrive size={15} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>Local Plan & Session Storage</h2>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', flexWrap: 'wrap', gap: '0.45rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Target Directory:</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {statusData?.plansDirectory || 'data/plans'}
          </span>
        </div>
      </div>
    </div>
  );
}
