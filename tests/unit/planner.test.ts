import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  TicketPlanner,
  PlanAlreadyExistsError,
  sanitizeIssueIdentifier,
  collectRepositoryFiles,
  extractRepositoryContext,
} from '../../src/services/planner.js';
import { AntigravitySecurityError } from '../../src/adapters/antigravity.js';
import type { AppConfig } from '../../src/config/env.js';
import type { LinearIssue } from '../../src/types/linear.js';

describe('TicketPlanner', () => {
  const testDir = path.resolve('data', 'test-scratch');
  const testPlansDir = path.join(testDir, 'plans');
  const testRepoDir = path.join(testDir, 'repo');

  const mockConfig: AppConfig = {
    antigravityBinPath: 'C:\\agy.exe',
    allowedWorkingDirs: [testRepoDir],
    defaultTimeoutMs: 15000,
    enableIntegrationTest: false,
    linearApiUrl: 'https://api.linear.app/graphql',
    enableLinearIntegrationTest: false,
    plansDir: testPlansDir,
  };

  const sampleIssue: LinearIssue = {
    id: 'iss_906',
    identifier: 'PRO-906',
    title: 'Support Deep Links in Navigation',
    description: 'Require URL deep linking for Android and iOS.',
    priority: 1,
    priorityLabel: 'High',
    url: 'https://linear.app/issue/PRO-906',
    createdAt: '2026-10-12T00:00:00Z',
    updatedAt: '2026-10-13T00:00:00Z',
    labels: [{ id: 'l1', name: 'Navigation' }],
    comments: [
      {
        id: 'c1',
        body: 'Backend endpoint /v1/deep-link is currently in draft.',
        createdAt: '2026-10-12T14:00:00Z',
        user: { id: 'u1', name: 'Backend Lead' },
      },
    ],
    children: [],
  };

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testPlansDir, { recursive: true });
    fs.mkdirSync(testRepoDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Identifier Sanitization & Safe Filenames', () => {
    it('sanitizes special characters into safe file names', () => {
      expect(sanitizeIssueIdentifier('PRO-906')).toBe('PRO-906');
      expect(sanitizeIssueIdentifier('PRO/906:test')).toBe('PRO_906_test');
      expect(sanitizeIssueIdentifier('feat#123..')).toBe('feat_123__');
    });
  });

  describe('Sensitive File Exclusion', () => {
    it('excludes .env, private keys, and sensitive files from repository collection', () => {
      // Create test files
      fs.writeFileSync(path.join(testRepoDir, '.env'), 'SECRET_KEY=1234');
      fs.writeFileSync(path.join(testRepoDir, '.env.local'), 'SECRET_KEY=5678');
      fs.writeFileSync(path.join(testRepoDir, 'server.key'), 'PRIVATE KEY');
      fs.writeFileSync(path.join(testRepoDir, 'app.ts'), 'console.log("hello");');
      fs.mkdirSync(path.join(testRepoDir, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(testRepoDir, 'node_modules', 'dep.js'), 'export {}');

      const collected = collectRepositoryFiles(testRepoDir);
      const fileNames = collected.map((f) => path.basename(f));

      expect(fileNames).toContain('app.ts');
      expect(fileNames).not.toContain('.env');
      expect(fileNames).not.toContain('.env.local');
      expect(fileNames).not.toContain('server.key');
      expect(fileNames).not.toContain('dep.js');
    });

    it('extracts repository overview without leaking sensitive file contents', () => {
      fs.writeFileSync(path.join(testRepoDir, '.env'), 'SUPER_SECRET_TOKEN=xyz');
      fs.writeFileSync(path.join(testRepoDir, 'README.md'), '# Project Guide\nInstructions here.');
      fs.writeFileSync(
        path.join(testRepoDir, 'package.json'),
        JSON.stringify({ name: 'test-app', scripts: { test: 'vitest' } })
      );

      const context = extractRepositoryContext(testRepoDir, sampleIssue);

      expect(context).toContain('package.json Overview');
      expect(context).toContain('Project Guide');
      expect(context).not.toContain('SUPER_SECRET_TOKEN');
    });
  });

  describe('Planning Orchestration & Overwrite Protection', () => {
    it('throws AntigravitySecurityError when target repo is outside allowed directories', async () => {
      const unauthorizedRepo = path.resolve('C:\\unauthorized-repo');
      const planner = new TicketPlanner(mockConfig);

      await expect(
        planner.generatePlan(sampleIssue, { repoPath: unauthorizedRepo })
      ).rejects.toThrow(AntigravitySecurityError);
    });

    it('generates, formats, and saves plan to disk', async () => {
      const mockAdapter = {
        validateWorkingDirectory: vi.fn().mockReturnValue(testRepoDir),
        executePrompt: vi.fn().mockResolvedValue({
          success: true,
          exitCode: 0,
          durationMs: 3200,
          parsedOutput: {
            response: '# Implementation Plan: [PRO-906] Support Deep Links\n\n## 1. Problem Summary\nDeep links...',
          },
          stdout: '',
          stderr: '',
        }),
      };

      const planner = new TicketPlanner(mockConfig, mockAdapter as any);
      const result = await planner.generatePlan(sampleIssue, { repoPath: testRepoDir });

      expect(result.filePath).toBe(path.join(testPlansDir, 'PRO-906.md'));
      expect(fs.existsSync(result.filePath)).toBe(true);

      const fileContent = fs.readFileSync(result.filePath, 'utf8');
      expect(fileContent).toContain('issue: "PRO-906"');
      expect(fileContent).toContain('url: "https://linear.app/issue/PRO-906"');
      expect(fileContent).toContain('## 1. Problem Summary');

      // Verify that the prompt sent to Antigravity explicitly instructs to flag missing contracts
      expect(mockAdapter.executePrompt).toHaveBeenCalledTimes(1);
      const promptArg = mockAdapter.executePrompt.mock.calls[0][0].prompt;
      expect(promptArg).toContain('CRITICAL RULES');
      expect(promptArg).toContain('Do NOT invent missing backend endpoints, API contracts, or schemas');
      expect(promptArg).toContain('Risks, Assumptions and Unresolved Questions');
    });

    it('prevents accidental overwriting of an existing plan unless overwrite is true', async () => {
      const existingPlanPath = path.join(testPlansDir, 'PRO-906.md');
      fs.writeFileSync(existingPlanPath, 'Existing plan content');

      const mockAdapter = {
        validateWorkingDirectory: vi.fn().mockReturnValue(testRepoDir),
        executePrompt: vi.fn(),
      };

      const planner = new TicketPlanner(mockConfig, mockAdapter as any);

      // Attempting without overwrite should reject
      await expect(
        planner.generatePlan(sampleIssue, { repoPath: testRepoDir, overwrite: false })
      ).rejects.toThrow(PlanAlreadyExistsError);

      expect(mockAdapter.executePrompt).not.toHaveBeenCalled();

      // Attempting with overwrite: true should succeed
      mockAdapter.executePrompt.mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        durationMs: 2500,
        parsedOutput: { response: 'New overwritten plan' },
        stdout: '',
        stderr: '',
      });

      const result = await planner.generatePlan(sampleIssue, { repoPath: testRepoDir, overwrite: true });
      expect(result.content).toContain('New overwritten plan');
      expect(fs.readFileSync(existingPlanPath, 'utf8')).toContain('New overwritten plan');
    });
  });
});
