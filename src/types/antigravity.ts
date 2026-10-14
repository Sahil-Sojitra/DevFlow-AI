import { z } from 'zod';

/**
 * Schema for token usage reported by Antigravity CLI in JSON mode.
 */
export const AntigravityUsageSchema = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  thinking_tokens: z.number().optional(),
  cache_read_tokens: z.number().optional(),
  total_tokens: z.number().optional(),
}).passthrough();

export type AntigravityUsage = z.infer<typeof AntigravityUsageSchema>;

export const AntigravityDeniedActionSchema = z.object({
  action: z.string(),
  display_name: z.string().optional(),
}).passthrough();

export type AntigravityDeniedAction = z.infer<typeof AntigravityDeniedActionSchema>;

/**
 * Schema for standard JSON output emitted by Antigravity CLI (`agy --print ... --output-format json`).
 */
export const AntigravityJsonOutputSchema = z.object({
  conversation_id: z.string().optional(),
  status: z.string().optional(),
  response: z.string().optional(),
  duration_seconds: z.number().optional(),
  num_turns: z.number().optional(),
  usage: AntigravityUsageSchema.optional(),
  denied_actions: z.array(AntigravityDeniedActionSchema).optional(),
}).passthrough();

export type AntigravityJsonOutput = z.infer<typeof AntigravityJsonOutputSchema>;

/**
 * Validation schema for prompt invocation parameters.
 */
export const AntigravityPromptOptionsSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt must not be empty')
    .max(100000, 'Prompt exceeds maximum supported length')
    .refine((val) => val.trim().length > 0, 'Prompt must not be only whitespace'),
  workingDir: z
    .string()
    .min(1, 'Working directory must not be empty'),
  timeoutMs: z
    .number()
    .int('Timeout must be an integer')
    .positive('Timeout must be positive')
    .max(600000, 'Timeout must not exceed 10 minutes')
    .optional(),
  outputFormat: z
    .enum(['json', 'text'])
    .default('json'),
  mode: z
    .enum(['accept-edits', 'auto', 'plan'])
    .optional(),
  effort: z
    .enum(['low', 'medium', 'high', 'xhigh', 'max'])
    .optional(),
  model: z
    .string()
    .optional(),
});

export type AntigravityPromptOptions = z.input<typeof AntigravityPromptOptionsSchema>;
export type AntigravityPromptResolvedOptions = z.output<typeof AntigravityPromptOptionsSchema>;

/**
 * Structured result returned by the Antigravity CLI adapter.
 */
export interface AntigravityExecutionResult {
  success: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  parsedOutput?: AntigravityJsonOutput | null;
  error?: string;
}
