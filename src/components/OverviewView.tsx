'use client';

import React from 'react';
import {
  Inbox,
  FileCode2,
  Clock,
  FolderGit2,
  ArrowRight,
  Terminal,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Cpu,
} from 'lucide-react';
import type { LinearIssue } from '@/types/linear';
import type { SavedPlanSummary } from '@/services/plan-storage';

interface OverviewViewProps {
  tickets: LinearIssue[];
  plans: SavedPlanSummary[];
  repositoriesCount: number;
  linearUser: { name: string; email?: string } | null;
  onNavigate: (tab: 'tickets' | 'plans' | 'repositories' | 'sessions') => void;
  onSelectTicket: (ticket: LinearIssue) => void;
  onSelectPlan: (plan: SavedPlanSummary) => void;
}

export function OverviewView({
  tickets,
  plans,
  repositoriesCount,
  linearUser,
  onNavigate,
  onSelectTicket,
  onSelectPlan,
}: OverviewViewProps) {
  const pendingCount = plans.filter((p) => p.reviewStatus === 'pending').length;
  const approvedCount = plans.filter((p) => p.reviewStatus === 'approved').length;

  const statCards = [
    {
      title: 'Assigned Tickets',
      value: tickets.length,
      icon: <Inbox size={16} strokeWidth={2} />,
      accentColor: 'var(--accent-primary)',
      subtitle: linearUser ? `@${linearUser.name}` : 'Linear synced',
      onClick: () => onNavigate('tickets'),
    },
    {
      title: 'Implementation Plans',
      value: plans.length,
      icon: <FileCode2 size={16} strokeWidth={2} />,
      accentColor: 'var(--text-primary)',
      subtitle: `${approvedCount} approved`,
      onClick: () => onNavigate('plans'),
    },
    {
      title: 'Pending Reviews',
      value: pendingCount,
      icon: <Clock size={16} strokeWidth={2} />,
      accentColor: pendingCount > 0 ? 'var(--warning)' : 'var(--text-muted)',
      subtitle: pendingCount === 0 ? 'Zero pending' : 'Requires approval',
      onClick: () => onNavigate('plans'),
    },
    {
      title: 'Target Repositories',
      value: repositoriesCount,
      icon: <FolderGit2 size={16} strokeWidth={2} />,
      accentColor: 'var(--success)',
      subtitle: 'Configured local targets',
      onClick: () => onNavigate('repositories'),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Developer Command Banner (Clean, Minimalist, High-Precision) */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div style={{ minWidth: '240px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: 'var(--accent-primary)',
                backgroundColor: 'var(--accent-subtle)',
                border: '1px solid var(--accent-border)',
                padding: '0.1rem 0.45rem',
                borderRadius: 'var(--radius-xs)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <Cpu size={11} /> DEVFLOW RUNTIME
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              127.0.0.1:4000
            </span>
          </div>

          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: '0.2rem 0',
            }}
          >
            Engineering Command Center
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: '640px' }}>
            Local-first automation active. Select any assigned ticket to generate a repository-aware plan or run controlled verification.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigate('tickets')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 500,
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
          >
            <Inbox size={14} />
            <span>Ticket Inbox</span>
            <span className="kbd">T</span>
          </button>

          <button
            onClick={() => onNavigate('plans')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-primary)',
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <Terminal size={14} />
            <span>Review Plans</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Metrics Grid (Responsive, Auto-Fit) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.85rem',
        }}
      >
        {statCards.map((stat, idx) => (
          <div
            key={idx}
            onClick={stat.onClick}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {stat.title}
              </span>
              <div
                style={{
                  color: stat.accentColor,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {stat.icon}
              </div>
            </div>

            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
              }}
            >
              {stat.value}
            </div>

            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                marginTop: '0.35rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {stat.subtitle}
            </div>
          </div>
        ))}
      </div>

      {/* Responsive Two-Column Grid: Stacks gracefully on Mobile */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Recent Tickets Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Inbox size={15} color="var(--accent-primary)" />
              <h2 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Assigned Tickets
              </h2>
            </div>
            <button
              onClick={() => onNavigate('tickets')}
              style={{
                fontSize: '0.75rem',
                color: 'var(--accent-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span>View all</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {tickets.length === 0 ? (
            <div
              style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                border: '1px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              No assigned tickets found in Linear.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {tickets.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  onClick={() => onSelectTicket(t)}
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '0.65rem 0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                >
                  <div style={{ overflow: 'hidden', paddingRight: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: 'var(--accent-primary)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {t.identifier}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          backgroundColor: 'var(--bg-elevated)',
                          padding: '0.08rem 0.4rem',
                          borderRadius: 'var(--radius-xs)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {t.state?.name || 'Backlog'}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 400,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {t.title}
                    </div>
                  </div>
                  <ArrowRight size={13} color="var(--text-dim)" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Saved Plans Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <FileCode2 size={15} color="var(--text-secondary)" />
              <h2 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Saved Plans
              </h2>
            </div>
            <button
              onClick={() => onNavigate('plans')}
              style={{
                fontSize: '0.75rem',
                color: 'var(--accent-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span>View all</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {plans.length === 0 ? (
            <div
              style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                border: '1px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              No implementation plans generated yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {plans.slice(0, 5).map((p) => {
                const statusBorder =
                  p.reviewStatus === 'approved'
                    ? 'var(--success-border)'
                    : p.reviewStatus === 'rejected'
                    ? 'var(--danger-border)'
                    : 'var(--warning-border)';
                const statusColor =
                  p.reviewStatus === 'approved'
                    ? 'var(--success)'
                    : p.reviewStatus === 'rejected'
                    ? 'var(--danger)'
                    : 'var(--warning)';

                return (
                  <div
                    key={p.issueIdentifier}
                    onClick={() => onSelectPlan(p)}
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-xs)',
                      padding: '0.65rem 0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'border-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                  >
                    <div style={{ overflow: 'hidden', paddingRight: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: 'var(--accent-primary)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {p.issueIdentifier}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontFamily: 'var(--font-mono)',
                            padding: '0.08rem 0.4rem',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                            border: `1px solid ${statusBorder}`,
                            color: statusColor,
                            textTransform: 'capitalize',
                          }}
                        >
                          {p.reviewStatus}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 400,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.title}
                      </div>
                    </div>
                    <ArrowRight size={13} color="var(--text-dim)" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
