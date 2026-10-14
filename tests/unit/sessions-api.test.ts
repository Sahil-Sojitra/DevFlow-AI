import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as listSessions, POST as createSession } from '../../src/app/api/sessions/route.js';
import { GET as getSessionDetail } from '../../src/app/api/sessions/[id]/route.js';
import { POST as cancelSession } from '../../src/app/api/sessions/[id]/cancel/route.js';

describe('Sessions API Endpoints', () => {
  describe('GET /api/sessions', () => {
    it('returns session list without exposing secrets', async () => {
      const response = await listSessions();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.sessions).toBeDefined();
      expect(Array.isArray(json.sessions)).toBe(true);

      const stringified = JSON.stringify(json);
      expect(stringified).not.toContain('lin_api_');
    });
  });

  describe('POST /api/sessions - Validation', () => {
    it('rejects invalid non-JSON payload with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: 'invalid-non-json',
      });

      const res = await createSession(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid JSON');
    });

    it('rejects missing issueIdentifier with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueIdentifier: '' }),
      });

      const res = await createSession(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('issueIdentifier is required');
    });

    it('returns 404 when plan for issue does not exist', async () => {
      const req = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueIdentifier: 'NON_EXISTENT_ISSUE_123' }),
      });

      const res = await createSession(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('No implementation plan found');
    });
  });

  describe('GET /api/sessions/[id]', () => {
    it('returns 404 for non-existent session ID', async () => {
      const req = new NextRequest('http://localhost:3000/api/sessions/sess_missing_999');
      const res = await getSessionDetail(req, {
        params: Promise.resolve({ id: 'sess_missing_999' }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('not found');
    });
  });

  describe('POST /api/sessions/[id]/cancel', () => {
    it('returns 404 when attempting to cancel non-existent session', async () => {
      const req = new NextRequest('http://localhost:3000/api/sessions/sess_missing_999/cancel', {
        method: 'POST',
      });
      const res = await cancelSession(req, {
        params: Promise.resolve({ id: 'sess_missing_999' }),
      });
      expect(res.status).toBe(404);
    });
  });
});
