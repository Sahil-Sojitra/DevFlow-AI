'use client';

import React from 'react';
import {
  Cpu,
  Zap,
  Calendar,
  Activity,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import type { ModelQuotaStatus } from '@/types/execution';

interface ModelQuotaBarProps {
  quota: ModelQuotaStatus | null;
  onOpenDetails: () => void;
  onRefresh?: () => void;
}

export function ModelQuotaBar({
  quota,
  onOpenDetails,
}: ModelQuotaBarProps) {
  if (!quota) return null;

  const sessionPercent = Math.min(100, quota.sessionPercentUsed);
  const weeklyPercent = Math.min(100, quota.weeklyPercentUsed);

  const getSessionColor = (pct: number) => {
    if (pct >= 90) return 'var(--danger-primary)';
    if (pct >= 70) return 'var(--warning-primary)';
    return 'var(--success-primary)';
  };

  const getWeeklyColor = (pct: number) => {
    if (pct >= 90) return 'var(--danger-primary)';
    if (pct >= 70) return 'var(--warning-primary)';
    return 'var(--accent-primary)';
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(1)}M`;
    }
    if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}k`;
    }
    return `${tokens}`;
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0.45rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexShrink: 0,
        zIndex: 10,
      }}
      className="devflow-quota-bar"
    >
      {/* Left: Model Name & Context Window Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          minWidth: 0,
        }}
      >
        <button
          onClick={onOpenDetails}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.2rem 0.5rem',
            borderRadius: 'var(--radius-xs)',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          title="Click to view full token telemetry & quota breakdown"
        >
          <Sparkles size={12} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{quota.modelDisplayName}</span>
          <span
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.68rem',
              paddingLeft: '0.2rem',
              borderLeft: '1px solid var(--border-subtle)',
            }}
            className="hidden sm:inline"
          >
            {(quota.contextWindow / 1000).toLocaleString()}k ctx
          </span>
        </button>

        {quota.ticketUsage && quota.activeSessionsCount > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-primary)',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              padding: '0.15rem 0.45rem',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              whiteSpace: 'nowrap',
            }}
            className="hidden lg:flex"
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary)',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
            <span>Executing: {quota.ticketUsage.issueIdentifier}</span>
          </div>
        )}
      </div>

      {/* Center / Right: Progress Gauges (Desktop & Tablet) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexShrink: 0,
        }}
        className="hidden md:flex"
      >
        {/* Session Token Limit Gauge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.73rem',
            fontFamily: 'var(--font-mono)',
          }}
          title={`Session Token Usage: ${quota.currentSessionTokens.toLocaleString()} / ${quota.sessionLimitTokens.toLocaleString()} tokens (${sessionPercent}%)`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
            <Zap size={12} style={{ color: getSessionColor(sessionPercent) }} />
            <span>Session:</span>
          </div>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {formatTokens(quota.currentSessionTokens)} / {formatTokens(quota.sessionLimitTokens)}
          </span>
          <div
            style={{
              width: '64px',
              height: '5px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${sessionPercent}%`,
                height: '100%',
                backgroundColor: getSessionColor(sessionPercent),
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span style={{ color: getSessionColor(sessionPercent), fontWeight: 600 }}>
            {sessionPercent}%
          </span>
        </div>

        <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-subtle)' }} />

        {/* Weekly Token Limit Gauge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.73rem',
            fontFamily: 'var(--font-mono)',
          }}
          title={`Weekly Token Usage: ${quota.weeklyUsedTokens.toLocaleString()} / ${quota.weeklyLimitTokens.toLocaleString()} tokens (${weeklyPercent}%). Resets in ${quota.daysUntilWeeklyReset} day(s).`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
            <Calendar size={12} style={{ color: getWeeklyColor(weeklyPercent) }} />
            <span>Weekly:</span>
          </div>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {formatTokens(quota.weeklyUsedTokens)} / {formatTokens(quota.weeklyLimitTokens)}
          </span>
          <div
            style={{
              width: '64px',
              height: '5px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${weeklyPercent}%`,
                height: '100%',
                backgroundColor: getWeeklyColor(weeklyPercent),
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span style={{ color: getWeeklyColor(weeklyPercent), fontWeight: 600 }}>
            {weeklyPercent}%
          </span>
        </div>
      </div>

      {/* Mobile Compact Telemetry summary */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.7rem',
          fontFamily: 'var(--font-mono)',
        }}
        className="md:hidden"
      >
        <span style={{ color: getSessionColor(sessionPercent) }}>
          S: {sessionPercent}%
        </span>
        <span style={{ color: 'var(--text-muted)' }}>•</span>
        <span style={{ color: getWeeklyColor(weeklyPercent) }}>
          W: {weeklyPercent}%
        </span>
      </div>

      {/* Right: Telemetry Details Button */}
      <button
        onClick={onOpenDetails}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.25rem 0.5rem',
          borderRadius: 'var(--radius-xs)',
          backgroundColor: 'transparent',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
          fontSize: '0.72rem',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        className="hover:border-border-default hover:text-text-primary"
      >
        <Activity size={12} />
        <span className="hidden sm:inline">Telemetry</span>
        <ChevronRight size={12} />
      </button>
    </div>
  );
}
