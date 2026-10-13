import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env if present
dotenv.config();

/**
 * Helper to determine default CLI binary path.
 */
function getDefaultBinaryPath(): string {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    if (localAppData) {
      return path.join(localAppData, 'agy', 'bin', 'agy.exe');
    }
  }
  return 'agy';
}

/**
 * Raw environment schema.
 */
const RawEnvSchema = z.object({
  ANTIGRAVITY_BIN_PATH: z
    .string()
    .min(1)
    .optional(),
  DEVFLOW_ALLOWED_WORKING_DIRS: z
    .string()
    .optional(),
  DEVFLOW_TIMEOUT_MS: z
    .string()
    .regex(/^\d+$/, 'Timeout must be a numeric string')
    .optional(),
  DEVFLOW_INTEGRATION_TEST: z
    .enum(['true', 'false', '1', '0'])
    .optional(),
  LINEAR_API_KEY: z
    .string()
    .min(1)
    .optional(),
  LINEAR_API_URL: z
    .string()
    .url('LINEAR_API_URL must be a valid URL')
    .optional(),
  LINEAR_INTEGRATION_TEST: z
    .enum(['true', 'false', '1', '0'])
    .optional(),
  DEVFLOW_PLANS_DIR: z
    .string()
    .optional(),
});

export interface AppConfig {
  antigravityBinPath: string;
  allowedWorkingDirs: string[];
  defaultTimeoutMs: number;
  enableIntegrationTest: boolean;
  linearApiKey?: string;
  linearApiUrl: string;
  enableLinearIntegrationTest: boolean;
  plansDir: string;
}

/**
 * Parses and validates environment configuration.
 *
 * @param envSource - Optional environment dictionary override (defaults to process.env).
 * @param defaultCwd - Optional fallback workspace directory (defaults to process.cwd()).
 */
export function loadConfig(
  envSource: Record<string, string | undefined> = process.env,
  defaultCwd: string = process.cwd()
): AppConfig {
  const parsed = RawEnvSchema.parse(envSource);

  const binPath = parsed.ANTIGRAVITY_BIN_PATH && parsed.ANTIGRAVITY_BIN_PATH.trim().length > 0
    ? path.resolve(parsed.ANTIGRAVITY_BIN_PATH.trim())
    : getDefaultBinaryPath();

  const allowedDirsRaw = parsed.DEVFLOW_ALLOWED_WORKING_DIRS;
  let allowedWorkingDirs: string[];

  if (allowedDirsRaw && allowedDirsRaw.trim().length > 0) {
    allowedWorkingDirs = allowedDirsRaw
      .split(/[,;]/)
      .map((d) => d.trim())
      .filter((d) => d.length > 0)
      .map((d) => path.resolve(d));
  } else {
    // Default to resolving current working directory
    allowedWorkingDirs = [path.resolve(defaultCwd)];
  }

  const defaultTimeoutMs = parsed.DEVFLOW_TIMEOUT_MS
    ? parseInt(parsed.DEVFLOW_TIMEOUT_MS, 10)
    : 60000;

  const enableIntegrationTest =
    parsed.DEVFLOW_INTEGRATION_TEST === 'true' || parsed.DEVFLOW_INTEGRATION_TEST === '1';

  const linearApiKey = parsed.LINEAR_API_KEY?.trim() || undefined;
  const linearApiUrl = parsed.LINEAR_API_URL?.trim() || 'https://api.linear.app/graphql';
  const enableLinearIntegrationTest =
    parsed.LINEAR_INTEGRATION_TEST === 'true' || parsed.LINEAR_INTEGRATION_TEST === '1';

  const plansDir = parsed.DEVFLOW_PLANS_DIR && parsed.DEVFLOW_PLANS_DIR.trim().length > 0
    ? path.resolve(parsed.DEVFLOW_PLANS_DIR.trim())
    : path.resolve(defaultCwd, 'data', 'plans');

  return {
    antigravityBinPath: binPath,
    allowedWorkingDirs,
    defaultTimeoutMs,
    enableIntegrationTest,
    linearApiKey,
    linearApiUrl,
    enableLinearIntegrationTest,
    plansDir,
  };
}

let cachedConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

export function resetAppConfigForTesting(): void {
  cachedConfig = null;
}
