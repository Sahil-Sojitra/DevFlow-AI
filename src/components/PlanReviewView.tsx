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
} from 'lucide-react';
import type { LinearIssue } from '@/types/linear';
import type { RepositoryInfo } from '@/services/repo-registry';
import type { SavedPlanSummary, SavedPlanDetail, ReviewStatus } from '@/services/plan-storage';

interface PlanReviewViewProps {
  tickets: LinearIssue[];
  repositories: RepositoryInfo[];
  plans: SavedPlanSummary[];
  selectedTicket: LinearIssue | null;
  selectedPlan: SavedPlanSummary | null;
  onPlanGenerated: (plan: SavedPlanDetail) => void;
  onReviewUpdated: (issueId: string, status: ReviewStatus, notes?: string) => void;
  onAddRepository?: (repoPath: string) => Promise<RepositoryInfo | null>;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Plan Generation & Review</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Combine selected Linear issue requirements with local repository context to create and approve an Antigravity plan.
        </p>
      </div>

      {/* Target Selection Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Ticket Picker */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
            Linear Issue
          </label>
          <select
            value={selectedIssueId}
            onChange={(e) => setSelectedIssueId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              outline: 'none',
              cursor: 'pointer',
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Target Repository (Whitelisted)
            </label>
            <button
              type="button"
              onClick={() => {
                setShowAddRepo(!showAddRepo);
                setAddRepoError(null);
              }}
              style={{
                fontSize: '0.75rem',
                color: 'var(--accent-primary)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              <span>{showAddRepo ? 'Cancel' : '+ Add Local Repo'}</span>
            </button>
          </div>

          {showAddRepo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="Paste local path (e.g. d:\D drive\Sobha\RFI\fe-rfi-classification)"
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
                    padding: '0.45rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddRepo}
                  disabled={addingRepo || !newRepoInput.trim()}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    opacity: addingRepo || !newRepoInput.trim() ? 0.6 : 1,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {addingRepo ? 'Validating...' : 'Add & Select'}
                </button>
              </div>
              {addRepoError && (
                <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>
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
              padding: '0.6rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              outline: 'none',
              cursor: 'pointer',
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
            border: `1px solid ${currentRepo.hasUncommittedChanges ? 'var(--warning)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <GitBranch size={15} color={currentRepo.hasUncommittedChanges ? 'var(--warning)' : 'var(--text-muted)'} />
            <span style={{ color: 'var(--text-secondary)' }}>Branch:</span>
            <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {currentRepo.branch}
            </span>
          </div>

          {currentRepo.hasUncommittedChanges && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--warning)', fontWeight: 500 }}>
              <AlertTriangle size={14} />
              <span>
                Warning: Repository has {currentRepo.uncommittedCount} uncommitted change(s).
              </span>
            </div>
          )}
        </div>
      )}

      {/* Generation Bar & Action */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#fff' }}>
            {planDetail ? `Plan for ${selectedIssueId} exists` : `No plan for ${selectedIssueId} yet`}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {planDetail
              ? `Generated on ${new Date(planDetail.generatedAt).toLocaleString()} (${planDetail.branch})`
              : 'Click Generate to inspect codebase and formulate implementation steps'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {confirmOverwrite && (
            <button
              onClick={() => handleGenerate(true)}
              disabled={generating}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--danger)',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <RotateCcw size={14} />
              <span>Confirm Overwrite</span>
            </button>
          )}

          <button
            onClick={() => handleGenerate(false)}
            disabled={generating}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 0 14px var(--accent-glow)',
              opacity: generating ? 0.7 : 1,
            }}
          >
            <Sparkles size={16} className={generating ? 'animate-spin' : ''} />
            <span>{generating ? 'Synthesizing Plan...' : planDetail ? 'Regenerate Plan' : 'Generate Plan'}</span>
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
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Plan Meta Banner & Review Controls */}
          <div
            style={{
              padding: '1rem 1.5rem',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                  {planDetail.issueIdentifier}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '0.15rem 0.55rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor:
                      planDetail.reviewStatus === 'approved'
                        ? 'var(--success-subtle)'
                        : planDetail.reviewStatus === 'rejected'
                        ? 'var(--danger-subtle)'
                        : 'var(--warning-subtle)',
                    color:
                      planDetail.reviewStatus === 'approved'
                        ? 'var(--success)'
                        : planDetail.reviewStatus === 'rejected'
                        ? 'var(--danger)'
                        : 'var(--warning)',
                  }}
                >
                  Status: {planDetail.reviewStatus}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Target repo: {planDetail.repository} (branch: {planDetail.branch})
              </div>
            </div>

            {/* Approval / Rejection Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => handleReview('rejected')}
                style={{
                  padding: '0.45rem 0.95rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--danger)',
                  color: 'var(--danger)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--danger-subtle)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <X size={15} />
                <span>Reject Plan</span>
              </button>
              <button
                onClick={() => handleReview('approved')}
                style={{
                  padding: '0.45rem 1.15rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--success)',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 0 12px var(--success-subtle)',
                }}
              >
                <Check size={15} />
                <span>Approve Plan</span>
              </button>
            </div>
          </div>

          {/* Optional Review Feedback Note */}
          <div style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              type="text"
              placeholder="Add optional developer notes or review feedback (persisted with decision)..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none',
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
    </div>
  );
}
