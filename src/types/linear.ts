import { z } from 'zod';

/**
 * Linear user representation.
 */
export const LinearUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  displayName: z.string().optional(),
});

export type LinearUser = z.infer<typeof LinearUserSchema>;

/**
 * Linear issue label.
 */
export const LinearLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
});

export type LinearLabel = z.infer<typeof LinearLabelSchema>;

/**
 * Linear workflow state.
 */
export const LinearStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  color: z.string().optional(),
});

export type LinearState = z.infer<typeof LinearStateSchema>;

/**
 * Linear issue comment.
 */
export const LinearCommentSchema = z.object({
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
});

export type LinearComment = z.infer<typeof LinearCommentSchema>;

/**
 * Full Linear issue data model.
 */
export const LinearIssueSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
  priority: z.number().default(0),
  priorityLabel: z.string().optional(),
  url: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  state: LinearStateSchema.optional().nullable(),
  assignee: LinearUserSchema.optional().nullable(),
  labels: z.array(LinearLabelSchema).default([]),
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
  comments: z.array(LinearCommentSchema).default([]),
  parent: z
    .object({
      id: z.string(),
      identifier: z.string(),
      title: z.string(),
    })
    .optional()
    .nullable(),
  children: z
    .array(
      z.object({
        id: z.string(),
        identifier: z.string(),
        title: z.string(),
        state: z.string().optional(),
      })
    )
    .default([]),
});

export type LinearIssue = z.infer<typeof LinearIssueSchema>;

/**
 * Pagination information in Linear GraphQL connections.
 */
export const PageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().optional().nullable(),
});

export type PageInfo = z.infer<typeof PageInfoSchema>;

/**
 * GraphQL Error definition.
 */
export const GraphQLErrorItemSchema = z.object({
  message: z.string(),
  locations: z.array(z.object({ line: z.number(), column: z.number() })).optional(),
  path: z.array(z.union([z.string(), z.number()])).optional(),
  extensions: z.record(z.unknown()).optional(),
});

export type GraphQLErrorItem = z.infer<typeof GraphQLErrorItemSchema>;
