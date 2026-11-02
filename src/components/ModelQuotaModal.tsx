'use client';

import React from 'react';
import {
  X,
  Cpu,
  Zap,
  Calendar,
  Layers,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  ExternalLink,
} from 'lucide-react';
import type { ModelQuotaStatus } from '@/types/execution';

interface ModelQuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  quota: ModelQuotaStatus | null;
  onRefresh?: () => void;
}

export function ModelQuotaModal({
  isOpen,
  onClose,
  quota,
  onRefresh,
}: ModelQuotaModalProps) {
  if (!isOpen || !quota) return null;

  const sessionPercent = Math.min(100, quota.sessionPercentUsed);
  const weeklyPercent = Math.min(100, quota.weeklyPercentUsed);

  const getSessionBarColor = (pct: number) => {
    if (pct >= 90) return 'var(--danger-primary)';
    if (pct >= 70) return 'var(--warning-primary)';
    return 'var(--success-primary)';
  };

  const getWeeklyBarColor = (pct: number) => {
    if (pct >= 90) return 'var(--danger-primary)';
    if (pct >= 70) return 'var(--warning-primary)';
    return 'var(--accent-primary)';
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
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
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-subtle)',
                border: '1px solid var(--accent-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <Cpu size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Model Limits & Token Telemetry
                </h2>
                <span
                  className="mono-chip"
                  style={{
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    borderColor: 'rgba(56, 189, 248, 0.3)',
                    color: 'var(--accent-primary)',
                    fontSize: '0.72rem',
                    padding: '0.15rem 0.5rem',
                  }}
                >
                  LIVE TRACKING
                </span>
              </div>
              <p
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.2rem',
                }}
              >
                Track Antigravity token limits, per-session budget, and weekly usage across all ticket runs.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              >
                Refresh
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: '0.35rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {/* Top 3 Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: '1rem',
            }}
          >
            {/* Card 1: Active Model */}
            <div
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Active Model
                  </span>
                  <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <div
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {quota.modelDisplayName}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.2rem',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {quota.modelName}
                </div>
              </div>

              <div
                style={{
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Context Window:</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {(quota.contextWindow / 1000).toLocaleString()}k tokens
                </span>
              </div>
            </div>

            {/* Card 2: Session Token Limit */}
            <div
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Session Budget
                  </span>
                  <Zap size={14} style={{ color: getSessionBarColor(sessionPercent) }} />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.4rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '1.3rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {quota.currentSessionTokens.toLocaleString()}
                  </span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    / {quota.sessionLimitTokens.toLocaleString()} tokens
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    marginBottom: '0.35rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>Consumption</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: getSessionBarColor(sessionPercent),
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {sessionPercent}%
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${sessionPercent}%`,
                      backgroundColor: getSessionBarColor(sessionPercent),
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Weekly Token Limit */}
            <div
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Weekly Quota (7-Day)
                  </span>
                  <Calendar size={14} style={{ color: getWeeklyBarColor(weeklyPercent) }} />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.4rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '1.3rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {(quota.weeklyUsedTokens / 1000).toFixed(1)}k
                  </span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    / {(quota.weeklyLimitTokens / 1000000).toFixed(1)}M tokens
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    marginBottom: '0.35rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>
                    Resets in <strong>{quota.daysUntilWeeklyReset}d</strong> ({quota.weeklyResetDay})
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: getWeeklyBarColor(weeklyPercent),
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {weeklyPercent}%
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${weeklyPercent}%`,
                      backgroundColor: getWeeklyBarColor(weeklyPercent),
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Active Session Detailed Breakdown */}
          {quota.ticketUsage && (
            <div
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Target Execution Breakdown
                  </span>
                  <span
                    className="mono-chip"
                    style={{
                      color: 'var(--accent-primary)',
                      borderColor: 'var(--accent-border)',
                      fontSize: '0.72rem',
                    }}
                  >
                    {quota.ticketUsage.issueIdentifier}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {quota.ticketUsage.issueTitle}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.65rem',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    Input Tokens
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {quota.ticketUsage.inputTokens.toLocaleString()}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    Output Tokens
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {quota.ticketUsage.outputTokens.toLocaleString()}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    Thinking Tokens
                  </div>
                  <div
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    {quota.ticketUsage.thinkingTokens.toLocaleString()}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    Total Consumed
                  </div>
                  <div
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {quota.ticketUsage.totalTokens.toLocaleString()}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    Run Duration
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {quota.ticketUsage.durationSeconds}s
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ticket Usage History Table */}
          <div
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Ticket Execution Token History
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {quota.totalSessionsThisWeek} session(s) this week
              </span>
            </div>

            {quota.recentTicketsUsage.length === 0 ? (
              <div
                style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.82rem',
                }}
              >
                No execution sessions recorded yet. Run a ticket to record token telemetry.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.78rem',
                    textAlign: 'left',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 600 }}>Ticket</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 600 }}>Title</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 600, textAlign: 'right' }}>Tokens</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 600, textAlign: 'right' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quota.recentTicketsUsage.map((item, idx) => (
                      <tr
                        key={`${item.issueIdentifier}-${idx}`}
                        style={{
                          borderBottom:
                            idx < quota.recentTicketsUsage.length - 1
                              ? '1px solid var(--border-subtle)'
                              : 'none',
                        }}
                      >
                        <td style={{ padding: '0.5rem 0.6rem' }}>
                          <span
                            className="mono-chip"
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.1rem 0.35rem',
                            }}
                          >
                            {item.issueIdentifier}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '0.5rem 0.6rem',
                            maxWidth: '220px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {item.issueTitle}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.1rem 0.4rem',
                              borderRadius: 'var(--radius-xs)',
                              backgroundColor:
                                item.status === 'completed'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : item.status === 'failed'
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : 'rgba(56, 189, 248, 0.15)',
                              color:
                                item.status === 'completed'
                                  ? 'var(--success-primary)'
                                  : item.status === 'failed'
                                  ? 'var(--danger-primary)'
                                  : 'var(--accent-primary)',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 500,
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '0.5rem 0.6rem',
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            color: item.tokens > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                          }}
                        >
                          {item.tokens > 0 ? item.tokens.toLocaleString() : '—'}
                        </td>
                        <td
                          style={{
                            padding: '0.5rem 0.6rem',
                            textAlign: 'right',
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {item.durationSeconds > 0 ? `${item.durationSeconds}s` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Config & Developer Tips Banner */}
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(56, 189, 248, 0.05)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
            }}
          >
            <Info size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Configuring Token Budgets:</strong> You can tune
              limits via environment variables in your local <code className="mono-chip">.env</code>:
              <span style={{ display: 'block', marginTop: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                DEVFLOW_SESSION_TOKEN_LIMIT=150000 &nbsp;•&nbsp; DEVFLOW_WEEKLY_TOKEN_LIMIT=2000000 &nbsp;•&nbsp; DEVFLOW_MODEL=gemini-3.8-flash-high
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Telemetry calculated locally from stored execution session traces.
          </div>
          <button onClick={onClose} className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
