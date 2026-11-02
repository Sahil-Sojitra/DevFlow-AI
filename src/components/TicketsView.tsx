'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import type { LinearIssue } from '@/types/linear';

interface TicketsViewProps {
  tickets: LinearIssue[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectTicket: (ticket: LinearIssue) => void;
  onStartPlanning: (ticket: LinearIssue) => void;
}

export function TicketsView({
  tickets,
  loading,
  error,
  onRefresh,
  onSelectTicket,
  onStartPlanning,
}: TicketsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStateFilter, setSelectedStateFilter] = useState('ALL');

  // Extract unique state names
  const availableStates = useMemo(() => {
    const states = new Set<string>();
    tickets.forEach((t) => {
      if (t.state?.name) states.add(t.state.name);
    });
    return Array.from(states);
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesSearch =
        ticket.identifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ticket.description && ticket.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ticket.labels.some((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesState =
        selectedStateFilter === 'ALL' || ticket.state?.name === selectedStateFilter;

      return matchesSearch && matchesState;
    });
  }, [tickets, searchQuery, selectedStateFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem',
        }}
      >
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
              Ticket Inbox
            </h1>
            <span
              className="mono-chip"
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                padding: '0.1rem 0.45rem',
              }}
            >
              {tickets.length} assigned
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            Assigned Linear tickets staged for autonomous repository implementation planning.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.45rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontSize: '0.8rem',
            fontWeight: 500,
            backgroundColor: 'var(--bg-secondary)',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          backgroundColor: 'var(--bg-secondary)',
          padding: '0.65rem 0.85rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Filter by ID (e.g. SAH-5), title, or label..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 2.15rem',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        {availableStates.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Filter size={13} color="var(--text-muted)" />
            <select
              value={selectedStateFilter}
              onChange={(e) => setSelectedStateFilter(e.target.value)}
              style={{
                padding: '0.45rem 0.65rem',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <option value="ALL">All States ({tickets.length})</option>
              {availableStates.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            backgroundColor: 'var(--danger-subtle)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <AlertTriangle size={16} color="var(--danger)" />
            <span style={{ fontSize: '0.82rem', color: '#fca5a5' }}>{error}</span>
          </div>
          <button
            onClick={onRefresh}
            style={{
              padding: '0.3rem 0.65rem',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--danger)',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && tickets.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="animate-pulse"
              style={{
                height: '72px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredTickets.length === 0 && !error && (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            {tickets.length === 0 ? 'No assigned tickets found' : 'No tickets match filter'}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: '380px', margin: '0 auto' }}>
            {tickets.length === 0
              ? 'There are currently no open tickets assigned to your Linear user account.'
              : 'Try clearing your search query or switching state filter.'}
          </p>
        </div>
      )}

      {/* Ticket List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filteredTickets.map((ticket) => {
          const priorityLabel =
            ticket.priorityLabel || (ticket.priority === 1 ? 'Urgent' : ticket.priority === 2 ? 'High' : ticket.priority === 3 ? 'Medium' : ticket.priority === 4 ? 'Low' : 'None');

          return (
            <div
              key={ticket.id}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.85rem 1rem',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                transition: 'border-color 0.15s ease, background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              }}
            >
              {/* Ticket Meta & Title */}
              <div
                style={{ flex: 1, minWidth: '240px', cursor: 'pointer' }}
                onClick={() => onSelectTicket(ticket)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--accent-primary)',
                      backgroundColor: 'var(--accent-subtle)',
                      border: '1px solid var(--accent-border)',
                      padding: '0.1rem 0.45rem',
                      borderRadius: 'var(--radius-xs)',
                    }}
                  >
                    {ticket.identifier}
                  </span>

                  <span
                    style={{
                      fontSize: '0.7rem',
                      backgroundColor: 'var(--bg-elevated)',
                      padding: '0.1rem 0.45rem',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                      fontWeight: 500,
                    }}
                  >
                    {ticket.state?.name || 'Backlog'}
                  </span>

                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: ticket.priority === 1 ? 'var(--danger)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {priorityLabel}
                  </span>

                  {ticket.comments.length > 0 && (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <MessageSquare size={11} />
                      <span>{ticket.comments.length}</span>
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {ticket.title}
                </div>

                {/* Labels */}
                {ticket.labels.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {ticket.labels.map((l) => (
                      <span
                        key={l.id}
                        style={{
                          fontSize: '0.68rem',
                          backgroundColor: 'var(--bg-elevated)',
                          color: 'var(--text-muted)',
                          padding: '0.05rem 0.35rem',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--border-subtle)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {l.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={() => onSelectTicket(ticket)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    backgroundColor: 'var(--bg-tertiary)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                  Details
                </button>

                <button
                  onClick={() => onStartPlanning(ticket)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.85rem',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    transition: 'opacity 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  <Terminal size={12} strokeWidth={2.5} />
                  <span>Plan</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
