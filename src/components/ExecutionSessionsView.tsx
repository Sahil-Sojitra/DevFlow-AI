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
  AlertCircle,
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
  GitMerge,
  GitPullRequest,
  Copy,
  ChevronUp,
  Send,
  Filter,
  Code,
} from 'lucide-react';
import type { FileDiff } from '@/services/git-ops';
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

  // 1. Prioritize structured pinpoint diagnostics if present
  if (session.diagnostics && session.diagnostics.length > 0) {
    for (const issue of session.diagnostics) {
      const fileLoc = issue.file
        ? `${issue.file}${issue.line ? `:${issue.line}${issue.column ? `:${issue.column}` : ''}` : ''}`
        : 'Repository';
      const codeTag = issue.code ? `[${issue.code}] ` : '';
      const suggestions: ErrorDiagnostic['suggestions'] = [];
      const baseName = issue.file ? issue.file.split(/[/\\]/).pop() : issue.check;

      suggestions.push({
        label: `Targeted Auto-Fix: ${baseName}`,
        description: `Direct Antigravity to fix ${codeTag || 'issue'} in ${fileLoc}.`,
        promptText: `Fix the ${issue.check} issue at ${fileLoc}: ${codeTag}${issue.message}. Ensure the file compiles cleanly and all test cases pass.`,
      });

      diagnostics.push({
        title: `${issue.check.toUpperCase()} - ${codeTag}${fileLoc}`,
        source: issue.file || issue.check,
        rawError: `${codeTag}${issue.message}${issue.expected && issue.actual ? `\n- Expected: ${issue.expected}\n- Received: ${issue.actual}` : ''}`,
        suggestions,
      });
    }

    return diagnostics;
  }

  // 2. Analyze failed verification checks (fallback)
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

  // Phase 2: Merge and PR states
  const [mergingSession, setMergingSession] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergeSuccess, setMergeSuccess] = useState<string | null>(null);
  const [showPrModal, setShowPrModal] = useState(false);
  const [prCopied, setPrCopied] = useState(false);
  const [creatingPr, setCreatingPr] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);
  const [prSuccessUrl, setPrSuccessUrl] = useState<string | null>(null);
  const [prSuccessNumber, setPrSuccessNumber] = useState<number | null>(null);
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [prIsDraft, setPrIsDraft] = useState(false);

  // Phase 5: Structured Diff and Inline Revision states
  const [structuredDiffFiles, setStructuredDiffFiles] = useState<FileDiff[]>([]);
  const [diffAdditions, setDiffAdditions] = useState<number>(0);
  const [diffDeletions, setDiffDeletions] = useState<number>(0);
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);
  const [diffSearchQuery, setDiffSearchQuery] = useState('');
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  // Inline Revision Feedback state
  const [inlineFeedback, setInlineFeedback] = useState('');
  const [applyingInlineRevision, setApplyingInlineRevision] = useState(false);
  const [inlineRevisionError, setInlineRevisionError] = useState<string | null>(null);

  const toggleFileCollapse = (filePath: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const openPrModal = () => {
    if (sessionDetail) {
      setPrTitle(`feat(${sessionDetail.issueIdentifier}): ${sessionDetail.issueTitle}`);
      const checks = sessionDetail.verificationResults.length > 0
        ? sessionDetail.verificationResults.map((v) => `- [x] \`${v.name}\` (${v.status})`).join('\n')
        : '- [x] Automated tests and checks passed';
      const files = sessionDetail.changedFiles.length > 0
        ? sessionDetail.changedFiles.slice(0, 10).map((f) => `- \`${f.path}\` (${f.status})`).join('\n')
        : '- Implementation code changes';
      setPrBody(
        `## Summary\nResolves **${sessionDetail.issueIdentifier}**: ${sessionDetail.issueTitle}\n\n### Implementation Overview\n${sessionDetail.summary || 'Approved plan implemented and verified autonomously.'}\n\n### Verification Checklist\n${checks}\n\n### Modified Files (${sessionDetail.changedFiles.length})\n${files}\n\n---\n*Created automatically with [DevFlow-AI](https://github.com/Sahil-Sojitra/DevFlow-AI)*`
      );
      setPrError(null);
      setPrSuccessUrl(sessionDetail.prUrl || null);
      setPrSuccessNumber(sessionDetail.prNumber || null);
    }
    setShowPrModal(true);
  };

  const handleCreatePr = async () => {
    if (!selectedSessionId || creatingPr) return;
    setCreatingPr(true);
    setPrError(null);
    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}/pr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: prTitle.trim() || undefined,
          body: prBody.trim() || undefined,
          draft: prIsDraft,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPrError(data.error || 'Failed to push branch and create pull request.');
        return;
      }
      setPrSuccessUrl(data.prUrl || null);
      setPrSuccessNumber(data.prNumber || null);
      await fetchSessionDetail(selectedSessionId);
      await fetchSessions();
    } catch (err: unknown) {
      setPrError((err as Error).message || 'Failed to push branch and create pull request.');
    } finally {
      setCreatingPr(false);
    }
  };

  const handleMergeSession = async () => {
    if (!selectedSessionId || mergingSession) return;
    setMergingSession(true);
    setMergeError(null);
    setMergeSuccess(null);
    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setMergeError(data.error || 'Failed to merge branch into base branch.');
        return;
      }
      setMergeSuccess(`Successfully merged branch into ${data.session?.baseBranch || 'main'}!`);
      await fetchSessionDetail(selectedSessionId);
      await fetchSessions();
    } catch (err: unknown) {
      setMergeError((err as Error).message || 'Failed to merge branch.');
    } finally {
      setMergingSession(false);
    }
  };
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
        setStructuredDiffFiles(data.files || []);
        setDiffAdditions(data.totalAdditions || 0);
        setDiffDeletions(data.totalDeletions || 0);
      } else {
        setDiffText('Failed to fetch diff.');
        setStructuredDiffFiles([]);
      }
    } catch (err: unknown) {
      setDiffText(`Error loading diff: ${(err as Error).message}`);
      setStructuredDiffFiles([]);
    } finally {
      setLoadingDiff(false);
    }
  }, []);

  const handleApplyInlineRevision = async () => {
    if (!selectedSessionId || !inlineFeedback.trim() || applyingInlineRevision) return;
    setApplyingInlineRevision(true);
    setInlineRevisionError(null);
    try {
      // 1. Generate revision plan based on targeted feedback
      const planRes = await fetch(`/api/sessions/${selectedSessionId}/revision/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: inlineFeedback.trim() }),
      });
      const planData = await planRes.json();
      if (!planRes.ok) {
        setInlineRevisionError(planData.error || 'Failed to prepare revision plan');
        return;
      }

      // 2. Apply revision plan directly to ticket branch
      const applyRes = await fetch(`/api/sessions/${selectedSessionId}/revision/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planContent: planData.revision?.content || inlineFeedback.trim(),
          feedback: inlineFeedback.trim(),
        }),
      });

      if (!applyRes.ok) {
        const applyData = await applyRes.json();
        setInlineRevisionError(applyData.error || 'Failed to execute revision on branch');
        return;
      }

      setInlineFeedback('');
      setActiveTab('logs');
      await fetchSessionDetail(selectedSessionId);
      await fetchSessions();
    } catch (err: unknown) {
      setInlineRevisionError((err as Error).message || 'Failed to apply revision');
    } finally {
      setApplyingInlineRevision(false);
    }
  };

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

  // Real-time EventSource SSE streaming with fallback polling
  useEffect(() => {
    if (!selectedSessionId) return;

    // Connect to SSE stream
    const sseUrl = `/api/sessions/${selectedSessionId}/stream`;
    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource(sseUrl);

      eventSource.addEventListener('session', (event) => {
        try {
          const updatedSession = JSON.parse(event.data) as ExecutionSessionRecord;
          setSessionDetail((prev) => {
            if (!prev || prev.id === updatedSession.id) {
              return updatedSession;
            }
            return prev;
          });
          // Refresh sessions list in background
          fetchSessions();
        } catch {
          // Ignore parse errors
        }
      });

      eventSource.onerror = () => {
        // Close broken event source and fallback to interval polling
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!fallbackInterval) {
          fallbackInterval = setInterval(() => {
            fetchSessionDetail(selectedSessionId);
            fetchSessions();
          }, 3000);
        }
      };
    } catch {
      // EventSource not supported or failed
      fallbackInterval = setInterval(() => {
        fetchSessionDetail(selectedSessionId);
        fetchSessions();
      }, 3000);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [selectedSessionId, fetchSessionDetail, fetchSessions]);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Work Sessions & Execution
            </h1>
            <span
              className="mono-chip"
              style={{
                fontSize: '0.7rem',
                padding: '0.1rem 0.45rem',
                color: 'var(--text-secondary)',
              }}
            >
              {sessions.length} total
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            Monitor implementation runs, inspect Git changes, and review verification results.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {sessionDetail && ['queued', 'running', 'verifying'].includes(sessionDetail.status) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                color: '#86efac',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--success)',
                  display: 'inline-block',
                }}
              />
              <span>SSE STREAMING</span>
            </div>
          )}

          <button
            onClick={() => {
              fetchSessions();
              if (selectedSessionId) fetchSessionDetail(selectedSessionId);
            }}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Master List + Detail Pane */}
      <div
        className="sessions-layout"
        style={{
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {s.stuckInHallucination && (
                          <span
                            title="Agent exhausted 3 auto-fix attempts and detected verification hallucination"
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              padding: '0.12rem 0.4rem',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'rgba(239, 68, 68, 0.25)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.45)',
                            }}
                          >
                            Stuck (3x)
                          </span>
                        )}
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

                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'rgba(99, 102, 241, 0.12)',
                        color: '#a5b4fc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontWeight: 600,
                      }}
                      title="Linear issue state is synchronized two-way"
                    >
                      <Zap size={11} />
                      <span>Linear 2-Way Sync</span>
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

                    {/* Agent Stuck in Hallucination Warning Banner */}
                    {sessionDetail.stuckInHallucination && (
                      <div
                        style={{
                          padding: '1.25rem 1.4rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          border: '1.5px solid rgba(239, 68, 68, 0.45)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.9rem',
                          boxShadow: '0 0 20px rgba(239, 68, 68, 0.12)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: '1px solid rgba(239, 68, 68, 0.5)',
                              }}
                            >
                              <AlertTriangle size={20} color="#f87171" />
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
                                  Agent Stuck in Hallucination / Autonomous Loop
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: 'var(--radius-full)',
                                    backgroundColor: 'rgba(239, 68, 68, 0.3)',
                                    color: '#fca5a5',
                                    border: '1px solid rgba(239, 68, 68, 0.5)',
                                  }}
                                >
                                  3 / 3 Auto-Fix Attempts Exhausted
                                </span>
                              </div>
                              <p style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.8)', marginTop: '0.35rem', lineHeight: 1.5 }}>
                                The agent repeatedly attempted to implement the task, generate test cases, and pass automated verification. After <strong>3 failed self-healing cycles</strong>, execution was paused to protect your tokens and prevent infinite loops. Developer guidance is now required.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            paddingTop: '0.75rem',
                            borderTop: '1px solid rgba(239, 68, 68, 0.2)',
                          }}
                        >
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Choose an intervention mode below to unblock the agent:
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => {
                                setRevisionMode('direct');
                                handleOpenRevisionModal();
                              }}
                              style={{
                                padding: '0.45rem 0.85rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--accent-primary)',
                                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                color: 'var(--accent-primary)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                cursor: 'pointer',
                              }}
                            >
                              <Zap size={13} />
                              <span>⚡ Fix with Direct Prompt (Tokens Saved)</span>
                            </button>
                            <button
                              onClick={() => {
                                setRevisionMode('plan');
                                handleOpenRevisionModal();
                              }}
                              style={{
                                padding: '0.45rem 0.85rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-default)',
                                backgroundColor: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                cursor: 'pointer',
                              }}
                            >
                              <Sparkles size={13} color="var(--accent-primary)" />
                              <span>🤖 Fix with AI Plan</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

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
                              <span>{markingDone ? 'Marking Done...' : 'Approve & Mark Done'}</span>
                            </button>
                          )}

                          {sessionDetail.isDone && sessionDetail.mergeStatus !== 'merged' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <button
                                onClick={handleMergeSession}
                                disabled={mergingSession}
                                style={{
                                  padding: '0.55rem 1.15rem',
                                  borderRadius: 'var(--radius-sm)',
                                  border: 'none',
                                  backgroundColor: 'var(--success)',
                                  color: '#fff',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.45rem',
                                  cursor: mergingSession ? 'not-allowed' : 'pointer',
                                  boxShadow: '0 0 14px rgba(34, 197, 94, 0.35)',
                                }}
                              >
                                <GitMerge size={16} />
                                <span>{mergingSession ? 'Merging...' : `1. Merge into ${sessionDetail.baseBranch || 'main'}`}</span>
                              </button>

                              <button
                                onClick={openPrModal}
                                style={{
                                  padding: '0.55rem 1.15rem',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--accent-primary)',
                                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                  color: 'var(--accent-primary)',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.45rem',
                                  cursor: 'pointer',
                                }}
                              >
                                <GitPullRequest size={15} />
                                <span>{sessionDetail.prUrl ? '2. View / Re-push PR' : '2. Create Pull Request (PR)'}</span>
                              </button>
                            </div>
                          )}

                          {sessionDetail.isDone && sessionDetail.prUrl && (
                            <a
                              href={sessionDetail.prUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.45rem 0.85rem',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                border: '1px solid var(--accent-primary)',
                                color: 'var(--accent-primary)',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                textDecoration: 'none',
                              }}
                            >
                              <GitPullRequest size={15} />
                              <span>{sessionDetail.prNumber ? `Pull Request #${sessionDetail.prNumber} ↗` : 'Open Pull Request ↗'}</span>
                            </a>
                          )}

                          {sessionDetail.isDone && sessionDetail.mergeStatus === 'merged' && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.45rem 0.85rem',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                border: '1px solid var(--success)',
                                color: '#86efac',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                              }}
                            >
                              <CheckCircle2 size={16} color="var(--success)" />
                              <span>Merged into {sessionDetail.baseBranch || 'main'} ({sessionDetail.mergeCommitSha?.slice(0, 7) || 'HEAD'})</span>
                            </div>
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

                    {/* Phase 5: Interactive In-Browser Diff Reviewer & Inline Revision Loop */}
                    <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Diff Header Bar */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          padding: '0.75rem 1rem',
                          backgroundColor: 'var(--bg-tertiary)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                            Interactive Git Diff
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ({structuredDiffFiles.length} file{structuredDiffFiles.length === 1 ? '' : 's'})
                          </span>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.45rem',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                color: '#86efac',
                              }}
                            >
                              +{diffAdditions}
                            </span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.45rem',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                color: '#fca5a5',
                              }}
                            >
                              -{diffDeletions}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <button
                            onClick={() => {
                              if (collapsedFiles.size === structuredDiffFiles.length) {
                                setCollapsedFiles(new Set());
                              } else {
                                setCollapsedFiles(new Set(structuredDiffFiles.map((f) => f.filePath)));
                              }
                            }}
                            style={{
                              background: 'none',
                              border: '1px solid var(--border-default)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.75rem',
                              padding: '0.25rem 0.6rem',
                              cursor: 'pointer',
                            }}
                          >
                            {collapsedFiles.size === structuredDiffFiles.length ? 'Expand All' : 'Collapse All'}
                          </button>

                          <button
                            onClick={() => fetchDiff(sessionDetail.id)}
                            style={{
                              background: 'none',
                              border: '1px solid var(--accent-primary)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--accent-primary)',
                              fontSize: '0.75rem',
                              padding: '0.25rem 0.6rem',
                              cursor: 'pointer',
                            }}
                          >
                            Refresh Diff
                          </button>
                        </div>
                      </div>

                      {/* Inline Revision Feedback Box */}
                      <div
                        style={{
                          padding: '1rem',
                          backgroundColor: 'rgba(56, 189, 248, 0.05)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <Sparkles size={16} color="var(--accent-primary)" />
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                              Request Changes / Inline AI Revision
                            </span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Applies tweaks directly to branch "{sessionDetail.ticketBranch || sessionDetail.branch}"
                          </span>
                        </div>

                        {/* Quick preset chips */}
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {[
                            '+ Add edge-case test coverage',
                            '+ Improve error handling & validation',
                            '+ Refactor and clean up code',
                            '+ Add TypeScript types and documentation',
                          ].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                setInlineFeedback((prev) =>
                                  prev ? `${prev}\n${preset.replace(/^\+\s*/, '')}` : preset.replace(/^\+\s*/, '')
                                );
                              }}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-full)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.6rem',
                                cursor: 'pointer',
                              }}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        {inlineRevisionError && (
                          <div
                            style={{
                              padding: '0.5rem 0.75rem',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid var(--error)',
                              borderRadius: 'var(--radius-sm)',
                              color: '#fca5a5',
                              fontSize: '0.78rem',
                            }}
                          >
                            {inlineRevisionError}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <textarea
                            rows={2}
                            value={inlineFeedback}
                            onChange={(e) => setInlineFeedback(e.target.value)}
                            placeholder="Describe any adjustments needed (e.g. 'Make email optional in registration schema and add test case')..."
                            disabled={applyingInlineRevision}
                            style={{
                              flex: 1,
                              padding: '0.55rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-default)',
                              backgroundColor: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              fontSize: '0.8rem',
                              fontFamily: 'inherit',
                              resize: 'vertical',
                            }}
                          />

                          <button
                            onClick={handleApplyInlineRevision}
                            disabled={!inlineFeedback.trim() || applyingInlineRevision}
                            style={{
                              padding: '0.55rem 1.15rem',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: !inlineFeedback.trim() || applyingInlineRevision ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                              color: !inlineFeedback.trim() || applyingInlineRevision ? 'var(--text-muted)' : '#fff',
                              border: 'none',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              cursor: !inlineFeedback.trim() || applyingInlineRevision ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              whiteSpace: 'nowrap',
                              height: '42px',
                            }}
                          >
                            {applyingInlineRevision ? (
                              <>
                                <Loader2 size={14} className="spin" />
                                <span>Applying...</span>
                              </>
                            ) : (
                              <>
                                <Send size={14} />
                                <span>Apply Revision</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* File Filter Chips */}
                      {structuredDiffFiles.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            <Filter size={13} />
                            <span>Filter File:</span>
                          </div>
                          <button
                            onClick={() => setSelectedDiffFile(null)}
                            style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '0.72rem',
                              border: 'none',
                              backgroundColor: selectedDiffFile === null ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                              color: selectedDiffFile === null ? '#fff' : 'var(--text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            All ({structuredDiffFiles.length})
                          </button>
                          {structuredDiffFiles.map((f) => (
                            <button
                              key={f.filePath}
                              onClick={() => setSelectedDiffFile(selectedDiffFile === f.filePath ? null : f.filePath)}
                              style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.72rem',
                                border: '1px solid var(--border-subtle)',
                                backgroundColor: selectedDiffFile === f.filePath ? 'rgba(56, 189, 248, 0.2)' : 'var(--bg-primary)',
                                color: selectedDiffFile === f.filePath ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                              }}
                            >
                              <span>{f.filePath.split('/').pop()}</span>
                              <span style={{ color: '#86efac', fontSize: '0.68rem' }}>+{f.additions}</span>
                              <span style={{ color: '#fca5a5', fontSize: '0.68rem' }}>-{f.deletions}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Diff Body Content */}
                      {loadingDiff ? (
                        <div
                          style={{
                            padding: '2rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.65rem',
                            backgroundColor: '#0a0d13',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.85rem',
                          }}
                        >
                          <Loader2 size={16} className="spin" color="var(--accent-primary)" />
                          <span>Generating structured git diff...</span>
                        </div>
                      ) : structuredDiffFiles.length === 0 ? (
                        <div
                          style={{
                            backgroundColor: '#0a0d13',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '1.5rem',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '0.82rem',
                          }}
                        >
                          {diffText || 'No differences detected between ticket branch and base branch.'}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {structuredDiffFiles
                            .filter((f) => !selectedDiffFile || f.filePath === selectedDiffFile)
                            .map((file) => {
                              const isCollapsed = collapsedFiles.has(file.filePath);
                              return (
                                <div
                                  key={file.filePath}
                                  style={{
                                    backgroundColor: '#0a0d13',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-md)',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {/* File Diff Header */}
                                  <div
                                    onClick={() => toggleFileCollapse(file.filePath)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '0.65rem 1rem',
                                      backgroundColor: 'var(--bg-secondary)',
                                      borderBottom: isCollapsed ? 'none' : '1px solid var(--border-subtle)',
                                      cursor: 'pointer',
                                      userSelect: 'none',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                      <Code size={14} color="var(--accent-primary)" />
                                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>
                                        {file.filePath}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: '0.68rem',
                                          fontWeight: 700,
                                          textTransform: 'uppercase',
                                          padding: '0.1rem 0.4rem',
                                          borderRadius: 'var(--radius-sm)',
                                          backgroundColor:
                                            file.status === 'added'
                                              ? 'rgba(34, 197, 94, 0.15)'
                                              : file.status === 'deleted'
                                              ? 'rgba(239, 68, 68, 0.15)'
                                              : 'rgba(56, 189, 248, 0.15)',
                                          color:
                                            file.status === 'added'
                                              ? '#86efac'
                                              : file.status === 'deleted'
                                              ? '#fca5a5'
                                              : 'var(--accent-primary)',
                                        }}
                                      >
                                        {file.status}
                                      </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                                      <span style={{ color: '#86efac' }}>+{file.additions}</span>
                                      <span style={{ color: '#fca5a5' }}>-{file.deletions}</span>
                                    </div>
                                  </div>

                                  {/* Chunks & Line-by-Line Table */}
                                  {!isCollapsed && (
                                    <div style={{ overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                                      {file.chunks.map((chunk, cIdx) => (
                                        <div key={cIdx}>
                                          {/* Hunk Header */}
                                          <div
                                            style={{
                                              padding: '0.35rem 1rem',
                                              backgroundColor: 'rgba(56, 189, 248, 0.08)',
                                              color: 'var(--accent-primary)',
                                              fontSize: '0.72rem',
                                              borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
                                            }}
                                          >
                                            @@ -{chunk.oldStart},{chunk.oldLines} +{chunk.newStart},{chunk.newLines} @@ {chunk.header}
                                          </div>

                                          {/* Lines */}
                                          {chunk.lines.map((line, lIdx) => {
                                            const isAdd = line.type === 'add';
                                            const isDel = line.type === 'delete';
                                            return (
                                              <div
                                                key={lIdx}
                                                style={{
                                                  display: 'grid',
                                                  gridTemplateColumns: '45px 45px 24px 1fr',
                                                  backgroundColor: isAdd
                                                    ? 'rgba(34, 197, 94, 0.1)'
                                                    : isDel
                                                    ? 'rgba(239, 68, 68, 0.12)'
                                                    : 'transparent',
                                                  color: isAdd ? '#86efac' : isDel ? '#fca5a5' : '#e2e8f0',
                                                  lineHeight: 1.5,
                                                }}
                                              >
                                                {/* Old Line # */}
                                                <span
                                                  style={{
                                                    textAlign: 'right',
                                                    paddingRight: '0.5rem',
                                                    color: 'var(--text-muted)',
                                                    userSelect: 'none',
                                                    borderRight: '1px solid var(--border-subtle)',
                                                    fontSize: '0.72rem',
                                                  }}
                                                >
                                                  {line.oldLineNumber ?? ''}
                                                </span>

                                                {/* New Line # */}
                                                <span
                                                  style={{
                                                    textAlign: 'right',
                                                    paddingRight: '0.5rem',
                                                    color: 'var(--text-muted)',
                                                    userSelect: 'none',
                                                    borderRight: '1px solid var(--border-subtle)',
                                                    fontSize: '0.72rem',
                                                  }}
                                                >
                                                  {line.newLineNumber ?? ''}
                                                </span>

                                                {/* Gutter marker */}
                                                <span
                                                  style={{
                                                    textAlign: 'center',
                                                    fontWeight: 700,
                                                    userSelect: 'none',
                                                    color: isAdd ? '#86efac' : isDel ? '#fca5a5' : 'transparent',
                                                  }}
                                                >
                                                  {isAdd ? '+' : isDel ? '-' : ' '}
                                                </span>

                                                {/* Line text */}
                                                <span style={{ padding: '0 0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                                  {line.content || ' '}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
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
      {/* Phase 2: Pull Request Staged Modal */}
      {showPrModal && sessionDetail && (
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
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-tertiary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <GitPullRequest size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                    Push & Create Pull Request
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Pushes your ticket branch to remote origin and generates or connects the PR
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowPrModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {prError && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid var(--error)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.82rem',
                    color: '#fca5a5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <AlertCircle size={16} color="var(--error)" />
                  <span>{prError}</span>
                </div>
              )}

              {prSuccessUrl ? (
                <div
                  style={{
                    padding: '1.25rem',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid var(--success)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    alignItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  <CheckCircle2 size={32} color="var(--success)" />
                  <div>
                    <div style={{ fontWeight: 700, color: '#86efac', fontSize: '1rem' }}>
                      Branch Pushed & Pull Request Ready!
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {prSuccessNumber
                        ? `Pull Request #${prSuccessNumber} was created on your remote git provider.`
                        : 'Your feature branch has been pushed to origin and is ready to review or create.'}
                    </div>
                  </div>

                  <a
                    href={prSuccessUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.6rem 1.25rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--accent-primary)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      marginTop: '0.5rem',
                    }}
                  >
                    <span>{prSuccessNumber ? `Open Pull Request #${prSuccessNumber}` : 'Open Pull Request in Browser'}</span>
                    <ExternalLink size={15} />
                  </a>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Branches:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{sessionDetail.ticketBranch || sessionDetail.branch}</span>
                      <span style={{ color: 'var(--text-muted)' }}>➔</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{sessionDetail.baseBranch || 'main'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Pull Request Title:</span>
                    <input
                      type="text"
                      value={prTitle}
                      onChange={(e) => setPrTitle(e.target.value)}
                      disabled={creatingPr}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Pull Request Description (Markdown):</span>
                    <textarea
                      rows={6}
                      value={prBody}
                      onChange={(e) => setPrBody(e.target.value)}
                      disabled={creatingPr}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        fontFamily: 'var(--font-mono)',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      id="prIsDraft"
                      checked={prIsDraft}
                      onChange={(e) => setPrIsDraft(e.target.checked)}
                      disabled={creatingPr}
                      style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                    />
                    <label htmlFor="prIsDraft" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      Mark as Draft Pull Request
                    </label>
                  </div>
                </>
              )}
            </div>

            <div
              style={{
                padding: '1rem 1.5rem',
                backgroundColor: 'var(--bg-tertiary)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.75rem',
              }}
            >
              <button
                onClick={() => setShowPrModal(false)}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${prTitle}\n\n${prBody}`);
                  setPrCopied(true);
                  setTimeout(() => setPrCopied(false), 2000);
                }}
                style={{
                  padding: '0.55rem 1.15rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <Copy size={14} />
                <span>{prCopied ? 'Copied Details!' : 'Copy PR Details'}</span>
              </button>

              {!prSuccessUrl && (
                <button
                  onClick={handleCreatePr}
                  disabled={creatingPr}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: creatingPr ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  {creatingPr ? (
                    <>
                      <Loader2 size={14} className="spin" />
                      <span>Pushing & Creating PR...</span>
                    </>
                  ) : (
                    <>
                      <GitPullRequest size={15} />
                      <span>Push & Create Pull Request</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
