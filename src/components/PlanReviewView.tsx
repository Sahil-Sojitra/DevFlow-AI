'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FolderGit2,
  GitBranch,
  Clock,
  RotateCcw,
  Check,
  X,
  FileText,
  AlertCircle,
  Plus,
  Play,
  Terminal,
} from 'lucide-react';
import type { LinearIssue } from '@/types/linear';
import type { RepositoryInfo } from '@/services/repo-registry';
import type { SavedPlanSummary, SavedPlanDetail, ReviewStatus } from '@/services/plan-storage';
import { ExecutionConfirmationModal, type ExecutionOptions } from './ExecutionConfirmationModal';

interface PlanReviewViewProps {
  tickets: LinearIssue[];
  repositories: RepositoryInfo[];
  plans: SavedPlanSummary[];
  selectedTicket: LinearIssue | null;
  selectedPlan: SavedPlanSummary | null;
  onPlanGenerated: (plan: SavedPlanDetail) => void;
  onReviewUpdated: (issueId: string, status: ReviewStatus, notes?: string) => void;
  onAddRepository?: (repoPath: string) => Promise<RepositoryInfo | null>;
  onExecutionStarted?: (sessionId: string) => void;
}

export function PlanReviewView({
  tickets,
  repositories,
  plans,
  selectedTicket: initialTicket,
  selectedPlan: initialPlan,
  onPlanGenerated,
  onReviewUpdated,
  onAddRepository,
  onExecutionStarted,
}: PlanReviewViewProps) {
  const [selectedIssueId, setSelectedIssueId] = useState<string>(
    initialTicket?.identifier || initialPlan?.issueIdentifier || (tickets[0]?.identifier ?? '')
  );
  const [selectedRepoPath, setSelectedRepoPath] = useState<string>(
    repositories[0]?.path ?? ''
  );
  const [planDetail, setPlanDetail] = useState<SavedPlanDetail | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);

  // M4 Execution States
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [startingExecution, setStartingExecution] = useState(false);

  // Dynamic Repository addition
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [newRepoInput, setNewRepoInput] = useState('');
  const [addingRepo, setAddingRepo] = useState(false);
  const [addRepoError, setAddRepoError] = useState<string | null>(null);

  const handleAddRepo = async () => {
    if (!newRepoInput.trim()) return;
    setAddingRepo(true);
    setAddRepoError(null);
    try {
      if (onAddRepository) {
        const added = await onAddRepository(newRepoInput.trim());
        if (added) {
          setSelectedRepoPath(added.path);
          setNewRepoInput('');
          setShowAddRepo(false);
        }
      } else {
        const res = await fetch('/api/repositories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: newRepoInput.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setAddRepoError(data.error || 'Failed to add repository.');
          setAddingRepo(false);
          return;
        }
        if (data.repository) {
          setSelectedRepoPath(data.repository.path);
        }
        setNewRepoInput('');
        setShowAddRepo(false);
      }
    } catch (err: unknown) {
      setAddRepoError((err as Error).message || 'Failed to add repository.');
    } finally {
      setAddingRepo(false);
    }
  };

  // Sync selected issue if props change
  useEffect(() => {
    if (initialTicket) {
      setSelectedIssueId(initialTicket.identifier);
    } else if (initialPlan) {
      setSelectedIssueId(initialPlan.issueIdentifier);
    }
  }, [initialTicket, initialPlan]);

  // Load plan content whenever selectedIssueId changes
  useEffect(() => {
    if (!selectedIssueId) return;

    let isMounted = true;
    setLoadingPlan(true);
    setGenError(null);
    setConfirmOverwrite(false);
    setReviewSuccessMsg(null);

    fetch(`/api/plans/${selectedIssueId}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          if (data?.plan) {
            setPlanDetail(data.plan);
            setReviewNotes(data.plan.reviewNotes || '');
          } else {
            setPlanDetail(null);
          }
          setLoadingPlan(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPlanDetail(null);
          setLoadingPlan(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedIssueId]);

  // Find active repo object
  const currentRepo = repositories.find(
    (r) => r.path.toLowerCase() === selectedRepoPath.toLowerCase()
  );

  // Generate or regenerate plan
  const handleGenerate = async (overwrite: boolean = false) => {
    if (!selectedIssueId) return;

    setGenerating(true);
    setGenError(null);
    setConfirmOverwrite(false);
    setReviewSuccessMsg(null);

    try {
      const res = await fetch('/api/plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueIdentifier: selectedIssueId,
          repoPath: selectedRepoPath || undefined,
          overwrite,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.needsConfirmation) {
          setConfirmOverwrite(true);
          setGenError('A plan already exists for this issue. Confirm overwrite to replace it.');
        } else {
          setGenError(data.error || 'Failed to generate plan');
        }
        setGenerating(false);
        return;
      }

      setPlanDetail(data.plan);
      setReviewNotes('');
      onPlanGenerated(data.plan);
      setReviewSuccessMsg('Plan generated successfully!');
    } catch (err: unknown) {
      setGenError((err as Error).message || 'Network failure generating plan');
    } finally {
      setGenerating(false);
    }
  };

  // Submit review approval or rejection
  const handleReview = async (status: ReviewStatus) => {
    if (!selectedIssueId || !planDetail) return;

    try {
      const res = await fetch(`/api/plans/${selectedIssueId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          notes: reviewNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error || 'Failed to update review status');
        return;
      }

      setPlanDetail((prev) => (prev ? { ...prev, reviewStatus: status, reviewNotes } : null));
      onReviewUpdated(selectedIssueId, status, reviewNotes);
      setReviewSuccessMsg(data.message);
    } catch (err: unknown) {
      setGenError((err as Error).message || 'Failed to submit review');
    }
  };

  const handleAuthorizeExecution = async (options: ExecutionOptions) => {
    if (!planDetail) return;
    setStartingExecution(true);
    setGenError(null);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueIdentifier: planDetail.issueIdentifier,
          repoPath: selectedRepoPath || planDetail.repository,
          useIsolation: options.useIsolation,
          branchOption: options.branchOption,
          customBranchName: options.customBranchName,
          baseBranch: options.baseBranch,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error || 'Failed to start execution session');
        setShowExecutionModal(false);
        return;
      }

      setShowExecutionModal(false);
      if (onExecutionStarted) {
        onExecutionStarted(data.session.id);
      }
    } catch (err: unknown) {
      setGenError((err as Error).message || 'Failed to start execution session');
      setShowExecutionModal(false);
    } finally {
      setStartingExecution(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}
          >
            Plan Generation & Review
          </h1>
          {planDetail && (
            <span
              className="mono-chip"
              style={{
                fontSize: '0.7rem',
                padding: '0.1rem 0.45rem',
                color: 'var(--accent-primary)',
                border: '1px solid var(--accent-border)',
                backgroundColor: 'var(--accent-subtle)',
              }}
            >
              {planDetail.issueIdentifier}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
          Combine selected Linear issue requirements with local repository context to formulate an Antigravity plan.
        </p>
      </div>

      {/* Target Selection Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Ticket Picker */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem', fontFamily: 'var(--font-mono)' }}>
            LINEAR ISSUE
          </label>
          <select
            value={selectedIssueId}
            onChange={(e) => setSelectedIssueId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.65rem',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {tickets.map((t) => (
              <option key={t.id} value={t.identifier}>
                [{t.identifier}] {t.title} ({t.state?.name || 'Backlog'})
              </option>
            ))}
            {/* Also include any saved plans whose tickets might not be in the current inbox */}
            {plans
              .filter((p) => !tickets.some((t) => t.identifier === p.issueIdentifier))
              .map((p) => (
                <option key={p.issueIdentifier} value={p.issueIdentifier}>
                  [{p.issueIdentifier}] {p.title} (Saved Plan)
                </option>
              ))}
          </select>
        </div>

        {/* Repository Picker */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              TARGET REPOSITORY
            </label>
            <button
              type="button"
              onClick={() => {
                setShowAddRepo(!showAddRepo);
                setAddRepoError(null);
              }}
              style={{
                fontSize: '0.72rem',
                color: 'var(--accent-primary)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <Plus size={12} />
              <span>{showAddRepo ? 'Cancel' : '+ Add Path'}</span>
            </button>
          </div>

          {showAddRepo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <input
                  type="text"
                  placeholder="Paste local path (e.g. d:\projects\my-app)"
                  value={newRepoInput}
                  onChange={(e) => setNewRepoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddRepo();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '0.4rem 0.6rem',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.78rem',
                    outline: 'none',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddRepo}
                  disabled={addingRepo || !newRepoInput.trim()}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    opacity: addingRepo || !newRepoInput.trim() ? 0.6 : 1,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {addingRepo ? 'Validating...' : 'Add'}
                </button>
              </div>
              {addRepoError && (
                <div style={{ fontSize: '0.72rem', color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
                  {addRepoError}
                </div>
              )}
            </div>
          )}

          <select
            value={selectedRepoPath}
            onChange={(e) => setSelectedRepoPath(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.65rem',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.path}>
                {repo.name} ({repo.path})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Repository Status / Warning */}
      {currentRepo && (
        <div
          style={{
            backgroundColor: currentRepo.hasUncommittedChanges ? 'var(--warning-subtle)' : 'var(--bg-secondary)',
            border: `1px solid ${currentRepo.hasUncommittedChanges ? 'var(--warning-border)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-xs)',
            padding: '0.65rem 0.85rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            fontSize: '0.78rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GitBranch size={13} color={currentRepo.hasUncommittedChanges ? 'var(--warning)' : 'var(--text-muted)'} />
            <span style={{ color: 'var(--text-muted)' }}>Active Branch:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {currentRepo.branch}
            </span>
          </div>

          {currentRepo.hasUncommittedChanges && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--warning)', fontWeight: 500 }}>
              <AlertTriangle size={13} />
              <span>
                {currentRepo.uncommittedCount} uncommitted change(s) present.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Generation Bar & Action */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.85rem 1rem',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {planDetail ? `Plan for ${selectedIssueId} exists` : `No plan for ${selectedIssueId} yet`}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {planDetail
              ? `Generated ${new Date(planDetail.generatedAt).toLocaleDateString()} (${planDetail.branch})`
              : 'Click Generate to inspect repo context and formulate implementation tasks'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {confirmOverwrite && (
            <button
              onClick={() => handleGenerate(true)}
              disabled={generating}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'var(--danger)',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <RotateCcw size={13} />
              <span>Confirm Overwrite</span>
            </button>
          )}

          <button
            onClick={() => handleGenerate(false)}
            disabled={generating}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-primary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              opacity: generating ? 0.7 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            <Terminal size={13} className={generating ? 'animate-spin' : ''} />
            <span>{generating ? 'Synthesizing...' : planDetail ? 'Regenerate Plan' : 'Generate Plan'}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {genError && (
        <div
          style={{
            backgroundColor: 'var(--danger-subtle)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={16} />
          <span>{genError}</span>
        </div>
      )}

      {reviewSuccessMsg && (
        <div
          style={{
            backgroundColor: 'var(--success-subtle)',
            border: '1px solid var(--success)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1rem',
            color: '#86efac',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{reviewSuccessMsg}</span>
        </div>
      )}

      {/* Plan Document Viewer */}
      {loadingPlan ? (
        <div
          className="animate-pulse"
          style={{
            height: '320px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        />
      ) : planDetail ? (
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Plan Meta Banner & Review Controls */}
          <div
            style={{
              padding: '0.85rem 1.15rem',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                  {planDetail.issueIdentifier}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontFamily: 'var(--font-mono)',
                    padding: '0.1rem 0.45rem',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor:
                      planDetail.reviewStatus === 'approved'
                        ? 'var(--success-subtle)'
                        : planDetail.reviewStatus === 'rejected'
                        ? 'var(--danger-subtle)'
                        : 'var(--warning-subtle)',
                    border: `1px solid ${
                      planDetail.reviewStatus === 'approved'
                        ? 'var(--success-border)'
                        : planDetail.reviewStatus === 'rejected'
                        ? 'var(--danger-border)'
                        : 'var(--warning-border)'
                    }`,
                    color:
                      planDetail.reviewStatus === 'approved'
                        ? 'var(--success)'
                        : planDetail.reviewStatus === 'rejected'
                        ? 'var(--danger)'
                        : 'var(--warning)',
                  }}
                >
                  {planDetail.reviewStatus}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Target: {planDetail.repository} ({planDetail.branch})
              </div>
            </div>

            {/* Approval / Rejection Actions & Implementation Execution */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleReview('rejected')}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--danger-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--danger)',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--danger-subtle)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <X size={13} />
                <span>Reject</span>
              </button>

              <button
                onClick={() => handleReview('approved')}
                style={{
                  padding: '0.4rem 0.95rem',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: planDetail.reviewStatus === 'approved' ? 'var(--success-subtle)' : 'var(--success)',
                  border: planDetail.reviewStatus === 'approved' ? '1px solid var(--success-border)' : '1px solid var(--success)',
                  color: planDetail.reviewStatus === 'approved' ? 'var(--success)' : '#000',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Check size={13} />
                <span>{planDetail.reviewStatus === 'approved' ? 'Approved' : 'Approve Plan'}</span>
              </button>

              {/* M4: Controlled Implementation Trigger - only allowed when plan is approved */}
              {planDetail.reviewStatus === 'approved' && (
                <button
                  onClick={() => setShowExecutionModal(true)}
                  style={{
                    padding: '0.4rem 1.05rem',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'opacity 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  <Play size={12} fill="currentColor" />
                  <span>Start Implementation</span>
                </button>
              )}
            </div>
          </div>

          {/* Optional Review Feedback Note */}
          <div style={{ padding: '0.65rem 1.15rem', backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              type="text"
              placeholder="Developer feedback note (persisted with review decision)..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                outline: 'none',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          {/* Markdown Content Viewer */}
          <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: '550px' }}>
            <div className="markdown-body">
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  padding: 0,
                }}
              >
                {planDetail.content}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <FileText size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto' }} />
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '0.3rem' }}>
            No Plan Generated for {selectedIssueId}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '440px', margin: '0 auto 1.25rem auto' }}>
            Click &ldquo;Generate Plan&rdquo; above. Antigravity will safely inspect the repository context and generate structured implementation tasks.
          </p>
        </div>
      )}

      {/* Execution Authorization Modal */}
      <ExecutionConfirmationModal
        isOpen={showExecutionModal}
        ticket={tickets.find((t) => t.identifier === selectedIssueId) || null}
        plan={planDetail}
        repository={currentRepo || null}
        loading={startingExecution}
        onConfirm={handleAuthorizeExecution}
        onClose={() => setShowExecutionModal(false)}
      />
    </div>
  );
}
