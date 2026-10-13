'use client';

import React from 'react';
import {
  X,
  ExternalLink,
  Sparkles,
  Calendar,
  Tag,
  MessageSquare,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import type { LinearIssue } from '@/types/linear';

interface TicketDetailModalProps {
  ticket: LinearIssue | null;
  onClose: () => void;
  onStartPlanning: (ticket: LinearIssue) => void;
}

export function TicketDetailModal({
  ticket,
  onClose,
  onStartPlanning,
}: TicketDetailModalProps) {
  if (!ticket) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--accent-primary)',
                  backgroundColor: 'var(--accent-subtle)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {ticket.identifier}
              </span>
              <span
                style={{
                  fontSize: '0.78rem',
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                {ticket.state?.name || 'Backlog'}
              </span>
              <span
                style={{
                  fontSize: '0.78rem',
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                  color: ticket.priority === 1 ? 'var(--danger)' : 'var(--text-muted)',
                  fontWeight: 600,
                }}
              >
                {ticket.priorityLabel || (ticket.priority > 0 ? `P${ticket.priority}` : 'No Priority')}
              </span>
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
              {ticket.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              color: 'var(--text-muted)',
              padding: '0.35rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              backgroundColor: 'var(--bg-primary)',
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.82rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Assignee</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {ticket.assignee?.name || 'Unassigned'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Created</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {new Date(ticket.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Labels</span>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                {ticket.labels.length > 0 ? (
                  ticket.labels.map((l) => (
                    <span
                      key={l.id}
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        color: 'var(--text-secondary)',
                        padding: '0.1rem 0.45rem',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.72rem',
                      }}
                    >
                      {l.name}
                    </span>
                  ))
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>None</span>
                )}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Linear Link</span>
              <a
                href={ticket.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--accent-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontWeight: 500,
                }}
              >
                <span>Open in Linear</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Description Section */}
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Description
            </h3>
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                fontSize: '0.88rem',
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                maxHeight: '260px',
                overflowY: 'auto',
              }}
            >
              {ticket.description || 'No description provided for this ticket.'}
            </div>
          </div>

          {/* Comments Section */}
          {ticket.comments.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Comments & Clarifications ({ticket.comments.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ticket.comments.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.85rem 1rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {c.user?.name || 'Author'}
                      </span>
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {c.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-primary)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              onStartPlanning(ticket);
            }}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 0 12px var(--accent-glow)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-primary)')}
          >
            <Sparkles size={16} />
            <span>Generate Plan with Antigravity</span>
          </button>
        </div>
      </div>
    </div>
  );
}
