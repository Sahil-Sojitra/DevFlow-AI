import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  PlanStorageService,
  DuplicatePlanGenerationError,
} from '../../src/services/plan-storage.js';
import type { AppConfig } from '../../src/config/env.js';

describe('PlanStorageService', () => {
  const testRoot = path.resolve('data', 'test-plan-storage');
  const plansDir = path.join(testRoot, 'plans');

  const mockConfig: AppConfig = {
    antigravityBinPath: 'C:\\agy.exe',
    allowedWorkingDirs: [testRoot],
    defaultTimeoutMs: 10000,
    enableIntegrationTest: false,
    linearApiUrl: 'https://api.linear.app/graphql',
    enableLinearIntegrationTest: false,
    plansDir,
  };

  beforeEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(plansDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('prevents path traversal when reading plan by identifier', () => {
    const storage = new PlanStorageService(mockConfig);

    // Path traversal attempt
    const result = storage.getPlan('../../../windows/system32/cmd');
    expect(result).toBeNull();
  });

  it('saves, reads, and updates plan review states', () => {
    const storage = new PlanStorageService(mockConfig);

    // Create a plan file
    const planFile = path.join(plansDir, 'PRO-100.md');
    fs.writeFileSync(
      planFile,
      `---
issue: "PRO-100"
title: "Sample Task"
repository: "C:/test"
branch: "main"
generated_at: "2026-10-13T10:00:00Z"
---

# Plan Body
`
    );

    // Initial state before review is pending
    const initialPlan = storage.getPlan('PRO-100');
    expect(initialPlan).not.toBeNull();
    expect(initialPlan?.reviewStatus).toBe('pending');

    // Approve the plan
    storage.saveReview('PRO-100', 'approved', 'Looks good to proceed');

    const approvedPlan = storage.getPlan('PRO-100');
    expect(approvedPlan?.reviewStatus).toBe('approved');
    expect(approvedPlan?.reviewNotes).toBe('Looks good to proceed');

    // Reject the plan
    storage.saveReview('PRO-100', 'rejected', 'Needs more testing scenarios');

    const rejectedPlan = storage.getPlan('PRO-100');
    expect(rejectedPlan?.reviewStatus).toBe('rejected');
    expect(rejectedPlan?.reviewNotes).toBe('Needs more testing scenarios');
  });

  it('lists saved plans sorted by generation timestamp', () => {
    const storage = new PlanStorageService(mockConfig);

    fs.writeFileSync(
      path.join(plansDir, 'PRO-101.md'),
      `---
issue: "PRO-101"
title: "Old Plan"
repository: "C:/test"
branch: "main"
generated_at: "2026-10-10T10:00:00Z"
---
`
    );

    fs.writeFileSync(
      path.join(plansDir, 'PRO-102.md'),
      `---
issue: "PRO-102"
title: "Newer Plan"
repository: "C:/test"
branch: "main"
generated_at: "2026-10-12T10:00:00Z"
---
`
    );

    const list = storage.listPlans();
    expect(list.length).toBe(2);
    expect(list[0].issueIdentifier).toBe('PRO-102');
    expect(list[1].issueIdentifier).toBe('PRO-101');
  });

  it('enforces concurrency lock preventing duplicate generation for the same issue', () => {
    const storage = new PlanStorageService(mockConfig);

    const release = storage.acquireGenerationLock('PRO-300');
    expect(storage.isGenerating('PRO-300')).toBe(true);

    // Second lock attempt for same issue throws
    expect(() => storage.acquireGenerationLock('PRO-300')).toThrow(
      DuplicatePlanGenerationError
    );

    // Release allows acquiring again
    release();
    expect(storage.isGenerating('PRO-300')).toBe(false);

    const reacquired = storage.acquireGenerationLock('PRO-300');
    expect(typeof reacquired).toBe('function');
    reacquired();
  });
});
