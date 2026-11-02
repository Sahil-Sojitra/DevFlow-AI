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
 * Detects the repository's primary base branch ('main' or 'master' or fallback to current).
 */
export function detectBaseBranch(repoDir: string): string {
  try {
    const branches = runGit(['branch', '--list', 'main', 'master'], repoDir);
    if (branches.includes('main')) return 'main';
    if (branches.includes('master')) return 'master';

    // Try remote HEAD
    try {
      const remoteHead = runGit(['symbolic-ref', 'refs/remotes/origin/HEAD'], repoDir);
      const match = remoteHead.match(/refs\/remotes\/origin\/(.+)$/);
      if (match && match[1]) return match[1];
    } catch {
      // Ignore
    }

    const current = runGit(['branch', '--show-current'], repoDir);
    return current || 'main';
  } catch {
    return 'main';
  }
}

/**
 * Sanitizes a branch name to be compliant with Git branch naming rules.
 */
export function sanitizeBranchName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_\-\./]/g, '')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
}

/**
 * Generates standard ticket branch name (e.g., feat/sah-6).
 */
export function generateTicketBranchName(issueIdentifier: string, prefix = 'feat'): string {
  const cleanId = sanitizeBranchName(issueIdentifier.toLowerCase());
  return `${prefix}/${cleanId}`;
}

/**
 * Attempts to pull or fetch the base branch from the remote if configured.
 * Does not fail if offline or remote is absent.
 */
export function pullBaseBranch(repoDir: string, baseBranch: string): { success: boolean; message: string } {
  try {
    const remotes = runGit(['remote'], repoDir);
    if (!remotes || remotes.trim().length === 0) {
      return { success: true, message: `No remote configured. Using local branch "${baseBranch}".` };
    }

    // Check current branch
    const currentBranch = runGit(['branch', '--show-current'], repoDir);
    if (currentBranch === baseBranch) {
      // Check if working tree clean
      const status = inspectGitWorkingTree(repoDir);
      if (status.isClean) {
        try {
          runGit(['pull', 'origin', baseBranch], repoDir, 20000);
          return { success: true, message: `Successfully pulled latest changes for "${baseBranch}" from origin.` };
        } catch (pullErr: unknown) {
          return { success: false, message: `Failed to pull from origin: ${(pullErr as Error).message}. Using local "${baseBranch}".` };
        }
      }
    }

    // If on a different branch or dirty, fetch origin without changing working tree
    try {
      runGit(['fetch', 'origin', baseBranch], repoDir, 20000);
      return { success: true, message: `Fetched latest refs for "${baseBranch}" from origin.` };
    } catch {
      return { success: true, message: `Remote fetch unreachable. Using local branch "${baseBranch}".` };
    }
  } catch {
    return { success: true, message: `Using local branch "${baseBranch}".` };
  }
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
 * Creates an isolated git worktree attached to a specific feature/ticket branch.
 */
export function createGitWorktreeWithBranch(
  repoDir: string,
  worktreeDir: string,
  branchName: string,
  baseBranch = 'main'
): string {
  const resolvedWorktree = path.resolve(worktreeDir);

  if (fs.existsSync(resolvedWorktree)) {
    throw new Error(`Target worktree directory already exists: ${resolvedWorktree}`);
  }

  const parentDir = path.dirname(resolvedWorktree);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  // Check if branch already exists
  let branchExists = false;
  try {
    runGit(['rev-parse', '--verify', `refs/heads/${branchName}`], repoDir);
    branchExists = true;
  } catch {
    branchExists = false;
  }

  if (branchExists) {
    runGit(['worktree', 'add', resolvedWorktree, branchName], repoDir);
  } else {
    runGit(['worktree', 'add', '-b', branchName, resolvedWorktree, baseBranch], repoDir);
  }

  return resolvedWorktree;
}

/**
 * Creates and checks out a feature/ticket branch directly in the repository working tree (no worktree).
 * If branch already exists, checks it out.
 * If branch does not exist, creates and checks it out from baseBranch (or HEAD).
 */
export function createAndCheckoutBranch(
  repoDir: string,
  branchName: string,
  baseBranch?: string
): { success: boolean; branch: string; error?: string } {
  try {
    const currentBranch = runGit(['branch', '--show-current'], repoDir);
    if (currentBranch === branchName) {
      return { success: true, branch: branchName };
    }

    // Check if branch already exists locally
    let branchExists = false;
    try {
      runGit(['rev-parse', '--verify', `refs/heads/${branchName}`], repoDir);
      branchExists = true;
    } catch {
      branchExists = false;
    }

    if (branchExists) {
      runGit(['checkout', branchName], repoDir);
      return { success: true, branch: branchName };
    }

    // Branch does not exist, create from baseBranch if provided
    if (baseBranch) {
      let baseExistsLocally = false;
      try {
        runGit(['rev-parse', '--verify', `refs/heads/${baseBranch}`], repoDir);
        baseExistsLocally = true;
      } catch {
        baseExistsLocally = false;
      }

      if (baseExistsLocally) {
        runGit(['checkout', '-b', branchName, baseBranch], repoDir);
      } else {
        // Try origin/<baseBranch> or fallback to current HEAD
        try {
          runGit(['checkout', '-b', branchName, `origin/${baseBranch}`], repoDir);
        } catch {
          runGit(['checkout', '-b', branchName], repoDir);
        }
      }
    } else {
      runGit(['checkout', '-b', branchName], repoDir);
    }

    return { success: true, branch: branchName };
  } catch (err: unknown) {
    return {
      success: false,
      branch: branchName,
      error: `Failed to create/checkout branch "${branchName}": ${(err as Error).message}`,
    };
  }
}

/**
 * Commits all working tree or worktree changes with a descriptive message.
 */
export function commitWorktreeChanges(worktreeDir: string, commitMessage: string): string | null {
  try {
    const status = inspectGitWorkingTree(worktreeDir);
    if (status.isClean) {
      return null;
    }

    runGit(['add', '-A'], worktreeDir);
    runGit(['commit', '-m', commitMessage], worktreeDir);
    const headCommit = runGit(['rev-parse', 'HEAD'], worktreeDir);
    return headCommit || null;
  } catch {
    return null;
  }
}

/**
 * Merges a feature/ticket branch into the target base branch (e.g. main/master).
 */
export function mergeBranch(
  repoDir: string,
  sourceBranch: string,
  targetBranch: string,
  commitMessage?: string
): { success: boolean; commitSha?: string; error?: string } {
  try {
    const status = inspectGitWorkingTree(repoDir);
    if (!status.isClean) {
      return {
        success: false,
        error: `Cannot merge into "${targetBranch}": main working tree has ${status.allUncommitted.length} uncommitted changes. Stash or commit them first.`,
      };
    }

    // Switch to target branch if not already on it
    if (status.branch !== targetBranch) {
      runGit(['checkout', targetBranch], repoDir);
    }

    const defaultMsg = `Merge branch '${sourceBranch}' into ${targetBranch}`;
    const msg = commitMessage || defaultMsg;

    runGit(['merge', sourceBranch, '-m', msg], repoDir);
    const commitSha = runGit(['rev-parse', 'HEAD'], repoDir);

    return {
      success: true,
      commitSha,
    };
  } catch (err: unknown) {
    // Attempt abort in case of merge conflict
    try {
      runGit(['merge', '--abort'], repoDir);
    } catch {
      // Ignore
    }
    return {
      success: false,
      error: `Failed to merge "${sourceBranch}" into "${targetBranch}": ${(err as Error).message}`,
    };
  }
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
 * Can compare against a base branch/commit or working tree HEAD.
 */
export function getUnifiedDiff(
  targetDir: string,
  baseCommitOrBranch?: string,
  maxBytes = 300000
): string {
  let diffOutput = '';

  // 1. If baseCommitOrBranch is provided (e.g. 'main' or baselineCommit), try diffing against it
  if (baseCommitOrBranch) {
    try {
      diffOutput = runGit(['diff', `${baseCommitOrBranch}...HEAD`], targetDir, 25000);
    } catch {
      try {
        diffOutput = runGit(['diff', baseCommitOrBranch], targetDir, 20000);
      } catch {
        diffOutput = '';
      }
    }
  }

  // 2. If no diff against base, or no base provided, try uncommitted diff against HEAD
  if (!diffOutput || diffOutput.trim().length === 0) {
    try {
      diffOutput = runGit(['diff', 'HEAD'], targetDir, 20000);
    } catch {
      try {
        diffOutput = runGit(['diff'], targetDir, 10000);
      } catch {
        diffOutput = '';
      }
    }
  }

  // 3. Untracked files handling: generate diff representation for untracked files
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

export interface DiffLine {
  type: 'add' | 'delete' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffChunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface FileDiff {
  filePath: string;
  oldPath?: string;
  status: 'added' | 'deleted' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  chunks: DiffChunk[];
}

export interface StructuredDiffResult {
  rawDiff: string;
  files: FileDiff[];
  totalAdditions: number;
  totalDeletions: number;
}

/**
 * Parses raw unified git diff into structured file diffs and hunks with line numbers.
 */
export function parseStructuredDiff(rawDiff: string): StructuredDiffResult {
  if (!rawDiff || rawDiff.trim() === 'No changes detected.') {
    return {
      rawDiff: rawDiff || '',
      files: [],
      totalAdditions: 0,
      totalDeletions: 0,
    };
  }

  const lines = rawDiff.split('\n');
  const files: FileDiff[] = [];
  let currentFile: FileDiff | null = null;
  let currentChunk: DiffChunk | null = null;
  let currentOld = 0;
  let currentNew = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // File header: diff --git a/path b/path
    if (line.startsWith('diff --git ')) {
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      const filePath = match ? match[2] : line.replace('diff --git ', '').trim();
      currentFile = {
        filePath,
        oldPath: match ? match[1] : undefined,
        status: 'modified',
        additions: 0,
        deletions: 0,
        chunks: [],
      };
      files.push(currentFile);
      currentChunk = null;
      continue;
    }

    if (!currentFile) continue;

    // Detect file mode / status
    if (line.startsWith('new file mode')) {
      currentFile.status = 'added';
      continue;
    }
    if (line.startsWith('deleted file mode')) {
      currentFile.status = 'deleted';
      continue;
    }
    if (line.startsWith('similarity index') || line.startsWith('rename from')) {
      currentFile.status = 'renamed';
      continue;
    }

    // Chunk header: @@ -oldStart,oldLines +newStart,newLines @@ optional header
    if (line.startsWith('@@ ')) {
      const chunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
      if (chunkMatch) {
        const oldStart = parseInt(chunkMatch[1], 10);
        const oldLines = chunkMatch[2] !== undefined ? parseInt(chunkMatch[2], 10) : 1;
        const newStart = parseInt(chunkMatch[3], 10);
        const newLines = chunkMatch[4] !== undefined ? parseInt(chunkMatch[4], 10) : 1;
        const header = chunkMatch[5]?.trim() || '';

        currentOld = oldStart;
        currentNew = newStart;

        currentChunk = {
          header,
          oldStart,
          oldLines,
          newStart,
          newLines,
          lines: [],
        };
        currentFile.chunks.push(currentChunk);
      }
      continue;
    }

    if (!currentChunk) continue;

    // Diff line additions, deletions, context
    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentFile.additions++;
      currentChunk.lines.push({
        type: 'add',
        content: line.slice(1),
        newLineNumber: currentNew++,
      });
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      currentFile.deletions++;
      currentChunk.lines.push({
        type: 'delete',
        content: line.slice(1),
        oldLineNumber: currentOld++,
      });
    } else if (line.startsWith(' ') || line === '') {
      currentChunk.lines.push({
        type: 'context',
        content: line.startsWith(' ') ? line.slice(1) : line,
        oldLineNumber: currentOld++,
        newLineNumber: currentNew++,
      });
    }
  }

  const totalAdditions = files.reduce((acc, f) => acc + f.additions, 0);
  const totalDeletions = files.reduce((acc, f) => acc + f.deletions, 0);

  return {
    rawDiff,
    files,
    totalAdditions,
    totalDeletions,
  };
}

export interface RemoteInfo {
  provider: 'github' | 'gitlab' | 'bitbucket' | 'unknown';
  owner?: string;
  repo?: string;
  rawUrl: string;
  webBaseUrl?: string;
}

/**
 * Parses git remote URL into structured RemoteInfo (provider, owner, repository, web base URL).
 */
export function parseRemoteUrl(repoDir: string, remote = 'origin'): RemoteInfo | null {
  try {
    const rawUrl = runGit(['remote', 'get-url', remote], repoDir).trim();
    if (!rawUrl) return null;

    let hostname = '';
    let pathPart = '';

    if (rawUrl.startsWith('git@') || rawUrl.startsWith('ssh://')) {
      const match = rawUrl.match(/(?:ssh:\/\/)?git@([^:]+):?(\d+)?\/?(.+)$/);
      if (match) {
        hostname = match[1];
        pathPart = match[3];
      }
    } else {
      try {
        const parsed = new URL(rawUrl);
        hostname = parsed.hostname;
        pathPart = parsed.pathname.replace(/^\//, '');
      } catch {
        // Fallback
      }
    }

    const cleanPath = pathPart.replace(/\.git$/, '');
    const parts = cleanPath.split('/').filter(Boolean);
    const owner = parts.length >= 2 ? parts[parts.length - 2] : undefined;
    const repo = parts.length >= 1 ? parts[parts.length - 1] : undefined;

    let provider: RemoteInfo['provider'] = 'unknown';
    let webBaseUrl: string | undefined;

    if (hostname.includes('github.com')) {
      provider = 'github';
      if (owner && repo) webBaseUrl = `https://github.com/${owner}/${repo}`;
    } else if (hostname.includes('gitlab.com')) {
      provider = 'gitlab';
      if (owner && repo) webBaseUrl = `https://gitlab.com/${owner}/${repo}`;
    } else if (hostname.includes('bitbucket.org')) {
      provider = 'bitbucket';
      if (owner && repo) webBaseUrl = `https://bitbucket.org/${owner}/${repo}`;
    }

    return {
      provider,
      owner,
      repo,
      rawUrl,
      webBaseUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Pushes a local branch to the configured remote repository.
 */
export function pushBranch(
  repoDir: string,
  branchName: string,
  remote = 'origin'
): { success: boolean; message: string; error?: string } {
  try {
    const remotes = runGit(['remote'], repoDir);
    if (!remotes || remotes.trim().length === 0) {
      return {
        success: false,
        message: 'No git remote configured.',
        error: `Repository "${repoDir}" has no remotes configured. Add a remote with "git remote add origin <url>" first.`,
      };
    }

    runGit(['push', '-u', remote, branchName], repoDir, 45000);
    return {
      success: true,
      message: `Branch "${branchName}" successfully pushed to "${remote}".`,
    };
  } catch (err: unknown) {
    const msg = (err as Error).message;
    return {
      success: false,
      message: `Failed to push branch "${branchName}" to "${remote}".`,
      error: msg,
    };
  }
}

/**
 * Generates direct 1-click web comparison URL to open and create PR in browser.
 */
export function generatePrWebUrl(
  remoteInfo: RemoteInfo,
  sourceBranch: string,
  targetBranch: string,
  title: string,
  body: string
): string | null {
  if (!remoteInfo.webBaseUrl || !remoteInfo.owner || !remoteInfo.repo) {
    return null;
  }

  if (remoteInfo.provider === 'github') {
    const params = new URLSearchParams({
      expand: '1',
      title,
      body,
    });
    return `${remoteInfo.webBaseUrl}/compare/${encodeURIComponent(targetBranch)}...${encodeURIComponent(sourceBranch)}?${params.toString()}`;
  }

  if (remoteInfo.provider === 'gitlab') {
    const params = new URLSearchParams({
      'merge_request[source_branch]': sourceBranch,
      'merge_request[target_branch]': targetBranch,
      'merge_request[title]': title,
      'merge_request[description]': body,
    });
    return `${remoteInfo.webBaseUrl}/-/merge_requests/new?${params.toString()}`;
  }

  if (remoteInfo.provider === 'bitbucket') {
    const params = new URLSearchParams({
      source: sourceBranch,
      dest: targetBranch,
    });
    return `${remoteInfo.webBaseUrl}/pull-requests/new?${params.toString()}`;
  }

  return null;
}
