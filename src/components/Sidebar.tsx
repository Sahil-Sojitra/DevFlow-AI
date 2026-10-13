'use client';

import React from 'react';
import {
  LayoutDashboard,
  Inbox,
  FileCode2,
  FolderGit2,
  Settings,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export type NavTab = 'overview' | 'tickets' | 'plans' | 'repositories' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  ticketCount: number;
  planCount: number;
  pendingApprovalsCount: number;
  linearConnected: boolean;
  antigravityReady: boolean;
}

export function Sidebar({
  currentTab,
  onTabChange,
  ticketCount,
  planCount,
  pendingApprovalsCount,
  linearConnected,
  antigravityReady,
}: SidebarProps) {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number | string }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard size={18} />,
    },
    {
      id: 'tickets',
      label: 'My Tickets',
      icon: <Inbox size={18} />,
      badge: ticketCount > 0 ? ticketCount : undefined,
    },
    {
      id: 'plans',
      label: 'Plan Review',
      icon: <FileCode2 size={18} />,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount} pending` : planCount > 0 ? planCount : undefined,
    },
    {
      id: 'repositories',
      label: 'Repositories',
      icon: <FolderGit2 size={18} />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={18} />,
    },
  ];

  return (
    <aside
      style={{
        width: '260px',
        height: '100vh',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px var(--accent-glow)',
          }}
        >
          <Sparkles size={20} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em', color: '#fff' }}>
            DevFlow AI
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Local Developer Automation
          </div>
        </div>
      </div>

      {/* Nav List */}
      <nav style={{ padding: '1rem 0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.88rem',
                transition: 'all 0.15s ease',
                border: isActive ? '1px solid var(--border-subtle)' : '1px solid transparent',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)');
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget.style.backgroundColor = 'transparent');
              }}
            >
              <span style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge !== undefined && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isActive ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Status Bar */}
      <div
        style={{
          padding: '1rem',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-primary)',
          fontSize: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Antigravity CLI</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: antigravityReady ? 'var(--success)' : 'var(--danger)' }}>
            {antigravityReady ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {antigravityReady ? 'Ready' : 'Not found'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Linear API</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: linearConnected ? 'var(--success)' : 'var(--warning)' }}>
            {linearConnected ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {linearConnected ? 'Connected' : 'No Key'}
          </span>
        </div>
      </div>
    </aside>
  );
}
