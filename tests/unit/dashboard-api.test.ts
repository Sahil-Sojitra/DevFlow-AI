import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getStatus } from '../../src/app/api/status/route.js';
import { POST as reviewPlan } from '../../src/app/api/plans/[id]/review/route.js';
import { POST as generatePlan } from '../../src/app/api/plans/generate/route.js';

describe('Dashboard API Endpoints', () => {
  describe('GET /api/status - Secret Redaction', () => {
    it('returns configuration status without exposing LINEAR_API_KEY or env secrets', async () => {
      const response = await getStatus();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.status).toBe('ok');
      expect(json.antigravity).toBeDefined();
      expect(json.linear).toBeDefined();

      // Crucial security assertions: Secrets must never be exposed
      const stringified = JSON.stringify(json);
      expect(stringified).not.toContain('lin_api_');
      expect((json as any).LINEAR_API_KEY).toBeUndefined();
      expect((json as any).linearApiKey).toBeUndefined();
    });
  });

  describe('POST /api/plans/generate - Input Validation', () => {
    it('rejects invalid JSON body', async () => {
      const req = new NextRequest('http://localhost:3000/api/plans/generate', {
        method: 'POST',
        body: 'invalid-non-json',
      });

      const res = await generatePlan(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid JSON');
    });

    it('rejects missing or empty issueIdentifier', async () => {
      const req = new NextRequest('http://localhost:3000/api/plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueIdentifier: '' }),
      });

      const res = await generatePlan(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('issueIdentifier is required');
    });
  });

  describe('POST /api/plans/[id]/review - Review Validation & No-Implementation Guarantee', () => {
    it('rejects invalid review status values', async () => {
      const req = new NextRequest('http://localhost:3000/api/plans/PRO-999/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'implemented' }), // 'implemented' is invalid
      });

      const res = await reviewPlan(req, { params: Promise.resolve({ id: 'PRO-999' }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Validation error');
    });

    it('returns 404 when attempting to review non-existent plan', async () => {
      const req = new NextRequest('http://localhost:3000/api/plans/NON-EXISTENT/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      const res = await reviewPlan(req, { params: Promise.resolve({ id: 'NON-EXISTENT' }) });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('Cannot review non-existent plan');
    });
  });
});
