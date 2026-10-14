'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  StopCircle,
  FileCode2,
  FolderGit2,
  GitBranch,
  Layers,
  Clock,
  Terminal,
  FileText,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import type {
  ExecutionSessionRecord,
  ExecutionSessionSummary,
  VerificationResult,
  ChangedFile,
} from '@/types/execution';

interface ExecutionSessionsViewProps {
  initialSessionId?: string | null;
  onNavigateToPlan?: (issueId: string) => void;
}

export function ExecutionSessionsView({
  initialSessionId,
  onNavigateToPlan,
}: ExecutionSessionsViewProps) {
  const [sessions, setSessions] = useState<ExecutionSessionSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessionId || null);
  const [sessionDetail, setSessionDetail] = useState<ExecutionSessionRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');

  // Detail Sub-Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'verification' | 'diff' | 'logs'>('overview');

  // Diff state
  const [diffText, setDiffText] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Verification results expansion
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Fetch session list
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        // Auto-select first if none selected
        if (!selectedSessionId && data.sessions && data.sessions.length > 0) {
          setSelectedSessionId(data.sessions[0].id);
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoadingList(false);
    }
  }, [selectedSessionId]);

  // Fetch single session detail
  const fetchSessionDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSessionDetail(data.session);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Fetch diff
  const fetchDiff = useCallback(async (id: string) => {
    setLoadingDiff(true);
    try {
      const res = await fetch(`/api/sessions/${id}/diff`);
      if (res.ok) {
        const data = await res.json();
        setDiffText(data.diff || 'No diff available.');
      } else {
        setDiffText('Failed to fetch diff.');
      }
    } catch (err: unknown) {
      setDiffText(`Error loading diff: ${(err as Error).message}`);
    } finally {
      setLoadingDiff(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // When selected session changes
  useEffect(() => {
    if (selectedSessionId) {
      setLoadingDetail(true);
      setDiffText(null);
      fetchSessionDetail(selectedSessionId).finally(() => setLoadingDetail(false));
    } else {
      setSessionDetail(null);
    }
  }, [selectedSessionId, fetchSessionDetail]);

  // Load diff when switching to diff tab
  useEffect(() => {
    if (activeTab === 'diff' && selectedSessionId && diffText === null) {
      fetchDiff(selectedSessionId);
    }
  }, [activeTab, selectedSessionId, diffText, fetchDiff]);

  // Polling for live session updates if running or verifying
  useEffect(() => {
    if (!sessionDetail) return;
    const isActive = ['queued', 'running', 'verifying'].includes(sessionDetail.status);
    if (!isActive) return;

    const interval = setInterval(() => {
      fetchSessionDetail(sessionDetail.id);
      fetchSessions();
    }, 2500);

    return () => clearInterval(interval);
  }, [sessionDetail, fetchSessionDetail, fetchSessions]);

  // Auto-scroll logs
  useEffect(() => {
    if (activeTab === 'logs') {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessionDetail?.logs, activeTab]);

  // Handle Cancel
  const handleCancelSession = async () => {
    if (!selectedSessionId || cancelling) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}/cancel`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchSessionDetail(selectedSessionId);
        await fetchSessions();
      }
    } catch {
      // Ignore
    } finally {
      setCancelling(false);
    }
  };

  // Filtered sessions
  const filteredSessions = sessions.filter((s) => {
    if (statusFilter === 'active' && !['queued', 'running', 'verifying'].includes(s.status)) return false;
    if (statusFilter === 'completed' && s.status !== 'completed') return false;
    if (statusFilter === 'failed' && !['failed', 'blocked', 'cancelled'].includes(s.status)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.issueIdentifier.toLowerCase().includes(q) ||
        s.issueTitle.toLowerCase().includes(q) ||
        s.repositoryPath.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'var(--success)';
      case 'running':
      case 'verifying':
        return 'var(--accent-primary)';
      case 'failed':
      case 'blocked':
        return 'var(--danger)';
      case 'cancelled':
        return 'var(--warning)';
      default:
        return 'var(--text-muted)';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'completed':
        return 'var(--success-subtle)';
      case 'running':
      case 'verifying':
        return 'rgba(56, 189, 248, 0.15)';
      case 'failed':
      case 'blocked':
        return 'var(--danger-subtle)';
      case 'cancelled':
        return 'var(--warning-subtle)';
      default:
        return 'var(--bg-tertiary)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Work Sessions & Execution</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Monitor implementation runs, inspect Git changes, and review verification results.
          </p>
        </div>

        <button
          onClick={() => {
            fetchSessions();
            if (selectedSessionId) fetchSessionDetail(selectedSessionId);
          }}
          style={{
            padding: '0.45rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Grid: Master List + Detail Pane */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: '1.5rem',
          minHeight: '620px',
        }}
      >
        {/* Left Column: Sessions List */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Search & Filter Bar */}
          <div style={{ padding: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--bg-primary)',
                padding: '0.4rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '0.65rem',
              }}
            >
              <Search size={14} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Filter by ticket or repo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>

            {/* Status Tabs */}
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {(['all', 'active', 'completed', 'failed'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  style={{
                    flex: 1,
                    padding: '0.3rem 0.4rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: statusFilter === filter ? 'var(--bg-tertiary)' : 'transparent',
                    color: statusFilter === filter ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.72rem',
                    fontWeight: statusFilter === filter ? 600 : 500,
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Session Cards */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {loadingList ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Loading sessions...
              </div>
            ) : filteredSessions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No execution sessions found.
              </div>
            ) : (
              filteredSessions.map((s) => {
                const isSelected = s.id === selectedSessionId;
                const isRunning = ['queued', 'running', 'verifying'].includes(s.status);

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSessionId(s.id)}
                    style={{
                      padding: '0.75rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--border-default)' : 'transparent'}`,
                      marginBottom: '0.35rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--accent-primary)' }}>
                        {s.issueIdentifier}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          padding: '0.12rem 0.45rem',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: getStatusBg(s.status),
                          color: getStatusColor(s.status),
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        {isRunning && <span className="animate-pulse" style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: getStatusColor(s.status) }} />}
                        {s.status}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-primary)',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: '0.35rem',
                      }}
                    >
                      {s.issueTitle}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span>{new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {s.isIsolated && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--accent-primary)' }}>
                          <Layers size={11} />
                          <span>Worktree</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Session Details */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {loadingDetail ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading session details...
            </div>
          ) : !sessionDetail ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a work session from the list to inspect execution progress and results.
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div
                style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                      {sessionDetail.issueIdentifier}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '0.15rem 0.55rem',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: getStatusBg(sessionDetail.status),
                        color: getStatusColor(sessionDetail.status),
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      {['queued', 'running', 'verifying'].includes(sessionDetail.status) && (
                        <span className="animate-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: getStatusColor(sessionDetail.status) }} />
                      )}
                      {sessionDetail.status}
                    </span>

                    {sessionDetail.isIsolated && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'rgba(56, 189, 248, 0.1)',
                          color: 'var(--accent-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <Layers size={12} />
                        <span>Worktree Isolated</span>
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                    {sessionDetail.issueTitle}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {onNavigateToPlan && (
                    <button
                      onClick={() => onNavigateToPlan(sessionDetail.issueIdentifier)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                      }}
                    >
                      <FileCode2 size={14} />
                      <span>View Plan</span>
                    </button>
                  )}

                  {['queued', 'running', 'verifying'].includes(sessionDetail.status) && (
                    <button
                      onClick={handleCancelSession}
                      disabled={cancelling}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--danger)',
                        backgroundColor: 'transparent',
                        color: 'var(--danger)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: cancelling ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <StopCircle size={14} />
                      <span>{cancelling ? 'Cancelling...' : 'Cancel Execution'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Detail Tabs */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '0 1.5rem',
                }}
              >
                {[
                  { id: 'overview', label: 'Overview & Summary' },
                  { id: 'verification', label: `Verification (${sessionDetail.verificationResults?.length || 0})` },
                  { id: 'diff', label: `Changes & Diff (${sessionDetail.changedFiles?.length || 0})` },
                  { id: 'logs', label: `Execution Logs (${sessionDetail.logs?.length || 0})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === t.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      color: activeTab === t.id ? '#fff' : 'var(--text-muted)',
                      fontSize: '0.82rem',
                      fontWeight: activeTab === t.id ? 600 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                {/* 1. Overview Tab */}
                {activeTab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Live Progress Banner */}
                    <div
                      style={{
                        padding: '1rem 1.25rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: getStatusBg(sessionDetail.status),
                        border: `1px solid ${getStatusColor(sessionDetail.status)}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                      }}
                    >
                      {sessionDetail.status === 'completed' && <CheckCircle2 size={20} color="var(--success)" />}
                      {['running', 'verifying'].includes(sessionDetail.status) && (
                        <Terminal size={20} color="var(--accent-primary)" className="animate-pulse" />
                      )}
                      {sessionDetail.status === 'failed' && <XCircle size={20} color="var(--danger)" />}
                      {sessionDetail.status === 'cancelled' && <StopCircle size={20} color="var(--warning)" />}
                      {sessionDetail.status === 'blocked' && <AlertTriangle size={20} color="var(--danger)" />}

                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>
                          {sessionDetail.progressMessage || 'Execution status updated.'}
                        </div>
                        {sessionDetail.summary && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            {sessionDetail.summary}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Live Implementation Activity Card while Running */}
                    {['running', 'verifying'].includes(sessionDetail.status) && (
                      <div
                        style={{
                          padding: '1rem 1.25rem',
                          backgroundColor: 'rgba(59, 130, 246, 0.08)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--accent-primary)',
                                boxShadow: '0 0 8px var(--accent-primary)',
                              }}
                            />
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                              Antigravity Execution In Progress
                            </span>
                          </div>
                          <button
                            onClick={() => setActiveTab('logs')}
                            style={{
                              fontSize: '0.76rem',
                              color: 'var(--accent-primary)',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 600,
                              textDecoration: 'underline',
                            }}
                          >
                            View Live Logs ({sessionDetail.logs?.length || 0}) →
                          </button>
                        </div>
                        <div
                          style={{
                            padding: '0.6rem 0.85rem',
                            backgroundColor: 'var(--bg-primary)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.78rem',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <Terminal size={14} color="var(--accent-primary)" />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sessionDetail.logs && sessionDetail.logs.length > 0
                              ? sessionDetail.logs[sessionDetail.logs.length - 1].message
                              : sessionDetail.progressMessage}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Metadata Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Repository & Branch</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          {sessionDetail.branch}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', wordBreak: 'break-all' }}>
                          {sessionDetail.repositoryPath}
                        </div>
                      </div>

                      <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Execution Directory</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                          {sessionDetail.workingPath}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: sessionDetail.isIsolated ? 'var(--accent-primary)' : 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {sessionDetail.isIsolated ? 'Isolated Git Worktree' : 'Main Repository Directory'}
                        </div>
                      </div>

                      <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Timings & Baseline</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Started: {sessionDetail.startedAt ? new Date(sessionDetail.startedAt).toLocaleTimeString() : 'N/A'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Ended: {sessionDetail.endedAt ? new Date(sessionDetail.endedAt).toLocaleTimeString() : 'In progress'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Baseline commit: {sessionDetail.baselineCommit?.slice(0, 8) || 'HEAD'}
                        </div>
                      </div>
                    </div>

                    {/* Worktree Isolation Notice */}
                    {sessionDetail.isIsolated && (
                      <div
                        style={{
                          padding: '0.85rem 1rem',
                          backgroundColor: 'var(--bg-primary)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#fff', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Layers size={14} color="var(--accent-primary)" />
                          <span>Isolation Notice: Changes Reside in Worktree</span>
                        </div>
                        <div>
                          All code modifications were created inside the isolated worktree directory:
                          <br />
                          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                            {sessionDetail.workingPath}
                          </code>
                        </div>
                        <div style={{ marginTop: '0.4rem' }}>
                          Your main working tree was <strong>never modified</strong>. When you are ready to apply these changes, you can inspect the diff below and merge or cherry-pick into your main branch.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Verification Tab */}
                {activeTab === 'verification' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Automated project checks detected and executed in repository:
                    </div>

                    {sessionDetail.verificationResults?.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No verification checks have run yet.
                      </div>
                    ) : (
                      sessionDetail.verificationResults.map((check) => {
                        const isExpanded = expandedCheck === check.name;
                        const isPassed = check.status === 'passed';
                        const isFailed = check.status === 'failed';
                        const isNotConfig = check.status === 'not_configured';

                        return (
                          <div
                            key={check.name}
                            style={{
                              backgroundColor: 'var(--bg-primary)',
                              border: `1px solid ${isFailed ? 'var(--danger)' : isPassed ? 'rgba(34, 197, 94, 0.3)' : 'var(--border-subtle)'}`,
                              borderRadius: 'var(--radius-sm)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              onClick={() => setExpandedCheck(isExpanded ? null : check.name)}
                              style={{
                                padding: '0.75rem 1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                backgroundColor: isExpanded ? 'var(--bg-tertiary)' : 'transparent',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                {isPassed && <CheckCircle2 size={16} color="var(--success)" />}
                                {isFailed && <XCircle size={16} color="var(--danger)" />}
                                {isNotConfig && <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--border-subtle)', display: 'inline-block' }} />}

                                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff', textTransform: 'capitalize' }}>
                                  {check.name}
                                </span>

                                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                  {check.command}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {check.durationMs > 0 && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {check.durationMs}ms
                                  </span>
                                )}

                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    padding: '0.12rem 0.45rem',
                                    borderRadius: 'var(--radius-full)',
                                    backgroundColor: isPassed ? 'var(--success-subtle)' : isFailed ? 'var(--danger-subtle)' : 'var(--bg-tertiary)',
                                    color: isPassed ? 'var(--success)' : isFailed ? 'var(--danger)' : 'var(--text-muted)',
                                  }}
                                >
                                  {check.status.replace('_', ' ')}
                                </span>

                                {isExpanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                              </div>
                            </div>

                            {/* Output Box */}
                            {isExpanded && (
                              <div
                                style={{
                                  padding: '0.85rem 1rem',
                                  backgroundColor: '#0a0d13',
                                  borderTop: '1px solid var(--border-subtle)',
                                }}
                              >
                                <pre
                                  style={{
                                    margin: 0,
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.78rem',
                                    color: isFailed ? '#fca5a5' : '#e2e8f0',
                                    whiteSpace: 'pre-wrap',
                                    maxHeight: '260px',
                                    overflowY: 'auto',
                                  }}
                                >
                                  {check.output || 'No output recorded.'}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 3. Changes & Diff Tab */}
                {activeTab === 'diff' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Changed Files List */}
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>
                      Changed Files Relative to Baseline ({sessionDetail.changedFiles?.length || 0})
                    </div>

                    {sessionDetail.changedFiles?.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        No file changes recorded yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {sessionDetail.changedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '0.5rem 0.75rem',
                              backgroundColor: 'var(--bg-primary)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.8rem',
                            }}
                          >
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                              {file.path}
                            </span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {file.isPreExisting ? (
                                <span style={{ fontSize: '0.68rem', color: 'var(--warning)', backgroundColor: 'var(--warning-subtle)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)' }}>
                                  Pre-existing
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.68rem', color: 'var(--accent-primary)', backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)' }}>
                                  New in Session
                                </span>
                              )}

                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  color: file.status === 'added' ? 'var(--success)' : file.status === 'deleted' ? 'var(--danger)' : 'var(--accent-primary)',
                                }}
                              >
                                {file.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Unified Diff Box */}
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>Unified Git Diff</span>
                        <button
                          onClick={() => fetchDiff(sessionDetail.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Refresh Diff
                        </button>
                      </div>

                      <div
                        style={{
                          backgroundColor: '#0a0d13',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '1rem',
                          maxHeight: '400px',
                          overflowY: 'auto',
                        }}
                      >
                        {loadingDiff ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading diff...</div>
                        ) : (
                          <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                            {(diffText || 'No changes detected.').split('\n').map((line, idx) => {
                              let color = '#e2e8f0';
                              let bg = 'transparent';
                              if (line.startsWith('+') && !line.startsWith('+++')) {
                                color = '#86efac';
                                bg = 'rgba(34, 197, 94, 0.1)';
                              } else if (line.startsWith('-') && !line.startsWith('---')) {
                                color = '#fca5a5';
                                bg = 'rgba(239, 68, 68, 0.1)';
                              } else if (line.startsWith('@@')) {
                                color = '#93c5fd';
                              } else if (line.startsWith('diff --git')) {
                                color = '#fef08a';
                              }

                              return (
                                <div key={idx} style={{ color, backgroundColor: bg, padding: '0 0.25rem' }}>
                                  {line || ' '}
                                </div>
                              );
                            })}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Logs Tab */}
                {activeTab === 'logs' && (
                  <div
                    style={{
                      backgroundColor: '#0a0d13',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '1rem',
                      maxHeight: '480px',
                      overflowY: 'auto',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                    }}
                  >
                    {sessionDetail.logs?.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)' }}>No logs recorded yet.</div>
                    ) : (
                      sessionDetail.logs.map((log, idx) => {
                        let color = '#e2e8f0';
                        if (log.level === 'error') color = '#fca5a5';
                        if (log.level === 'warn') color = '#fef08a';
                        if (log.level === 'info') color = '#93c5fd';

                        return (
                          <div key={idx} style={{ marginBottom: '0.35rem', lineHeight: 1.45 }}>
                            <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>
                              [{new Date(log.timestamp).toLocaleTimeString()}]
                            </span>
                            <span style={{ color, fontWeight: log.level === 'error' ? 700 : 400 }}>
                              {log.message}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
