import { describe, it, expect, vi } from 'vitest';
import {
  LinearAdapter,
  LinearAuthenticationError,
  LinearRateLimitError,
  LinearHttpError,
  LinearGraphQLError,
  LinearTimeoutError,
  LinearResponseError,
} from '../../src/adapters/linear.js';
import type { AppConfig } from '../../src/config/env.js';

describe('LinearAdapter', () => {
  const secretKey = 'lin_api_supersecret123456';
  const mockConfig: AppConfig = {
    antigravityBinPath: 'C:\\agy.exe',
    allowedWorkingDirs: ['C:\\workspace'],
    defaultTimeoutMs: 10000,
    enableIntegrationTest: false,
    linearApiKey: secretKey,
    linearApiUrl: 'https://api.linear.app/graphql',
    enableLinearIntegrationTest: false,
    plansDir: 'C:\\workspace\\data\\plans',
  };

  it('throws LinearAuthenticationError when LINEAR_API_KEY is missing', async () => {
    const configWithoutKey = { ...mockConfig, linearApiKey: undefined };
    const adapter = new LinearAdapter(configWithoutKey);

    await expect(adapter.getViewer()).rejects.toThrow(LinearAuthenticationError);
  });

  it('retrieves viewer identity successfully', async () => {
    const mockViewer = {
      id: 'usr_123',
      name: 'Alice Developer',
      email: 'alice@example.com',
      displayName: 'Alice',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          viewer: mockViewer,
        },
      }),
    });

    const adapter = new LinearAdapter(mockConfig, mockFetch as any);
    const viewer = await adapter.getViewer();

    expect(viewer).toEqual(mockViewer);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('https://api.linear.app/graphql');
    expect(callArgs[1].headers.Authorization).toBe(secretKey);
  });

  it('filters assigned issues by authenticated viewer id', async () => {
    const mockViewer = { id: 'usr_456', name: 'Bob Developer' };

    const mockIssuesResponse = {
      data: {
        issues: {
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
          nodes: [
            {
              id: 'iss_1',
              identifier: 'PRO-101',
              title: 'Implement OAuth Login',
              description: 'Add OAuth2 flow with Google',
              priority: 1,
              priorityLabel: 'Urgent',
              url: 'https://linear.app/issue/PRO-101',
              createdAt: '2026-10-10T00:00:00Z',
              updatedAt: '2026-10-11T00:00:00Z',
              state: { id: 'st_1', name: 'In Progress', type: 'started' },
              assignee: mockViewer,
              labels: { nodes: [{ id: 'lbl_1', name: 'Security' }] },
              comments: { nodes: [] },
              children: { nodes: [] },
            },
          ],
        },
      },
    };

    let fetchCall = 0;
    const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
      fetchCall++;
      const body = JSON.parse(opts.body);
      if (body.query.includes('query Viewer')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { viewer: mockViewer } }),
        };
      }
      // Assert that assignee id filter was correctly set to viewer id
      expect(body.variables.filter.assignee.id.eq).toBe('usr_456');
      return {
        ok: true,
        status: 200,
        json: async () => mockIssuesResponse,
      };
    });

    const adapter = new LinearAdapter(mockConfig, mockFetch as any);
    const issues = await adapter.getAssignedIssues();

    expect(issues.length).toBe(1);
    expect(issues[0].identifier).toBe('PRO-101');
    expect(issues[0].title).toBe('Implement OAuth Login');
    expect(issues[0].state?.name).toBe('In Progress');
    expect(issues[0].labels[0].name).toBe('Security');
  });

  it('handles pagination across multiple pages', async () => {
    const mockViewer = { id: 'usr_789', name: 'Charlie Developer' };

    const page1Response = {
      data: {
        issues: {
          pageInfo: { hasNextPage: true, endCursor: 'cursor_page_1' },
          nodes: [
            {
              id: 'iss_1',
              identifier: 'PRO-201',
              title: 'Ticket Page 1',
              priority: 2,
              url: 'https://linear.app/issue/PRO-201',
              createdAt: '2026-10-01T00:00:00Z',
              updatedAt: '2026-10-01T00:00:00Z',
            },
          ],
        },
      },
    };

    const page2Response = {
      data: {
        issues: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            {
              id: 'iss_2',
              identifier: 'PRO-202',
              title: 'Ticket Page 2',
              priority: 3,
              url: 'https://linear.app/issue/PRO-202',
              createdAt: '2026-10-02T00:00:00Z',
              updatedAt: '2026-10-02T00:00:00Z',
            },
          ],
        },
      },
    };

    const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.query.includes('query Viewer')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { viewer: mockViewer } }),
        };
      }
      if (body.variables.after === 'cursor_page_1') {
        return {
          ok: true,
          status: 200,
          json: async () => page2Response,
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => page1Response,
      };
    });

    const adapter = new LinearAdapter(mockConfig, mockFetch as any);
    const issues = await adapter.getAssignedIssues({ pageSize: 1, maxPages: 5 });

    expect(issues.length).toBe(2);
    expect(issues[0].identifier).toBe('PRO-201');
    expect(issues[1].identifier).toBe('PRO-202');
  });

  it('retrieves issue by identifier with comments and acceptance criteria', async () => {
    const mockIssue = {
      id: 'iss_906',
      identifier: 'PRO-906',
      title: 'Support Deep Links in Navigation',
      description: 'Acceptance Criteria:\n1. Deep links redirect smoothly\n2. Fallback to 404',
      priority: 1,
      priorityLabel: 'High',
      url: 'https://linear.app/issue/PRO-906',
      createdAt: '2026-10-12T00:00:00Z',
      updatedAt: '2026-10-13T00:00:00Z',
      state: { id: 'st_2', name: 'Todo' },
      comments: {
        nodes: [
          {
            id: 'cmt_1',
            body: 'Make sure Android custom schemes also work',
            createdAt: '2026-10-12T12:00:00Z',
            user: { id: 'u_1', name: 'Product Manager' },
          },
        ],
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { issue: mockIssue } }),
    });

    const adapter = new LinearAdapter(mockConfig, mockFetch as any);
    const issue = await adapter.getIssue('PRO-906');

    expect(issue).not.toBeNull();
    expect(issue?.identifier).toBe('PRO-906');
    expect(issue?.comments.length).toBe(1);
    expect(issue?.comments[0].body).toContain('Android custom schemes');
  });

  it('handles HTTP 401 and 403 authentication failures', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Invalid token' }),
    });

    const adapter = new LinearAdapter(mockConfig, mockFetch as any);
    await expect(adapter.getViewer()).rejects.toThrow(LinearAuthenticationError);
  });

  it('handles HTTP 429 rate limiting', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ message: 'Rate limit exceeded' }),
    });

    const adapter = new LinearAdapter(mockConfig, mockFetch as any);
    await expect(adapter.getViewer()).rejects.toThrow(LinearRateLimitError);
  });

  it('handles HTTP 500 server errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ message: 'Linear backend crash' }),
    });

    const adapter = new LinearAdapter(mockConfig, mockFetch as any);
    await expect(adapter.getViewer()).rejects.toThrow(LinearHttpError);
  });

  it('handles GraphQL errors in response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        errors: [{ message: 'Field "unknownField" does not exist' }],
      }),
    });

    const adapter = new LinearAdapter(mockConfig, mockFetch as any);
    await expect(adapter.getViewer()).rejects.toThrow(LinearGraphQLError);
  });

  it('handles network timeouts', async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const adapter = new LinearAdapter(mockConfig, mockFetch as any);
    await expect(adapter.getViewer()).rejects.toThrow(LinearTimeoutError);
  });

  it('handles malformed JSON and response schema errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          viewer: {
            // Missing required 'id' and 'name'
            email: 'missing@id.com',
          },
        },
      }),
    });

    const adapter = new LinearAdapter(mockConfig, mockFetch as any);
    await expect(adapter.getViewer()).rejects.toThrow(LinearResponseError);
  });

  it('never leaks the API key in thrown error messages', async () => {
    const mockFetch = vi.fn().mockRejectedValue(
      new Error(`Failed request to https://api.linear.app with key ${secretKey}`)
    );

    const adapter = new LinearAdapter(mockConfig, mockFetch as any);
    try {
      await adapter.getViewer();
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      const msg = (err as Error).message;
      expect(msg).not.toContain(secretKey);
      expect(msg).toContain('[REDACTED_API_KEY]');
    }
  });
});
