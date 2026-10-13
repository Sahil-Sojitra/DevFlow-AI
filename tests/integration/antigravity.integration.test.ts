import { describe, it, expect } from 'vitest';
import { AntigravityAdapter } from '../../src/adapters/antigravity.js';
import { getAppConfig } from '../../src/config/env.js';

const config = getAppConfig();
const shouldRunIntegration =
  process.env.DEVFLOW_INTEGRATION_TEST === 'true' || config.enableIntegrationTest;

describe.runIf(shouldRunIntegration)('Antigravity CLI Live Integration Test', () => {
  it('sends a harmless read-only prompt ("Respond with pong") and captures JSON response', async () => {
    const adapter = new AntigravityAdapter(config);
    const targetDir = config.allowedWorkingDirs[0] ?? process.cwd();

    const result = await adapter.executePrompt({
      workingDir: targetDir,
      prompt: 'Respond with pong',
      outputFormat: 'json',
      timeoutMs: 30000,
    });

    expect(result.exitCode).toBe(0);
    expect(result.success).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.parsedOutput).toBeDefined();
    expect(result.parsedOutput?.response?.toLowerCase()).toContain('pong');
    expect(result.parsedOutput?.status).toBe('SUCCESS');
  }, 45000);
});
