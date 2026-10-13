'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Sparkles,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>My Linear Tickets</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Assigned issues retrieved from Linear. Select any ticket to inspect or generate an implementation plan.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 0.95rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            fontWeight: 500,
            backgroundColor: 'var(--bg-secondary)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          backgroundColor: 'var(--bg-secondary)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search
            size={16}
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
            placeholder="Search tickets by identifier, title, keyword, label..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem 0.5rem 2.25rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>

        {availableStates.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={15} color="var(--text-muted)" />
            <select
              value={selectedStateFilter}
              onChange={(e) => setSelectedStateFilter(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer',
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

      {/* Error Banner */}
      {error && (
        <div
          style={{
            backgroundColor: 'var(--danger-subtle)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={18} color="var(--danger)" />
            <span style={{ fontSize: '0.88rem', color: '#fca5a5' }}>{error}</span>
          </div>
          <button
            onClick={onRefresh}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--danger)',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && tickets.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="animate-pulse"
              style={{
                height: '84px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
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
            padding: '3.5rem 2rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '0.35rem' }}>
            {tickets.length === 0 ? 'No assigned tickets found' : 'No tickets match your filter'}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '400px', margin: '0 auto' }}>
            {tickets.length === 0
              ? 'There are currently no open tickets assigned to your Linear user account.'
              : 'Try clearing your search query or changing the state filter.'}
          </p>
        </div>
      )}

      {/* Ticket List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filteredTickets.map((ticket) => {
          const priorityLabel =
            ticket.priorityLabel || (ticket.priority === 1 ? 'Urgent' : ticket.priority === 2 ? 'High' : ticket.priority === 3 ? 'Medium' : ticket.priority === 4 ? 'Low' : 'None');

          return (
            <div
              key={ticket.id}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                transition: 'all 0.15s ease',
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
              {/* Ticket Information */}
              <div
                style={{ flex: 1, cursor: 'pointer' }}
                onClick={() => onSelectTicket(ticket)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--accent-primary)',
                      backgroundColor: 'var(--accent-subtle)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {ticket.identifier}
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      backgroundColor: 'var(--bg-elevated)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                    }}
                  >
                    {ticket.state?.name || 'Backlog'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: ticket.priority === 1 ? 'var(--danger)' : 'var(--text-muted)',
                      fontWeight: 500,
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
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <MessageSquare size={12} />
                      <span>{ticket.comments.length}</span>
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  {ticket.title}
                </div>

                {/* Labels */}
                {ticket.labels.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {ticket.labels.map((l) => (
                      <span
                        key={l.id}
                        style={{
                          fontSize: '0.68rem',
                          backgroundColor: 'var(--bg-elevated)',
                          color: 'var(--text-muted)',
                          padding: '0.05rem 0.4rem',
                          borderRadius: 'var(--radius-full)',
                        }}
                      >
                        {l.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  onClick={() => onSelectTicket(ticket)}
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                  View Details
                </button>
                <button
                  onClick={() => onStartPlanning(ticket)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    boxShadow: '0 0 12px var(--accent-glow)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-primary)')}
                >
                  <Sparkles size={14} />
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
