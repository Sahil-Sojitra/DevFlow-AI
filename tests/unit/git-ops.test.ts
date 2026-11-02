import { describe, it, expect, vi } from 'vitest';
import {
  parsePorcelainStatus,
  detectChangedFiles,
  sanitizeBranchName,
  generateTicketBranchName,
  detectBaseBranch,
  pullBaseBranch,
  mergeBranch,
  createAndCheckoutBranch,
} from '../../src/services/git-ops.js';
import * as gitOps from '../../src/services/git-ops.js';

describe('Git Operations Service', () => {
  it('accurately parses changed files and distinguishes pre-existing files from session files', () => {
    const mockPorcelain = [
      ' M src/index.ts',
      'A  src/components/NewFeature.tsx',
      '?? src/utils/helper.ts',
      ' D old-file.txt',
    ].join('\n');

    // Pre-existing dirty files before session started:
    const baselineFiles = ['src/index.ts'];

    const changed = parsePorcelainStatus(mockPorcelain, baselineFiles);

    expect(changed.length).toBe(4);

    const indexFile = changed.find((f) => f.path === 'src/index.ts');
    expect(indexFile).toBeDefined();
    expect(indexFile?.status).toBe('modified');
    expect(indexFile?.isPreExisting).toBe(true);

    const newFeature = changed.find((f) => f.path === 'src/components/NewFeature.tsx');
    expect(newFeature).toBeDefined();
    expect(newFeature?.status).toBe('added');
    expect(newFeature?.isPreExisting).toBe(false);

    const helper = changed.find((f) => f.path === 'src/utils/helper.ts');
    expect(helper).toBeDefined();
    expect(helper?.status).toBe('added');
    expect(helper?.isPreExisting).toBe(false);

    const deleted = changed.find((f) => f.path === 'old-file.txt');
    expect(deleted).toBeDefined();
    expect(deleted?.status).toBe('deleted');

    const customChanged = detectChangedFiles('D:/dummy-repo', baselineFiles, () => mockPorcelain);
    expect(customChanged.length).toBe(4);
  });

  it('sanitizes branch names to be git compliant', () => {
    expect(sanitizeBranchName('feature/user auth')).toBe('feature/user-auth');
    expect(sanitizeBranchName('feat/SAH-6!@#$')).toBe('feat/SAH-6');
    expect(sanitizeBranchName('/feat//user/')).toBe('feat/user');
  });

  it('generates standard ticket branch names', () => {
    expect(generateTicketBranchName('SAH-6')).toBe('feat/sah-6');
    expect(generateTicketBranchName('PRO-123', 'feature')).toBe('feature/pro-123');
  });

  it('detects main or master as primary base branch', () => {
    const base = detectBaseBranch(process.cwd());
    expect(['main', 'master']).toContain(base);
  });

  it('handles pullBaseBranch gracefully without throwing when offline or unconfigured', () => {
    const res = pullBaseBranch(process.cwd(), 'main');
    expect(res).toBeDefined();
    expect(typeof res.success).toBe('boolean');
    expect(typeof res.message).toBe('string');
  });

  it('handles createAndCheckoutBranch gracefully without unhandled exception', () => {
    // Current working directory on existing branch
    const res = createAndCheckoutBranch(process.cwd(), 'main');
    expect(res).toBeDefined();
    expect(typeof res.success).toBe('boolean');
    expect(res.branch).toBe('main');
  });
});
