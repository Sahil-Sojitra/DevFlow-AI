import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import type { ChangedFile } from '../types/execution.js';

export interface GitWorkingTreeStatus {
  isClean: boolean;
  branch: string;
  headCommit: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  allUncommitted: string[];
}

/**
 * Runs a git command synchronously with a strict timeout and no shell execution.
 */
export function runGit(args: string[], cwd: string, timeoutMs = 15000): string {
  try {
    const result = spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      timeout: timeoutMs,
      shell: false,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      const errMsg = result.stderr?.trim() || `git ${args[0]} exited with code ${result.status}`;
      throw new Error(errMsg);
    }

    return (result.stdout || '').trim();
  } catch (err: unknown) {
    throw new Error(`Git error (${args.join(' ')}): ${(err as Error).message}`);
  }
}

/**
 * Inspects repository working tree status, capturing clean/dirty state, branch, and commit.
 */
export function inspectGitWorkingTree(cwd: string): GitWorkingTreeStatus {
  let branch = 'unknown';
  try {
    branch = runGit(['branch', '--show-current'], cwd) || 'HEAD';
  } catch {
    // Fallback if detached or failed
  }

  let headCommit = 'unknown';
  try {
    headCommit = runGit(['rev-parse', 'HEAD'], cwd) || 'unknown';
  } catch {
    // Fallback if empty repo
  }

  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];
  const allUncommitted: string[] = [];

  try {
    const porcelain = runGit(['status', '--porcelain=v1', '-uall'], cwd);
    if (porcelain.length > 0) {
      const lines = porcelain.split('\n');
      for (const line of lines) {
        if (!line || line.length < 3) continue;
        const indexStatus = line[0];
        const worktreeStatus = line[1];
        let filePath = line.substring(3).trim();

        // Handle renames (e.g., "R  old -> new")
        if (filePath.includes(' -> ')) {
          filePath = filePath.split(' -> ')[1].trim();
        }

        // Remove quotes if present
        if (filePath.startsWith('"') && filePath.endsWith('"')) {
          filePath = filePath.slice(1, -1);
        }

        allUncommitted.push(filePath);

        if (indexStatus === '?' && worktreeStatus === '?') {
          untracked.push(filePath);
        } else {
          if (indexStatus !== ' ' && indexStatus !== '?') {
            staged.push(filePath);
          }
          if (worktreeStatus !== ' ' && worktreeStatus !== '?') {
            unstaged.push(filePath);
          }
        }
      }
    }
  } catch {
    // If not a git repository or git status fails
  }

  return {
    isClean: allUncommitted.length === 0,
    branch,
    headCommit,
    staged,
    unstaged,
    untracked,
    allUncommitted,
  };
}

/**
 * Creates an isolated git worktree for implementation to safely protect the main working tree.
 */
export function createGitWorktree(
  repoDir: string,
  worktreeDir: string,
  baseCommitOrBranch = 'HEAD'
): string {
  const resolvedWorktree = path.resolve(worktreeDir);

  if (fs.existsSync(resolvedWorktree)) {
    throw new Error(`Target worktree directory already exists: ${resolvedWorktree}`);
  }

  const parentDir = path.dirname(resolvedWorktree);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  runGit(['worktree', 'add', '--detach', resolvedWorktree, baseCommitOrBranch], repoDir);
  return resolvedWorktree;
}

/**
 * Cleans up and removes a git worktree.
 */
export function removeGitWorktree(repoDir: string, worktreeDir: string): void {
  const resolved = path.resolve(worktreeDir);
  try {
    runGit(['worktree', 'remove', '--force', resolved], repoDir);
  } catch {
    // Fallback manual cleanup if git worktree remove fails
    if (fs.existsSync(resolved)) {
      try {
        fs.rmSync(resolved, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * Parses git porcelain status output into structured ChangedFile list.
 */
export function parsePorcelainStatus(
  porcelain: string,
  baselineFiles: string[] = []
): ChangedFile[] {
  const baselineSet = new Set(baselineFiles.map((f) => f.toLowerCase().replace(/\\/g, '/')));
  const changed: ChangedFile[] = [];

  if (!porcelain) return [];

  const lines = porcelain.split('\n');
  for (const line of lines) {
    if (!line || line.length < 3) continue;
    const indexStatus = line[0];
    const worktreeStatus = line[1];
    let filePath = line.substring(3).trim();

    if (filePath.includes(' -> ')) {
      filePath = filePath.split(' -> ')[1].trim();
    }
    if (filePath.startsWith('"') && filePath.endsWith('"')) {
      filePath = filePath.slice(1, -1);
    }

    const normalized = filePath.replace(/\\/g, '/');
    const isPreExisting = baselineSet.has(normalized.toLowerCase());

    let status: ChangedFile['status'] = 'modified';
    if (indexStatus === '?' || worktreeStatus === '?' || indexStatus === 'A') {
      status = 'added';
    } else if (indexStatus === 'D' || worktreeStatus === 'D') {
      status = 'deleted';
    } else if (indexStatus === 'R' || worktreeStatus === 'R') {
      status = 'renamed';
    }

    changed.push({
      path: normalized,
      status,
      isPreExisting,
    });
  }

  return changed;
}

/**
 * Detects changed files relative to a captured baseline.
 */
export function detectChangedFiles(
  targetDir: string,
  baselineFiles: string[] = [],
  gitRunner: (args: string[], cwd: string) => string = runGit
): ChangedFile[] {
  try {
    const porcelain = gitRunner(['status', '--porcelain=v1', '-uall'], targetDir);
    return parsePorcelainStatus(porcelain, baselineFiles);
  } catch {
    return [];
  }
}

/**
 * Captures a unified git diff for the target directory, bounded to prevent memory blowup.
 */
export function getUnifiedDiff(targetDir: string, maxBytes = 200000): string {
  let diffOutput = '';
  try {
    // 1. Staged and unstaged changes against HEAD
    diffOutput = runGit(['diff', 'HEAD'], targetDir, 20000);
  } catch {
    try {
      diffOutput = runGit(['diff'], targetDir, 10000);
    } catch {
      diffOutput = '';
    }
  }

  // 2. Untracked files handling: generate diff representation for untracked files
  try {
    const status = inspectGitWorkingTree(targetDir);
    for (const untrackedFile of status.untracked.slice(0, 20)) {
      const fullPath = path.join(targetDir, untrackedFile);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const stats = fs.statSync(fullPath);
        if (stats.size < 50000) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const normalized = untrackedFile.replace(/\\/g, '/');
          diffOutput += `\n\ndiff --git a/${normalized} b/${normalized}\nnew file mode 100644\n--- /dev/null\n+++ b/${normalized}\n`;
          const lines = content.split('\n');
          for (const l of lines) {
            diffOutput += `+${l}\n`;
          }
        }
      }
    }
  } catch {
    // Ignore
  }

  if (diffOutput.length > maxBytes) {
    return (
      diffOutput.slice(0, maxBytes) +
      `\n\n... [Diff output truncated at ${maxBytes} bytes for performance] ...`
    );
  }

  return diffOutput.trim() || 'No changes detected.';
}
