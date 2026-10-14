import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getAppConfig, type AppConfig } from '../config/env.js';

export interface RepositoryInfo {
  id: string;
  name: string;
  path: string;
  exists: boolean;
  branch: string;
  hasUncommittedChanges: boolean;
  uncommittedCount: number;
  isCustomRegistered?: boolean;
  packageDetails?: {
    name?: string;
    version?: string;
  };
}

/**
 * Storage file for repositories added dynamically through the dashboard.
 */
let registryFilePath = path.resolve('data', 'repositories.json');

export function setRegistryFileForTesting(filePath?: string): void {
  registryFilePath = filePath ? path.resolve(filePath) : path.resolve('data', 'repositories.json');
}

export function getCustomRepositories(): string[] {
  if (!fs.existsSync(registryFilePath)) return [];
  try {
    const raw = fs.readFileSync(registryFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomRepository(repoPath: string): string {
  const trimmed = repoPath.trim();
  if (!trimmed) {
    throw new Error('Repository path cannot be empty.');
  }

  const resolved = path.resolve(trimmed);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Directory "${resolved}" does not exist on disk.`);
  }

  const stats = fs.statSync(resolved);
  if (!stats.isDirectory()) {
    throw new Error(`Path "${resolved}" is not a directory.`);
  }

  const current = getCustomRepositories();
  const exists = current.some((p) => path.resolve(p).toLowerCase() === resolved.toLowerCase());

  if (!exists) {
    current.push(resolved);
    const dataDir = path.dirname(registryFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(registryFilePath, JSON.stringify(current, null, 2), 'utf8');
  }

  return resolved;
}

export function removeCustomRepository(repoPathOrId: string): boolean {
  const current = getCustomRepositories();
  const target = repoPathOrId.trim();

  const filtered = current.filter((p) => {
    const id = generateRepoId(p);
    return id !== target && path.resolve(p).toLowerCase() !== path.resolve(target).toLowerCase();
  });

  if (filtered.length !== current.length) {
    fs.writeFileSync(registryFilePath, JSON.stringify(filtered, null, 2), 'utf8');
    return true;
  }

  return false;
}

/**
 * Generates a stable, safe alphanumeric identifier for a repository path.
 */
export function generateRepoId(repoPath: string): string {
  const normalized = path.resolve(repoPath).toLowerCase().replace(/\\/g, '/');
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const safeBase = path.basename(repoPath).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeBase}-${Math.abs(hash).toString(36)}`;
}

/**
 * Service for querying and validating configured repositories safely.
 */
export class RepositoryRegistry {
  private readonly config: AppConfig;

  constructor(config?: AppConfig) {
    this.config = config ?? getAppConfig();
  }

  /**
   * Returns all allowed directories (configured in .env + added dynamically via UI).
   */
  public getAllAllowedDirs(): string[] {
    const fromConfig = this.config.allowedWorkingDirs.map((p) => path.resolve(p));
    const custom = getCustomRepositories().map((p) => path.resolve(p));
    const combined = new Set([...fromConfig, ...custom]);
    return Array.from(combined);
  }

  /**
   * Returns list of explicitly configured and verified repositories.
   */
  public getRepositories(): RepositoryInfo[] {
    const customSet = new Set(getCustomRepositories().map((p) => path.resolve(p).toLowerCase()));

    return this.getAllAllowedDirs().map((resolvedPath) => {
      const exists = fs.existsSync(resolvedPath);
      const id = generateRepoId(resolvedPath);
      const isCustomRegistered = customSet.has(resolvedPath.toLowerCase());

      let repoName = path.basename(resolvedPath);
      let packageDetails: RepositoryInfo['packageDetails'];

      if (exists) {
        const pkgPath = path.join(resolvedPath, 'package.json');
        if (fs.existsSync(pkgPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (pkg.name) {
              repoName = pkg.name;
              packageDetails = { name: pkg.name, version: pkg.version };
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      let branch = 'unknown';
      let hasUncommittedChanges = false;
      let uncommittedCount = 0;

      if (exists) {
        try {
          const gitBranch = execFileSync('git', ['branch', '--show-current'], {
            cwd: resolvedPath,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 2000,
            windowsHide: true,
          }).trim();
          branch = gitBranch || 'HEAD';
        } catch {
          branch = 'not-a-git-repo';
        }

        try {
          const statusOutput = execFileSync('git', ['status', '--porcelain'], {
            cwd: resolvedPath,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 2000,
            windowsHide: true,
          }).trim();

          if (statusOutput.length > 0) {
            hasUncommittedChanges = true;
            uncommittedCount = statusOutput.split('\n').filter((l) => l.trim().length > 0).length;
          }
        } catch {
          // Ignore status errors for non-git directories
        }
      }

      return {
        id,
        name: repoName,
        path: resolvedPath,
        exists,
        branch,
        hasUncommittedChanges,
        uncommittedCount,
        isCustomRegistered,
        packageDetails,
      };
    });
  }

  /**
   * Validates a repository path against the configured allowlist.
   * Throws an error if the path is not authorized.
   */
  public resolveAndValidateRepo(repoPathOrId: string): string {
    const repos = this.getRepositories();

    // Check by ID first
    const matchedById = repos.find((r) => r.id === repoPathOrId);
    if (matchedById) {
      if (!matchedById.exists) {
        throw new Error(`Repository at path "${matchedById.path}" does not exist on disk.`);
      }
      return matchedById.path;
    }

    // Check by path resolution
    const resolvedInput = path.resolve(repoPathOrId);
    const matchedByPath = repos.find(
      (r) => path.resolve(r.path).toLowerCase() === resolvedInput.toLowerCase()
    );

    if (!matchedByPath) {
      throw new Error(
        `Repository "${resolvedInput}" is not in the configured allowed repositories list. Add it in the dashboard or DEVFLOW_ALLOWED_WORKING_DIRS.`
      );
    }

    if (!matchedByPath.exists) {
      throw new Error(`Repository at path "${matchedByPath.path}" does not exist on disk.`);
    }

    return matchedByPath.path;
  }
}
