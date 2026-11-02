'use client';

import React from 'react';
import {
  LayoutDashboard,
  Inbox,
  FileCode2,
  FolderGit2,
  Settings,
  Terminal,
  PlayCircle,
  X,
} from 'lucide-react';

export type NavTab = 'overview' | 'tickets' | 'plans' | 'sessions' | 'repositories' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  ticketCount: number;
  planCount: number;
  pendingApprovalsCount: number;
  activeSessionsCount?: number;
  linearConnected: boolean;
  antigravityReady: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  currentTab,
  onTabChange,
  ticketCount,
  planCount,
  pendingApprovalsCount,
  activeSessionsCount = 0,
  linearConnected,
  antigravityReady,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number | string; badgeColor?: string }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard size={16} strokeWidth={2} />,
    },
    {
      id: 'tickets',
      label: 'Ticket Inbox',
      icon: <Inbox size={16} strokeWidth={2} />,
      badge: ticketCount > 0 ? ticketCount : undefined,
    },
    {
      id: 'plans',
      label: 'Plan Review',
      icon: <FileCode2 size={16} strokeWidth={2} />,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount} review` : planCount > 0 ? planCount : undefined,
      badgeColor: pendingApprovalsCount > 0 ? 'var(--warning)' : undefined,
    },
    {
      id: 'sessions',
      label: 'Work Sessions',
      icon: <PlayCircle size={16} strokeWidth={2} />,
      badge: activeSessionsCount > 0 ? `${activeSessionsCount} active` : undefined,
      badgeColor: activeSessionsCount > 0 ? 'var(--accent-primary)' : undefined,
    },
    {
      id: 'repositories',
      label: 'Repositories',
      icon: <FolderGit2 size={16} strokeWidth={2} />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={16} strokeWidth={2} />,
    },
  ];

  const handleSelectTab = (id: NavTab) => {
    onTabChange(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
            }}
          >
            <Terminal size={15} strokeWidth={2.5} />
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                fontSize: '0.88rem',
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              DevFlow<span style={{ color: 'var(--accent-primary)' }}>.ai</span>
            </div>
            <div
              style={{
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                letterSpacing: '0.02em',
              }}
            >
              v0.1.0 · LOCAL
            </div>
          </div>
        </div>

        {/* Mobile Close Button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden"
            style={{
              padding: '0.35rem',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav List */}
      <nav
        style={{
          padding: '0.75rem 0.5rem',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.15rem',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            padding: '0.35rem 0.65rem',
            fontSize: '0.65rem',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-dim)',
          }}
        >
          Navigation
        </div>

        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                width: '100%',
                padding: '0.55rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 500 : 400,
                fontSize: '0.82rem',
                transition: 'background-color 0.1s ease, color 0.1s ease',
                border: isActive ? '1px solid var(--border-default)' : '1px solid transparent',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)');
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget.style.backgroundColor = 'transparent');
              }}
            >
              <span
                style={{
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge !== undefined && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontFamily: 'var(--font-mono)',
                    padding: '0.1rem 0.4rem',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: item.badgeColor
                      ? 'rgba(0, 0, 0, 0.3)'
                      : isActive
                      ? 'var(--bg-elevated)'
                      : 'var(--bg-tertiary)',
                    border: `1px solid ${item.badgeColor || 'var(--border-subtle)'}`,
                    color: item.badgeColor || (isActive ? 'var(--text-primary)' : 'var(--text-muted)'),
                    fontWeight: 500,
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status Telemetry Footer */}
      <div
        style={{
          padding: '0.85rem 1rem',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-primary)',
          fontSize: '0.72rem',
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>CLI Engine</span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: antigravityReady ? 'var(--success)' : 'var(--danger)',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: antigravityReady ? 'var(--success)' : 'var(--danger)',
                boxShadow: antigravityReady ? '0 0 6px var(--success-subtle)' : 'none',
              }}
            />
            {antigravityReady ? 'agy ready' : 'offline'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Linear Sync</span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: linearConnected ? 'var(--success)' : 'var(--warning)',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: linearConnected ? 'var(--success)' : 'var(--warning)',
              }}
            />
            {linearConnected ? 'synced' : 'no key'}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (Hidden on small screens) */}
      <aside
        className="mobile-hide"
        style={{
          width: '240px',
          height: '100vh',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer Overlay */}
      {isMobileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={onCloseMobile}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(3px)',
            }}
          />

          {/* Drawer Pane */}
          <div
            style={{
              position: 'relative',
              width: '82%',
              maxWidth: '300px',
              height: '100%',
              zIndex: 101,
              boxShadow: 'var(--shadow-lg)',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
