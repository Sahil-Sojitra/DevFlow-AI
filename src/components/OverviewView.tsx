'use client';

import React from 'react';
import {
  Inbox,
  FileCode2,
  Clock,
  CheckCircle2,
  FolderGit2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type { LinearIssue } from '@/types/linear';
import type { SavedPlanSummary } from '@/services/plan-storage';

interface OverviewViewProps {
  tickets: LinearIssue[];
  plans: SavedPlanSummary[];
  repositoriesCount: number;
  linearUser: { name: string; email?: string } | null;
  onNavigate: (tab: 'tickets' | 'plans' | 'repositories') => void;
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
      icon: <Inbox size={20} color="var(--info)" />,
      subtitle: linearUser ? `Assigned to ${linearUser.name}` : 'Linear sync',
      onClick: () => onNavigate('tickets'),
    },
    {
      title: 'Implementation Plans',
      value: plans.length,
      icon: <FileCode2 size={20} color="var(--accent-primary)" />,
      subtitle: `${approvedCount} approved`,
      onClick: () => onNavigate('plans'),
    },
    {
      title: 'Pending Approvals',
      value: pendingCount,
      icon: <Clock size={20} color="var(--warning)" />,
      subtitle: pendingCount === 0 ? 'All reviewed' : 'Awaiting developer review',
      onClick: () => onNavigate('plans'),
    },
    {
      title: 'Allowed Repositories',
      value: repositoriesCount,
      icon: <FolderGit2 size={20} color="var(--success)" />,
      subtitle: 'Configured local targets',
      onClick: () => onNavigate('repositories'),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(59, 130, 246, 0.05))',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: '0.25rem' }}>
            Welcome back{linearUser ? `, ${linearUser.name}` : ''}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Local development automation active. Select a Linear ticket to generate a repository-aware implementation plan.
          </p>
        </div>
        <button
          onClick={() => onNavigate('tickets')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--accent-primary)',
            color: '#fff',
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '0.88rem',
            boxShadow: '0 0 14px var(--accent-glow)',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-primary)')}
        >
          <Sparkles size={16} />
          <span>Review Tickets</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {statCards.map((stat, idx) => (
          <div
            key={idx}
            onClick={stat.onClick}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {stat.title}
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {stat.icon}
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              {stat.subtitle}
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout: Assigned Tickets & Saved Plans */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Recent Tickets */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>Assigned Tickets</h2>
            <button
              onClick={() => onNavigate('tickets')}
              style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <span>View all</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {tickets.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No assigned tickets found in Linear.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {tickets.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  onClick={() => onSelectTicket(t)}
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem 1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                >
                  <div style={{ overflow: 'hidden', paddingRight: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                        {t.identifier}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          backgroundColor: 'var(--bg-elevated)',
                          padding: '0.1rem 0.45rem',
                          borderRadius: 'var(--radius-full)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {t.state?.name || 'Backlog'}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {t.title}
                    </div>
                  </div>
                  <ArrowRight size={14} color="var(--text-muted)" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Implementation Plans */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>Saved Plans</h2>
            <button
              onClick={() => onNavigate('plans')}
              style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <span>View all</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {plans.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No implementation plans generated yet. Select a ticket to create your first plan.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {plans.slice(0, 5).map((p) => {
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
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                  >
                    <div style={{ overflow: 'hidden', paddingRight: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                          {p.issueIdentifier}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.45rem',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--bg-elevated)',
                            color: statusColor,
                            fontWeight: 600,
                            textTransform: 'capitalize',
                          }}
                        >
                          {p.reviewStatus}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.title}
                      </div>
                    </div>
                    <ArrowRight size={14} color="var(--text-muted)" />
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
