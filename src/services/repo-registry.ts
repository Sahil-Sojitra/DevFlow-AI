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
  packageDetails?: {
    name?: string;
    version?: string;
  };
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
   * Returns list of explicitly configured and verified repositories.
   */
  public getRepositories(): RepositoryInfo[] {
    return this.config.allowedWorkingDirs.map((allowedPath) => {
      const resolvedPath = path.resolve(allowedPath);
      const exists = fs.existsSync(resolvedPath);
      const id = generateRepoId(resolvedPath);

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
        `Repository "${resolvedInput}" is not in the configured allowed repositories list.`
      );
    }

    if (!matchedByPath.exists) {
      throw new Error(`Repository at path "${matchedByPath.path}" does not exist on disk.`);
    }

    return matchedByPath.path;
  }
}
