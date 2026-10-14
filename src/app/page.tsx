'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, type NavTab } from '@/components/Sidebar';
import { OverviewView } from '@/components/OverviewView';
import { TicketsView } from '@/components/TicketsView';
import { TicketDetailModal } from '@/components/TicketDetailModal';
import { PlanReviewView } from '@/components/PlanReviewView';
import { ExecutionSessionsView } from '@/components/ExecutionSessionsView';
import { RepositoriesView } from '@/components/RepositoriesView';
import { SettingsView } from '@/components/SettingsView';
import type { LinearIssue } from '@/types/linear';
import type { RepositoryInfo } from '@/services/repo-registry';
import type { SavedPlanSummary, SavedPlanDetail, ReviewStatus } from '@/services/plan-storage';
import type { ExecutionSessionSummary } from '@/types/execution';

export default function DashboardPage() {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [statusData, setStatusData] = useState<any>(null);

  const [tickets, setTickets] = useState<LinearIssue[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  const [repositories, setRepositories] = useState<RepositoryInfo[]>([]);
  const [plans, setPlans] = useState<SavedPlanSummary[]>([]);
  const [sessions, setSessions] = useState<ExecutionSessionSummary[]>([]);

  // Selection states
  const [inspectingTicket, setInspectingTicket] = useState<LinearIssue | null>(null);
  const [targetPlanningTicket, setTargetPlanningTicket] = useState<LinearIssue | null>(null);
  const [targetPlanningPlan, setTargetPlanningPlan] = useState<SavedPlanSummary | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
      }
    } catch {
      // Ignore initial status fetch failure
    }
  }, []);

  // Fetch repositories
  const fetchRepositories = useCallback(async () => {
    try {
      const res = await fetch('/api/repositories');
      if (res.ok) {
        const data = await res.json();
        setRepositories(data.repositories || []);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Fetch saved plans
  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/plans');
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Fetch execution sessions
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Fetch Linear tickets
  const fetchTickets = useCallback(async () => {
    setLoadingTickets(true);
    setTicketsError(null);
    try {
      const res = await fetch('/api/tickets');
      const data = await res.json();
      if (!res.ok) {
        setTicketsError(data.error || 'Failed to fetch tickets');
      } else {
        setTickets(data.issues || []);
      }
    } catch (err: unknown) {
      setTicketsError((err as Error).message || 'Network failure fetching tickets');
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStatus();
    fetchRepositories();
    fetchPlans();
    fetchTickets();
    fetchSessions();
  }, [fetchStatus, fetchRepositories, fetchPlans, fetchTickets, fetchSessions]);

  const handleStartPlanning = (ticket: LinearIssue) => {
    setTargetPlanningTicket(ticket);
    setTargetPlanningPlan(null);
    setCurrentTab('plans');
  };

  const handleSelectPlan = (plan: SavedPlanSummary) => {
    setTargetPlanningPlan(plan);
    setTargetPlanningTicket(null);
    setCurrentTab('plans');
  };

  const handlePlanGenerated = (plan: SavedPlanDetail) => {
    fetchPlans();
  };

  const handleReviewUpdated = (issueId: string, status: ReviewStatus, notes?: string) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.issueIdentifier === issueId
          ? { ...p, reviewStatus: status, reviewNotes: notes, reviewUpdatedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const handleRegisterRepository = async (repoPath: string): Promise<RepositoryInfo | null> => {
    const res = await fetch('/api/repositories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoPath }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to register repository');
    }
    await fetchRepositories();
    return data.repository as RepositoryInfo;
  };

  const handleRemoveRepository = async (repoPath: string): Promise<boolean> => {
    const res = await fetch(`/api/repositories?path=${encodeURIComponent(repoPath)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to remove repository');
    }
    await fetchRepositories();
    return true;
  };

  const pendingApprovalsCount = plans.filter((p) => p.reviewStatus === 'pending').length;
  const activeSessionsCount = sessions.filter((s) => ['queued', 'running', 'verifying'].includes(s.status)).length;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        ticketCount={tickets.length}
        planCount={plans.length}
        pendingApprovalsCount={pendingApprovalsCount}
        activeSessionsCount={activeSessionsCount}
        linearConnected={Boolean(statusData?.linear?.configured)}
        antigravityReady={Boolean(statusData?.antigravity?.existsOnDisk)}
      />

      {/* Main Content Pane */}
      <main
        style={{
          flex: 1,
          height: '100vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-primary)',
          padding: '2rem 2.5rem',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {currentTab === 'overview' && (
            <OverviewView
              tickets={tickets}
              plans={plans}
              repositoriesCount={repositories.length}
              linearUser={statusData?.linear?.authenticatedUser || null}
              onNavigate={(tab) => setCurrentTab(tab)}
              onSelectTicket={(ticket) => setInspectingTicket(ticket)}
              onSelectPlan={handleSelectPlan}
            />
          )}

          {currentTab === 'tickets' && (
            <TicketsView
              tickets={tickets}
              loading={loadingTickets}
              error={ticketsError}
              onRefresh={fetchTickets}
              onSelectTicket={(ticket) => setInspectingTicket(ticket)}
              onStartPlanning={handleStartPlanning}
            />
          )}

          {currentTab === 'plans' && (
            <PlanReviewView
              tickets={tickets}
              repositories={repositories}
              plans={plans}
              selectedTicket={targetPlanningTicket}
              selectedPlan={targetPlanningPlan}
              onPlanGenerated={handlePlanGenerated}
              onReviewUpdated={handleReviewUpdated}
              onAddRepository={handleRegisterRepository}
              onExecutionStarted={(sessionId) => {
                setSelectedSessionId(sessionId);
                fetchSessions();
                setCurrentTab('sessions');
              }}
            />
          )}

          {currentTab === 'sessions' && (
            <ExecutionSessionsView
              initialSessionId={selectedSessionId}
              onNavigateToPlan={(issueId) => {
                const plan = plans.find((p) => p.issueIdentifier === issueId);
                if (plan) {
                  handleSelectPlan(plan);
                } else {
                  const ticket = tickets.find((t) => t.identifier === issueId);
                  if (ticket) handleStartPlanning(ticket);
                  else setCurrentTab('plans');
                }
              }}
            />
          )}

          {currentTab === 'repositories' && (
            <RepositoriesView
              repositories={repositories}
              onAddRepository={handleRegisterRepository}
              onRemoveRepository={handleRemoveRepository}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView statusData={statusData} />
          )}
        </div>
      </main>

      {/* Ticket Details Inspection Modal */}
      <TicketDetailModal
        ticket={inspectingTicket}
        onClose={() => setInspectingTicket(null)}
        onStartPlanning={handleStartPlanning}
      />
    </div>
  );
}
