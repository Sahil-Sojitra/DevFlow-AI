import { z } from 'zod';
import { getAppConfig, type AppConfig } from '../config/env.js';
import {
  LinearUserSchema,
  LinearIssueSchema,
  PageInfoSchema,
  GraphQLErrorItemSchema,
  type LinearUser,
  type LinearIssue,
  type GraphQLErrorItem,
} from '../types/linear.js';

/**
 * Custom error hierarchy for Linear integration.
 */
export class LinearError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinearError';
  }
}

export class LinearAuthenticationError extends LinearError {
  constructor(message: string = 'Authentication failed. Please check your LINEAR_API_KEY.') {
    super(message);
    this.name = 'LinearAuthenticationError';
  }
}

export class LinearRateLimitError extends LinearError {
  constructor(message: string = 'Linear API rate limit exceeded. Please retry later.') {
    super(message);
    this.name = 'LinearRateLimitError';
  }
}

export class LinearHttpError extends LinearError {
  public readonly status: number;
  constructor(status: number, message: string) {
    super(`Linear HTTP error (${status}): ${message}`);
    this.name = 'LinearHttpError';
    this.status = status;
  }
}

export class LinearGraphQLError extends LinearError {
  public readonly errors: GraphQLErrorItem[];
  constructor(errors: GraphQLErrorItem[]) {
    const errorDetails = errors.map((e) => e.message).join('; ');
    super(`Linear GraphQL error: ${errorDetails}`);
    this.name = 'LinearGraphQLError';
    this.errors = errors;
  }
}

export class LinearTimeoutError extends LinearError {
  constructor(message: string = 'Linear API request timed out') {
    super(message);
    this.name = 'LinearTimeoutError';
  }
}

export class LinearResponseError extends LinearError {
  constructor(message: string) {
    super(`Linear response validation failed: ${message}`);
    this.name = 'LinearResponseError';
  }
}

/**
 * Helper to scrub sensitive credentials from error messages.
 */
function scrubSecrets(message: string, apiKey?: string): string {
  if (!apiKey || apiKey.length < 4) return message;
  return message.replaceAll(apiKey, '[REDACTED_API_KEY]');
}

// Internal Zod schemas for raw Linear GraphQL response nodes
const RawLabelsConnectionSchema = z
  .object({
    nodes: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          color: z.string().optional(),
        })
      )
      .default([]),
  })
  .optional()
  .nullable();

const RawCommentsConnectionSchema = z
  .object({
    nodes: z
      .array(
        z.object({
          id: z.string(),
          body: z.string(),
          createdAt: z.string(),
          user: z
            .object({
              id: z.string(),
              name: z.string(),
            })
            .optional()
            .nullable(),
        })
      )
      .default([]),
  })
  .optional()
  .nullable();

const RawChildrenConnectionSchema = z
  .object({
    nodes: z
      .array(
        z.object({
          id: z.string(),
          identifier: z.string(),
          title: z.string(),
          state: z
            .object({
              name: z.string().optional(),
            })
            .optional()
            .nullable(),
        })
      )
      .default([]),
  })
  .optional()
  .nullable();

const RawIssueNodeSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
  priority: z.number().default(0),
  priorityLabel: z.string().optional().nullable(),
  url: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  state: z
    .object({
      id: z.string(),
      name: z.string(),
      type: z.string().optional().nullable(),
      color: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  assignee: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string().optional().nullable(),
      displayName: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  labels: RawLabelsConnectionSchema,
  project: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional()
    .nullable(),
  team: z
    .object({
      id: z.string(),
      name: z.string(),
      key: z.string(),
    })
    .optional()
    .nullable(),
  comments: RawCommentsConnectionSchema,
  parent: z
    .object({
      id: z.string(),
      identifier: z.string(),
      title: z.string(),
    })
    .optional()
    .nullable(),
  children: RawChildrenConnectionSchema,
});

/**
 * Transforms a raw GraphQL issue node into our clean application LinearIssue model.
 */
function transformIssueNode(raw: z.infer<typeof RawIssueNodeSchema>): LinearIssue {
  const transformed = {
    id: raw.id,
    identifier: raw.identifier,
    title: raw.title,
    description: raw.description ?? undefined,
    priority: raw.priority,
    priorityLabel: raw.priorityLabel ?? undefined,
    url: raw.url,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    state: raw.state
      ? {
          id: raw.state.id,
          name: raw.state.name,
          type: raw.state.type ?? undefined,
          color: raw.state.color ?? undefined,
        }
      : undefined,
    assignee: raw.assignee
      ? {
          id: raw.assignee.id,
          name: raw.assignee.name,
          email: raw.assignee.email ?? undefined,
          displayName: raw.assignee.displayName ?? undefined,
        }
      : undefined,
    labels: raw.labels?.nodes ?? [],
    project: raw.project ?? undefined,
    team: raw.team ?? undefined,
    comments: (raw.comments?.nodes ?? []).map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      user: c.user ?? undefined,
    })),
    parent: raw.parent ?? undefined,
    children: (raw.children?.nodes ?? []).map((ch) => ({
      id: ch.id,
      identifier: ch.identifier,
      title: ch.title,
      state: ch.state?.name ?? undefined,
    })),
  };

  return LinearIssueSchema.parse(transformed);
}

/**
 * Read-only adapter for Linear GraphQL API.
 */
export class LinearAdapter {
  private readonly config: AppConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config?: AppConfig, fetchFn: typeof fetch = fetch) {
    this.config = config ?? getAppConfig();
    this.fetchImpl = fetchFn;
  }

  /**
   * Retrieves the authenticated user (viewer) from Linear.
   */
  public async getViewer(): Promise<LinearUser> {
    const query = `
      query Viewer {
        viewer {
          id
          name
          email
          displayName
        }
      }
    `;

    const data = await this.executeGraphQL<{ viewer: unknown }>({ query });

    const parsed = z
      .object({
        viewer: LinearUserSchema,
      })
      .safeParse(data);

    if (!parsed.success) {
      throw new LinearResponseError(`Invalid viewer response: ${parsed.error.message}`);
    }

    return parsed.data.viewer;
  }

  /**
   * Retrieves all issues assigned to the authenticated user.
   * Supports pagination across pages.
   */
  public async getAssignedIssues(options: {
    pageSize?: number;
    maxPages?: number;
  } = {}): Promise<LinearIssue[]> {
    const viewer = await this.getViewer();
    const pageSize = options.pageSize ?? 50;
    const maxPages = options.maxPages ?? 20;

    const query = `
      query AssignedIssues($filter: IssueFilter, $first: Int, $after: String) {
        issues(filter: $filter, first: $first, after: $after, orderBy: updatedAt) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            identifier
            title
            description
            priority
            priorityLabel
            url
            createdAt
            updatedAt
            state {
              id
              name
              type
              color
            }
            assignee {
              id
              name
              email
              displayName
            }
            labels {
              nodes {
                id
                name
                color
              }
            }
            project {
              id
              name
            }
            team {
              id
              name
              key
            }
            comments(first: 10) {
              nodes {
                id
                body
                createdAt
                user {
                  id
                  name
                }
              }
            }
            parent {
              id
              identifier
              title
            }
            children(first: 10) {
              nodes {
                id
                identifier
                title
                state {
                  name
                }
              }
            }
          }
        }
      }
    `;

    const allIssues: LinearIssue[] = [];
    let hasNextPage = true;
    let afterCursor: string | null = null;
    let currentPage = 0;

    const filter = {
      assignee: {
        id: {
          eq: viewer.id,
        },
      },
    };

    while (hasNextPage && currentPage < maxPages) {
      currentPage++;

      const variables: Record<string, unknown> = {
        filter,
        first: pageSize,
      };
      if (afterCursor) {
        variables.after = afterCursor;
      }

      const responseData = await this.executeGraphQL<{
        issues: {
          pageInfo: unknown;
          nodes: unknown[];
        };
      }>({ query, variables });

      const issuesConnectionSchema = z.object({
        issues: z.object({
          pageInfo: PageInfoSchema,
          nodes: z.array(RawIssueNodeSchema),
        }),
      });

      const parsed = issuesConnectionSchema.safeParse(responseData);
      if (!parsed.success) {
        throw new LinearResponseError(
          `Failed to parse issues connection on page ${currentPage}: ${parsed.error.message}`
        );
      }

      for (const node of parsed.data.issues.nodes) {
        allIssues.push(transformIssueNode(node));
      }

      hasNextPage = parsed.data.issues.pageInfo.hasNextPage;
      afterCursor = parsed.data.issues.pageInfo.endCursor ?? null;

      if (!afterCursor) {
        break;
      }
    }

    return allIssues;
  }

  /**
   * Retrieves a specific issue by its identifier (e.g., 'PRO-906') or UUID.
   */
  public async getIssue(identifierOrId: string): Promise<LinearIssue | null> {
    const trimmedId = identifierOrId.trim();
    if (!trimmedId) {
      throw new Error('Issue identifier must not be empty');
    }

    // Try direct issue(id: ...) lookup first
    const directQuery = `
      query IssueById($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          priority
          priorityLabel
          url
          createdAt
          updatedAt
          state {
            id
            name
            type
            color
          }
          assignee {
            id
            name
            email
            displayName
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          project {
            id
            name
          }
          team {
            id
            name
            key
          }
          comments(first: 50) {
            nodes {
              id
              body
              createdAt
              user {
                id
                name
              }
            }
          }
          parent {
            id
            identifier
            title
          }
          children(first: 20) {
            nodes {
              id
              identifier
              title
              state {
                name
              }
            }
          }
        }
      }
    `;

    try {
      const data = await this.executeGraphQL<{ issue: unknown }>({
        query: directQuery,
        variables: { id: trimmedId },
      });

      if (data.issue) {
        const parsed = z
          .object({
            issue: RawIssueNodeSchema,
          })
          .safeParse(data);

        if (parsed.success && parsed.data.issue) {
          return transformIssueNode(parsed.data.issue);
        }
      }
    } catch (err: unknown) {
      // If direct ID lookup threw a GraphQL "Entity not found" error, fallback to filter query below
    }

    // Fallback: Query via filter: { identifier: { eq: $identifier } }
    const filterQuery = `
      query IssueByFilter($identifier: String!) {
        issues(filter: { identifier: { eq: $identifier } }, first: 1) {
          nodes {
            id
            identifier
            title
            description
            priority
            priorityLabel
            url
            createdAt
            updatedAt
            state {
              id
              name
              type
              color
            }
            assignee {
              id
              name
              email
              displayName
            }
            labels {
              nodes {
                id
                name
                color
              }
            }
            project {
              id
              name
            }
            team {
              id
              name
              key
            }
            comments(first: 50) {
              nodes {
                id
                body
                createdAt
                user {
                  id
                  name
                }
              }
            }
            parent {
              id
              identifier
              title
            }
            children(first: 20) {
              nodes {
                id
                identifier
                title
                state {
                  name
                }
              }
            }
          }
        }
      }
    `;

    const filterData = await this.executeGraphQL<{
      issues: {
        nodes: unknown[];
      };
    }>({
      query: filterQuery,
      variables: { identifier: trimmedId },
    });

    const parsedFilter = z
      .object({
        issues: z.object({
          nodes: z.array(RawIssueNodeSchema),
        }),
      })
      .safeParse(filterData);

    if (parsedFilter.success && parsedFilter.data.issues.nodes.length > 0) {
      return transformIssueNode(parsedFilter.data.issues.nodes[0]);
    }

    return null;
  }

  /**
   * Internal helper to execute a GraphQL request with full safety and error mapping.
   */
  private async executeGraphQL<T>(params: {
    query: string;
    variables?: Record<string, unknown>;
    timeoutMs?: number;
  }): Promise<T> {
    const apiKey = this.config.linearApiKey;
    if (!apiKey || apiKey.trim().length === 0) {
      throw new LinearAuthenticationError(
        'LINEAR_API_KEY is not configured. Please set LINEAR_API_KEY in your environment or .env file.'
      );
    }

    const controller = new AbortController();
    const timeoutMs = params.timeoutMs ?? 20000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;

    try {
      response = await this.fetchImpl(this.config.linearApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
          'User-Agent': 'DevFlow-AI/0.2.0',
        },
        body: JSON.stringify({
          query: params.query,
          variables: params.variables,
        }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new LinearTimeoutError(`Linear API request timed out after ${timeoutMs}ms`);
      }
      const rawMsg = err instanceof Error ? err.message : String(err);
      throw new LinearError(`Linear network failure: ${scrubSecrets(rawMsg, apiKey)}`);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      throw new LinearAuthenticationError(
        `Linear authentication failed (HTTP ${response.status}). Verify your LINEAR_API_KEY.`
      );
    }

    if (response.status === 429) {
      throw new LinearRateLimitError(
        'Linear API rate limit exceeded (HTTP 429). Please retry after cooldown.'
      );
    }

    let responseJson: any;
    try {
      responseJson = await response.json();
    } catch (parseErr: unknown) {
      throw new LinearResponseError(
        `Failed to parse Linear response as JSON (HTTP ${response.status})`
      );
    }

    if (!response.ok) {
      const errorMsg =
        responseJson?.message || responseJson?.errors?.[0]?.message || response.statusText;
      throw new LinearHttpError(response.status, scrubSecrets(errorMsg, apiKey));
    }

    // Check for GraphQL errors
    if (responseJson.errors && Array.isArray(responseJson.errors) && responseJson.errors.length > 0) {
      const parsedErrors = z.array(GraphQLErrorItemSchema).safeParse(responseJson.errors);
      if (parsedErrors.success) {
        throw new LinearGraphQLError(parsedErrors.data);
      }
      throw new LinearError(
        `Linear GraphQL returned errors: ${scrubSecrets(JSON.stringify(responseJson.errors), apiKey)}`
      );
    }

    if (!responseJson.data) {
      throw new LinearResponseError('Linear response missing "data" property');
    }

    return responseJson.data as T;
  }
}
