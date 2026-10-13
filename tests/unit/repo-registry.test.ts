import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { RepositoryRegistry, generateRepoId } from '../../src/services/repo-registry.js';
import type { AppConfig } from '../../src/config/env.js';

describe('RepositoryRegistry', () => {
  const testRoot = path.resolve('data', 'test-repos');
  const repo1 = path.join(testRoot, 'repo-alpha');
  const repo2 = path.join(testRoot, 'repo-beta');

  const mockConfig: AppConfig = {
    antigravityBinPath: 'C:\\agy.exe',
    allowedWorkingDirs: [repo1, repo2],
    defaultTimeoutMs: 10000,
    enableIntegrationTest: false,
    linearApiUrl: 'https://api.linear.app/graphql',
    enableLinearIntegrationTest: false,
    plansDir: path.join(testRoot, 'plans'),
  };

  beforeEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(repo1, { recursive: true });
    fs.writeFileSync(
      path.join(repo1, 'package.json'),
      JSON.stringify({ name: '@acme/alpha', version: '1.2.0' })
    );
  });

  afterEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('lists only configured repositories with disk status and metadata', () => {
    const registry = new RepositoryRegistry(mockConfig);
    const repos = registry.getRepositories();

    expect(repos.length).toBe(2);

    const alpha = repos.find((r) => r.path === repo1);
    expect(alpha).toBeDefined();
    expect(alpha?.exists).toBe(true);
    expect(alpha?.name).toBe('@acme/alpha');
    expect(alpha?.packageDetails?.version).toBe('1.2.0');

    // repo-beta was not created on disk
    const beta = repos.find((r) => r.path === repo2);
    expect(beta).toBeDefined();
    expect(beta?.exists).toBe(false);
  });

  it('validates and resolves authorized repository paths and IDs', () => {
    const registry = new RepositoryRegistry(mockConfig);
    const resolved = registry.resolveAndValidateRepo(repo1);
    expect(resolved).toBe(repo1);

    const repoId = generateRepoId(repo1);
    const resolvedById = registry.resolveAndValidateRepo(repoId);
    expect(resolvedById).toBe(repo1);
  });

  it('throws an error when repository is not in configured allowlist', () => {
    const registry = new RepositoryRegistry(mockConfig);
    const unauthorized = path.resolve('C:\\unauthorized-folder');

    expect(() => registry.resolveAndValidateRepo(unauthorized)).toThrow(
      /is not in the configured allowed repositories list/
    );
  });

  it('throws an error when configured repository does not exist on disk', () => {
    const registry = new RepositoryRegistry(mockConfig);
    expect(() => registry.resolveAndValidateRepo(repo2)).toThrow(
      /does not exist on disk/
    );
  });
});
