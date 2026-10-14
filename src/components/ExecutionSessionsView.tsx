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
  Check,
  Sparkles,
  Edit3,
  ArrowLeft,
  Loader2,
  X,
  Zap,
  Lightbulb,
} from 'lucide-react';
import type {
  ExecutionSessionRecord,
  ExecutionSessionSummary,
  VerificationResult,
  ChangedFile,
} from '@/types/execution';

export interface ErrorDiagnostic {
  title: string;
  source: string;
  rawError: string;
  suggestions: {
    label: string;
    description: string;
    promptText: string;
  }[];
}

export function analyzeSessionErrors(session: ExecutionSessionRecord): ErrorDiagnostic[] {
  const diagnostics: ErrorDiagnostic[] = [];

  // 1. Analyze failed verification checks
  const failedChecks = (session.verificationResults || []).filter((c) => c.status === 'failed');
  for (const check of failedChecks) {
    const raw = (check.error || check.output || '').trim();
    const suggestions: ErrorDiagnostic['suggestions'] = [];

    if (check.name === 'lint') {
      suggestions.push({
        label: 'Auto-fix lint violations & style errors',
        description: 'Instruct Antigravity to remove unused variables/imports and resolve all ESLint rules.',
        promptText: 'Fix all ESLint warnings and errors across the modified files. Remove unused imports and fix formatting so npm run lint passes cleanly.',
      });
      suggestions.push({
        label: 'Disable strict rules with eslint-disable comments',
        description: 'Add eslint-disable directives for non-critical warnings where appropriate.',
        promptText: 'Review the failing lint rules in the logs and add targeted eslint-disable comments or adjust configs where justified.',
      });
    } else if (check.name === 'typecheck') {
      suggestions.push({
        label: 'Fix TypeScript compiler errors & exports',
        description: 'Resolve type discrepancies, missing interface members, and import/export issues.',
        promptText: 'Fix the TypeScript compiler errors reported during typecheck. Ensure all types, props, and exports match the application schema.',
      });
    } else if (check.name === 'build') {
      if (raw.toLowerCase().includes('einval') || raw.toLowerCase().includes('spawn')) {
        suggestions.push({
          label: 'Retry production build check',
          description: 'Re-run build check in workspace now that process execution environment has been sanitized.',
          promptText: 'Run npm run build and fix any build errors or missing module exports so the production bundle compiles cleanly.',
        });
      } else {
        suggestions.push({
          label: 'Resolve build & compilation errors',
          description: 'Fix syntax, bundler errors, or missing assets preventing production build from succeeding.',
          promptText: 'Fix the build errors shown in the logs. Ensure all components render cleanly and npm run build succeeds.',
        });
      }
    } else if (check.name === 'test') {
      suggestions.push({
        label: 'Fix failing unit tests & assertions',
        description: 'Adjust the component or function code so that all test assertions in npm test pass.',
        promptText: 'Analyze the failed test output in the logs and update the implementation code so all test suites pass.',
      });
    }

    diagnostics.push({
      title: `${check.name.toUpperCase()} Check Failed`,
      source: `Verification (${check.command})`,
      rawError: raw.slice(0, 500) || 'Verification process exited with non-zero exit code.',
      suggestions,
    });
  }

  // 2. Analyze agent execution error if no failed checks or in addition
  if (session.error && (!diagnostics.length || session.status === 'failed')) {
    const suggestions: ErrorDiagnostic['suggestions'] = [];
    suggestions.push({
      label: 'Prompt agent to self-heal and resolve failure',
      description: 'Send the error message back to Antigravity to analyze the cause and retry.',
      promptText: `Analyze and fix the following agent failure: "${session.error.slice(0, 200)}". Inspect repository files and implement the missing logic.`,
    });

    diagnostics.push({
      title: 'Agent Execution Error',
      source: 'Antigravity CLI Engine',
      rawError: session.error,
      suggestions,
    });
  }

  return diagnostics;
}

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
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Revision & Done Workflow State
  const [markingDone, setMarkingDone] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionMode, setRevisionMode] = useState<'direct' | 'plan'>('direct');
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [revisionStep, setRevisionStep] = useState<'prompt' | 'review'>('prompt');
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [directRunning, setDirectRunning] = useState(false);
  const [applyingRevision, setApplyingRevision] = useState(false);
  const [revisionPlanContent, setRevisionPlanContent] = useState('');
  const [revisionError, setRevisionError] = useState<string | null>(null);

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

  // Handle Mark Done
  const handleMarkDone = async (note?: string) => {
    if (!selectedSessionId || markingDone) return;
    setMarkingDone(true);
    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}/done`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (res.ok) {
        await fetchSessionDetail(selectedSessionId);
        await fetchSessions();
      }
    } catch {
      // Ignore
    } finally {
      setMarkingDone(false);
    }
  };

  // Open Revision Modal
  const handleOpenRevisionModal = () => {
    setRevisionFeedback('');
    setRevisionPlanContent('');
    setRevisionError(null);
    setRevisionStep('prompt');
    setRevisionMode('direct');
    setShowRevisionModal(true);
  };

  // Select Suggested Solution and pre-fill prompt
  const handleSelectSuggestedSolution = (promptText: string) => {
    setRevisionFeedback(promptText);
    setRevisionPlanContent('');
    setRevisionError(null);
    setRevisionStep('prompt');
    setRevisionMode('direct');
    setShowRevisionModal(true);
  };

  // Direct Prompt to Antigravity (Token-Optimized)
  const handleDirectPromptApply = async () => {
    if (!selectedSessionId || !revisionFeedback.trim() || directRunning) return;
    setDirectRunning(true);
    setRevisionError(null);
    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}/revision/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planContent: revisionFeedback.trim(),
          feedback: revisionFeedback.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRevisionError(data.error || 'Failed to dispatch direct prompt to Antigravity.');
        return;
      }
      setShowRevisionModal(false);
      setActiveTab('logs');
      await fetchSessionDetail(selectedSessionId);
      await fetchSessions();
    } catch (err: unknown) {
      setRevisionError((err as Error).message || 'Failed to dispatch direct prompt to Antigravity.');
    } finally {
      setDirectRunning(false);
    }
  };

  // Generate Revision Fix Plan
  const handleGenerateRevisionPlan = async () => {
    if (!selectedSessionId || !revisionFeedback.trim() || generatingPlan) return;
    setGeneratingPlan(true);
    setRevisionError(null);
    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}/revision/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: revisionFeedback.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRevisionError(data.error || 'Failed to generate revision fix plan.');
        return;
      }
      setRevisionPlanContent(data.revision.planContent || '');
      setRevisionStep('review');
    } catch (err: unknown) {
      setRevisionError((err as Error).message || 'Failed to generate revision fix plan.');
    } finally {
      setGeneratingPlan(false);
    }
  };

  // Apply Revision Plan
  const handleApplyRevision = async () => {
    if (!selectedSessionId || !revisionPlanContent.trim() || applyingRevision) return;
    setApplyingRevision(true);
    setRevisionError(null);
    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}/revision/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planContent: revisionPlanContent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRevisionError(data.error || 'Failed to apply revision fix plan.');
        return;
      }
      setShowRevisionModal(false);
      setActiveTab('overview');
      await fetchSessionDetail(selectedSessionId);
      await fetchSessions();
    } catch (err: unknown) {
      setRevisionError((err as Error).message || 'Failed to apply revision fix plan.');
    } finally {
      setApplyingRevision(false);
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

                  {(sessionDetail.status === 'completed' || sessionDetail.status === 'failed') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      {sessionDetail.status === 'completed' && (
                        sessionDetail.isDone ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.45rem 0.85rem',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'rgba(34, 197, 94, 0.12)',
                              border: '1px solid var(--success)',
                              color: 'var(--success)',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                            }}
                          >
                            <CheckCircle2 size={15} color="var(--success)" />
                            <span>Done & Accepted</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleMarkDone()}
                            disabled={markingDone}
                            style={{
                              padding: '0.45rem 1rem',
                              borderRadius: 'var(--radius-sm)',
                              border: 'none',
                              backgroundColor: 'var(--success)',
                              color: '#fff',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              cursor: markingDone ? 'not-allowed' : 'pointer',
                              boxShadow: '0 0 14px rgba(34, 197, 94, 0.35)',
                            }}
                          >
                            <Check size={14} />
                            <span>{markingDone ? 'Saving...' : 'Mark as Done'}</span>
                          </button>
                        )
                      )}

                      <button
                        onClick={handleOpenRevisionModal}
                        style={{
                          padding: '0.45rem 0.95rem',
                          borderRadius: 'var(--radius-sm)',
                          border: sessionDetail.status === 'failed' ? '1px solid var(--accent-primary)' : '1px solid var(--accent-primary)',
                          backgroundColor: sessionDetail.status === 'failed' ? 'rgba(56, 189, 248, 0.16)' : 'rgba(56, 189, 248, 0.08)',
                          color: 'var(--accent-primary)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          cursor: 'pointer',
                          boxShadow: sessionDetail.status === 'failed' ? '0 0 14px rgba(56, 189, 248, 0.3)' : 'none',
                        }}
                      >
                        <Sparkles size={14} />
                        <span>{sessionDetail.status === 'failed' ? 'Prompt Agent to Fix' : 'Request Revision'}</span>
                      </button>
                    </div>
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

                    {/* Error Breakdown & Suggested Solutions for Failed Sessions */}
                    {sessionDetail.status === 'failed' && (
                      <div
                        style={{
                          padding: '1.25rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.05)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <AlertTriangle size={22} color="var(--danger)" />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.94rem', color: '#fff' }}>
                                Error Diagnosis & Suggested Fixes
                              </div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                DevFlow AI analyzed the failure output. Choose a suggested solution, or provide custom instructions.
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={handleOpenRevisionModal}
                            style={{
                              padding: '0.45rem 0.95rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--accent-primary)',
                              backgroundColor: 'rgba(56, 189, 248, 0.12)',
                              color: 'var(--accent-primary)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            <Sparkles size={14} />
                            <span>Custom Revision / Prompt →</span>
                          </button>
                        </div>

                        {analyzeSessionErrors(sessionDetail).map((diag, dIdx) => (
                          <div
                            key={dIdx}
                            style={{
                              backgroundColor: 'var(--bg-primary)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-subtle)',
                              padding: '1rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--danger)' }}>
                                {diag.title}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {diag.source}
                              </span>
                            </div>

                            <pre
                              style={{
                                margin: '0.4rem 0 0.85rem 0',
                                padding: '0.65rem 0.85rem',
                                backgroundColor: '#070a0e',
                                borderRadius: '4px',
                                color: '#fca5a5',
                                fontSize: '0.76rem',
                                fontFamily: 'var(--font-mono)',
                                whiteSpace: 'pre-wrap',
                                maxHeight: '140px',
                                overflowY: 'auto',
                              }}
                            >
                              {diag.rawError}
                            </pre>

                            {diag.suggestions.length > 0 && (
                              <>
                                <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <Lightbulb size={13} color="var(--warning)" />
                                  <span>Suggested Solution Options:</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {diag.suggestions.map((sug, sIdx) => (
                                    <div
                                      key={sIdx}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '1rem',
                                        padding: '0.65rem 0.85rem',
                                        backgroundColor: 'var(--bg-secondary)',
                                        borderRadius: '4px',
                                        border: '1px solid var(--border-subtle)',
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#fff' }}>
                                          {sug.label}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                          {sug.description}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleSelectSuggestedSolution(sug.promptText)}
                                        style={{
                                          padding: '0.4rem 0.85rem',
                                          borderRadius: 'var(--radius-sm)',
                                          border: 'none',
                                          backgroundColor: 'var(--accent-primary)',
                                          color: '#fff',
                                          fontSize: '0.76rem',
                                          fontWeight: 700,
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.35rem',
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap',
                                          flexShrink: 0,
                                        }}
                                      >
                                        <Zap size={13} />
                                        <span>Fix with this Solution</span>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        ))}

                        {/* Fallback note if user thinks suggestions are not correct */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem 0.95rem',
                            backgroundColor: 'rgba(56, 189, 248, 0.05)',
                            borderRadius: '4px',
                            border: '1px dashed rgba(56, 189, 248, 0.3)',
                            fontSize: '0.78rem',
                          }}
                        >
                          <span style={{ color: 'var(--text-secondary)' }}>
                            Don't think these solutions match your intent, or want to write custom instructions?
                          </span>
                          <button
                            onClick={handleOpenRevisionModal}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-primary)',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: 0,
                            }}
                          >
                            <span>Open Revisions (with or without AI plan) →</span>
                          </button>
                        </div>
                      </div>
                    )}

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

                    {sessionDetail.verificationResults?.some((c) => c.status === 'failed') && (
                      <div
                        style={{
                          padding: '0.85rem 1.15rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <AlertTriangle size={18} color="var(--danger)" />
                          <div style={{ fontSize: '0.82rem', color: '#fff' }}>
                            One or more verification checks failed. Prompt Antigravity with instructions to resolve the errors.
                          </div>
                        </div>
                        <button
                          onClick={handleOpenRevisionModal}
                          style={{
                            padding: '0.45rem 0.95rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--accent-primary)',
                            backgroundColor: 'rgba(56, 189, 248, 0.15)',
                            color: 'var(--accent-primary)',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <Sparkles size={14} />
                          <span>Fix Failures with Agent</span>
                        </button>
                      </div>
                    )}

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
                    {/* Human Review & Done Decision Banner */}
                    {(sessionDetail.status === 'completed' || sessionDetail.status === 'failed') && (
                      <div
                        style={{
                          padding: '1.1rem 1.25rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: sessionDetail.isDone
                            ? 'rgba(34, 197, 94, 0.08)'
                            : sessionDetail.status === 'failed'
                            ? 'rgba(239, 68, 68, 0.08)'
                            : 'rgba(56, 189, 248, 0.06)',
                          border: `1px solid ${
                            sessionDetail.isDone
                              ? 'rgba(34, 197, 94, 0.3)'
                              : sessionDetail.status === 'failed'
                              ? 'rgba(239, 68, 68, 0.3)'
                              : 'rgba(56, 189, 248, 0.25)'
                          }`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1.25rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          {sessionDetail.isDone ? (
                            <CheckCircle2 size={24} color="var(--success)" />
                          ) : sessionDetail.status === 'failed' ? (
                            <AlertTriangle size={24} color="var(--danger)" />
                          ) : (
                            <Sparkles size={24} color="var(--accent-primary)" />
                          )}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>
                              {sessionDetail.isDone
                                ? 'Implementation Accepted & Marked as Done'
                                : sessionDetail.status === 'failed'
                                ? 'Implementation / Verification Failed'
                                : 'Review Implementation & Verification'}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                              {sessionDetail.isDone
                                ? `Accepted by developer on ${new Date(sessionDetail.doneAt || '').toLocaleString()}. Changes are ready for main repository integration.`
                                : sessionDetail.status === 'failed'
                                ? 'Inspect the diff below. You can provide instructions to Antigravity to fix these issues and generate a targeted revision plan.'
                                : 'Inspect the changed files and unified diff below. If you are satisfied with the code, mark it as Done. If adjustments are needed, request changes to generate a fix plan for review.'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                          <button
                            onClick={handleOpenRevisionModal}
                            style={{
                              padding: '0.55rem 1rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--accent-primary)',
                              backgroundColor: 'rgba(56, 189, 248, 0.1)',
                              color: 'var(--accent-primary)',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              cursor: 'pointer',
                            }}
                          >
                            <Sparkles size={14} />
                            <span>{sessionDetail.isDone ? 'Request New Changes' : sessionDetail.status === 'failed' ? 'Prompt Agent to Fix' : 'Request Changes / Fix'}</span>
                          </button>

                          {!sessionDetail.isDone && sessionDetail.status === 'completed' && (
                            <button
                              onClick={() => handleMarkDone()}
                              disabled={markingDone}
                              style={{
                                padding: '0.55rem 1.35rem',
                                borderRadius: 'var(--radius-sm)',
                                border: 'none',
                                backgroundColor: 'var(--success)',
                                color: '#fff',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                cursor: markingDone ? 'not-allowed' : 'pointer',
                                boxShadow: '0 0 16px rgba(34, 197, 94, 0.35)',
                              }}
                            >
                              <Check size={16} />
                              <span>{markingDone ? 'Marking Done...' : 'Done & Accept'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

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

                    {sessionDetail.status === 'failed' && (
                      <div
                        style={{
                          marginTop: '1.25rem',
                          padding: '1rem 1.25rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.85rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <AlertTriangle size={20} color="var(--danger)" />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>
                                Execution or Verification Failed
                              </div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                Choose a recommended solution below, or open revisions with your own custom prompt.
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={handleOpenRevisionModal}
                            style={{
                              padding: '0.45rem 0.95rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--accent-primary)',
                              backgroundColor: 'rgba(56, 189, 248, 0.15)',
                              color: 'var(--accent-primary)',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            <Sparkles size={14} />
                            <span>Custom Revision (with or without AI plan) →</span>
                          </button>
                        </div>

                        {/* Top Suggested Solutions for Quick Action */}
                        {analyzeSessionErrors(sessionDetail).length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Lightbulb size={12} color="var(--warning)" />
                              <span>Recommended Quick Solutions:</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem' }}>
                              {analyzeSessionErrors(sessionDetail)
                                .flatMap((d) => d.suggestions)
                                .slice(0, 3)
                                .map((sug, sIdx) => (
                                  <div
                                    key={sIdx}
                                    style={{
                                      padding: '0.65rem 0.85rem',
                                      backgroundColor: 'var(--bg-secondary)',
                                      borderRadius: 'var(--radius-sm)',
                                      border: '1px solid var(--border-subtle)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'space-between',
                                      gap: '0.5rem',
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: '0.78rem', color: '#fff' }}>
                                        {sug.label}
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem', lineHeight: 1.35 }}>
                                        {sug.description}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleSelectSuggestedSolution(sug.promptText)}
                                      style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: 'var(--radius-sm)',
                                        border: 'none',
                                        backgroundColor: 'var(--accent-primary)',
                                        color: '#fff',
                                        fontSize: '0.74rem',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.35rem',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Zap size={12} />
                                      <span>Apply Solution (Token-Optimized)</span>
                                    </button>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Revision & Fix Modal (Human Review & Approval) */}
      {showRevisionModal && sessionDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
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
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Sparkles size={18} color="var(--accent-primary)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                    {revisionStep === 'prompt'
                      ? sessionDetail.status === 'failed'
                        ? 'Fix Execution / Verification Failure'
                        : 'Request Implementation Changes'
                      : 'Review & Approve Fix Plan'}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {revisionStep === 'prompt'
                      ? sessionDetail.status === 'failed'
                        ? 'Provide prompt instructions to Antigravity. It will inspect the errors, modified files, and produce a fix plan.'
                        : 'Describe what needs to be changed. Antigravity will generate a fix plan for your review.'
                      : 'Carefully review the proposed changes below before authorizing the agent to apply them.'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowRevisionModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Message */}
            {revisionError && (
              <div
                style={{
                  margin: '1rem 1.5rem 0',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--danger-subtle)',
                  border: '1px solid var(--danger)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  color: 'var(--danger)',
                }}
              >
                {revisionError}
              </div>
            )}

            {/* Step 1: Prompt Input */}
            {revisionStep === 'prompt' && (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                {/* 2 Strategy Options */}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.55rem' }}>
                    Choose Execution Strategy:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {/* Option 1: Direct Prompt to AGY (Token Optimized) */}
                    <div
                      onClick={() => setRevisionMode('direct')}
                      style={{
                        padding: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: revisionMode === 'direct' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        backgroundColor: revisionMode === 'direct' ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.85rem', color: revisionMode === 'direct' ? '#fff' : 'var(--text-secondary)' }}>
                          <Zap size={15} color="var(--accent-primary)" />
                          <span>Direct Prompt to AGY</span>
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)' }}>
                          Token Optimized
                        </span>
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        Bypasses intermediate plan generation. Sends your instructions directly to Antigravity CLI for immediate code execution, saving tokens & time.
                      </div>
                    </div>

                    {/* Option 2: Help with AI (Plan & Review) */}
                    <div
                      onClick={() => setRevisionMode('plan')}
                      style={{
                        padding: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: revisionMode === 'plan' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        backgroundColor: revisionMode === 'plan' ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.85rem', color: revisionMode === 'plan' ? '#fff' : 'var(--text-secondary)' }}>
                          <Sparkles size={15} color="var(--accent-primary)" />
                          <span>Help with AI (Plan First)</span>
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-primary)' }}>
                          Reviewable
                        </span>
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        Analyzes repo diffs & errors to generate a detailed step-by-step fix plan. You can inspect and approve the plan before code is modified.
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    {revisionMode === 'direct'
                      ? 'Prompt instructions for Antigravity (Direct Execution):'
                      : 'Describe the adjustments or fixes needed:'}
                  </label>
                  <textarea
                    rows={5}
                    value={revisionFeedback}
                    onChange={(e) => setRevisionFeedback(e.target.value)}
                    placeholder={
                      sessionDetail.status === 'failed'
                        ? 'e.g. Fix the npm build errors, ensure all modules export properly, and re-run verification.'
                        : 'e.g. Please update the ErrorBoundary to include a retry button, fix the missing type exports in common/index.ts, and add unit tests.'
                    }
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      fontFamily: 'var(--font-sans)',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    {revisionMode === 'direct'
                      ? '⚡ Antigravity CLI will execute this prompt directly in your workspace. Saves tokens by skipping plan generation.'
                      : 'Antigravity will inspect your feedback alongside existing modifications and present a plan for your approval before modifying files.'}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => setShowRevisionModal(false)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>

                  {revisionMode === 'direct' ? (
                    <button
                      onClick={handleDirectPromptApply}
                      disabled={directRunning || !revisionFeedback.trim()}
                      style={{
                        padding: '0.5rem 1.35rem',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: 'var(--accent-primary)',
                        color: '#fff',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        cursor: directRunning || !revisionFeedback.trim() ? 'not-allowed' : 'pointer',
                        boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)',
                      }}
                    >
                      {directRunning && <Loader2 size={14} className="animate-spin" />}
                      <Zap size={14} />
                      <span>{directRunning ? 'Running Direct Prompt...' : 'Run Direct Prompt (Token Optimized) →'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleGenerateRevisionPlan}
                      disabled={generatingPlan || !revisionFeedback.trim()}
                      style={{
                        padding: '0.5rem 1.25rem',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: 'var(--accent-primary)',
                        color: '#fff',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        cursor: generatingPlan || !revisionFeedback.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {generatingPlan && <Loader2 size={14} className="animate-spin" />}
                      <Sparkles size={14} />
                      <span>{generatingPlan ? 'Generating Fix Plan...' : 'Generate Fix Plan for Review →'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Human Review of Revision Plan */}
            {revisionStep === 'review' && (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'rgba(56, 189, 248, 0.08)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    fontSize: '0.8rem',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <strong>Human Review Required:</strong> Inspect the agent-generated fix plan below. You can directly edit the markdown before approving.
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    Fix Plan (Markdown):
                  </label>
                  <textarea
                    rows={12}
                    value={revisionPlanContent}
                    onChange={(e) => setRevisionPlanContent(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.85rem',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => setRevisionStep('prompt')}
                    disabled={applyingRevision}
                    style={{
                      padding: '0.5rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                    }}
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Prompt</span>
                  </button>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={() => setShowRevisionModal(false)}
                      disabled={applyingRevision}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApplyRevision}
                      disabled={applyingRevision || !revisionPlanContent.trim()}
                      style={{
                        padding: '0.5rem 1.35rem',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: 'var(--accent-primary)',
                        color: '#fff',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        cursor: applyingRevision || !revisionPlanContent.trim() ? 'not-allowed' : 'pointer',
                        boxShadow: '0 0 16px var(--accent-glow)',
                      }}
                    >
                      {applyingRevision && <Loader2 size={14} className="animate-spin" />}
                      <span>{applyingRevision ? 'Applying Fix...' : 'Approve & Apply Fix'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
