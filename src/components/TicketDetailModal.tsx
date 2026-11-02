'use client';

import React from 'react';
import {
  X,
  ExternalLink,
  Terminal,
  Calendar,
  Tag,
  MessageSquare,
  User,
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
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '0.75rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  backgroundColor: 'var(--accent-subtle)',
                  border: '1px solid var(--accent-border)',
                  padding: '0.1rem 0.5rem',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                {ticket.identifier}
              </span>

              <span
                style={{
                  fontSize: '0.72rem',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  padding: '0.1rem 0.45rem',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                }}
              >
                {ticket.state?.name || 'Backlog'}
              </span>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  color: ticket.priority === 1 ? 'var(--danger)' : 'var(--text-muted)',
                }}
              >
                {ticket.priorityLabel || (ticket.priority > 0 ? `P${ticket.priority}` : 'No Priority')}
              </span>
            </div>

            <h2
              style={{
                fontSize: '1.05rem',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'var(--text-primary)',
                lineHeight: 1.35,
              }}
            >
              {ticket.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{
              color: 'var(--text-muted)',
              padding: '0.35rem',
              borderRadius: 'var(--radius-xs)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.65rem',
              backgroundColor: 'var(--bg-primary)',
              padding: '0.75rem 0.85rem',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.78rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Assignee</span>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                {ticket.assignee?.name || 'Unassigned'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Created</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {new Date(ticket.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Linear Link</span>
              <a
                href={ticket.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--accent-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                }}
              >
                <span>linear.app</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* Description Section */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '0.4rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Description & Requirements
            </div>
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xs)',
                padding: '0.85rem 1rem',
                fontSize: '0.82rem',
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                maxHeight: '220px',
                overflowY: 'auto',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {ticket.description || 'No description provided for this ticket.'}
            </div>
          </div>

          {/* Comments Section */}
          {ticket.comments.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Comments ({ticket.comments.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {ticket.comments.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-xs)',
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                        {c.user?.name || 'Author'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{new Date(c.createdAt).toLocaleDateString()}</span>
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
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-primary)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
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
              padding: '0.45rem 1rem',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <Terminal size={13} strokeWidth={2.5} />
            <span>Generate Plan</span>
          </button>
        </div>
      </div>
    </div>
  );
}
