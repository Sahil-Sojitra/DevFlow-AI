import { describe, it, expect } from 'vitest';
import { LinearAdapter } from '../../src/adapters/linear.js';
import { getAppConfig } from '../../src/config/env.js';

const config = getAppConfig();
const shouldRunLinearIntegration =
  Boolean(process.env.LINEAR_INTEGRATION_TEST === 'true' && config.linearApiKey);

describe.runIf(shouldRunLinearIntegration)('Linear GraphQL Live Integration Test', () => {
  it('connects to Linear, authenticates viewer, and retrieves assigned issues', async () => {
    const adapter = new LinearAdapter(config);

    const viewer = await adapter.getViewer();
    expect(viewer.id).toBeDefined();
    expect(viewer.name).toBeDefined();

    const issues = await adapter.getAssignedIssues({ pageSize: 5, maxPages: 1 });
    expect(Array.isArray(issues)).toBe(true);
  }, 20000);
});
