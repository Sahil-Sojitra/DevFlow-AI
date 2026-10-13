import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getAppConfig, type AppConfig } from '../config/env.js';
import { AntigravityAdapter, AntigravitySecurityError } from '../adapters/antigravity.js';
import type { LinearIssue } from '../types/linear.js';

export class PlanAlreadyExistsError extends Error {
  constructor(filePath: string) {
    super(`Plan already exists at "${filePath}". Pass overwrite: true to replace it.`);
    this.name = 'PlanAlreadyExistsError';
  }
}

export interface PlanGenerationOptions {
  repoPath?: string;
  overwrite?: boolean;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  timeoutMs?: number;
}

export interface PlanGenerationResult {
  filePath: string;
  issueIdentifier: string;
  issueTitle: string;
  repoPath: string;
  branch: string;
  generatedAt: string;
  content: string;
  durationMs: number;
}

/**
 * Patterns of files and directories that must NEVER be read or passed to LLMs.
 */
const SENSITIVE_FILE_PATTERNS = [
  /^\.env/i,
  /\.env\./i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /\.cert$/i,
  /id_rsa/i,
  /credential/i,
  /secret/i,
  /token/i,
];

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.gemini',
  'data',
  'tmp',
  'scratch',
  '.turbo',
  '.next',
]);

/**
 * Sanitizes an issue identifier for safe filesystem usage.
 */
export function sanitizeIssueIdentifier(identifier: string): string {
  return identifier.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Determines current git branch name safely without throwing.
 */
export function getGitBranch(cwd: string): string {
  try {
    const branch = execFileSync('git', ['branch', '--show-current'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
      windowsHide: true,
    }).trim();
    return branch || 'HEAD';
  } catch {
    return 'unknown';
  }
}

/**
 * Recursively scans directory collecting relevant source files while respecting exclusions.
 */
export function collectRepositoryFiles(
  dir: string,
  maxFiles = 100,
  currentDepth = 0,
  maxDepth = 4
): string[] {
  if (currentDepth > maxDepth) return [];
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name) && !entry.name.startsWith('.')) {
          files.push(...collectRepositoryFiles(path.join(dir, entry.name), maxFiles, currentDepth + 1, maxDepth));
        }
      } else if (entry.isFile()) {
        const isSensitive = SENSITIVE_FILE_PATTERNS.some((pat) => pat.test(entry.name));
        if (!isSensitive) {
          files.push(path.join(dir, entry.name));
        }
      }
      if (files.length >= maxFiles) break;
    }
  } catch {
    // Gracefully handle unreadable directories
  }

  return files.slice(0, maxFiles);
}

/**
 * Selects and reads snippets of relevant files based on ticket keywords.
 */
export function extractRepositoryContext(repoPath: string, issue: LinearIssue): string {
  const parts: string[] = [];

  // 1. Inspect package.json scripts and dependencies if present
  const packageJsonPath = path.join(repoPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      parts.push(
        `### package.json Overview:\n- Name: ${pkg.name || 'unnamed'}\n- Scripts: ${Object.keys(pkg.scripts || {}).join(', ')}\n- Dependencies: ${Object.keys(pkg.dependencies || {}).join(', ')}`
      );
    } catch {
      // Ignore parse failure
    }
  }

  // 2. Check for project instructions (GEMINI.md, AGENTS.md, README.md)
  const docFiles = ['GEMINI.md', 'AGENTS.md', 'README.md', 'CONTRIBUTING.md'];
  for (const doc of docFiles) {
    const docPath = path.join(repoPath, doc);
    if (fs.existsSync(docPath)) {
      try {
        const content = fs.readFileSync(docPath, 'utf8').slice(0, 1500);
        parts.push(`### ${doc} (excerpt):\n${content}`);
        break; // Only excerpt the primary instruction file
      } catch {
        // Ignore read errors
      }
    }
  }

  // 3. Collect directory files
  const allFiles = collectRepositoryFiles(repoPath, 80);
  const relativeFiles = allFiles.map((f) => path.relative(repoPath, f).replace(/\\/g, '/'));
  parts.push(`### Repository File Structure (sampled):\n${relativeFiles.slice(0, 50).map((f) => `- ${f}`).join('\n')}`);

  // 4. Keyword matching for key file snippets
  const keywords = new Set(
    `${issue.title} ${issue.description || ''} ${issue.labels.map((l) => l.name).join(' ')}`
      .toLowerCase()
      .split(/[^a-z0-9_-]+/)
      .filter((w) => w.length >= 4)
  );

  let snippetCharBudget = 8000;
  for (const file of allFiles) {
    if (snippetCharBudget <= 0) break;
    const baseName = path.basename(file).toLowerCase();
    const isCandidate = Array.from(keywords).some((kw) => baseName.includes(kw));

    if (isCandidate) {
      try {
        const stats = fs.statSync(file);
        if (stats.size < 50000) {
          const content = fs.readFileSync(file, 'utf8').slice(0, 2000);
          parts.push(`### Relevant File: ${path.relative(repoPath, file).replace(/\\/g, '/')}\n\`\`\`\n${content}\n\`\`\``);
          snippetCharBudget -= content.length;
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  return parts.join('\n\n');
}

/**
 * Service to orchestrate repository-aware planning using the Antigravity CLI.
 */
export class TicketPlanner {
  private readonly config: AppConfig;
  private readonly antigravityAdapter: AntigravityAdapter;

  constructor(
    config?: AppConfig,
    adapter?: AntigravityAdapter
  ) {
    this.config = config ?? getAppConfig();
    this.antigravityAdapter = adapter ?? new AntigravityAdapter(this.config);
  }

  /**
   * Generates and writes an implementation plan for a Linear issue.
   */
  public async generatePlan(
    issue: LinearIssue,
    options: PlanGenerationOptions = {}
  ): Promise<PlanGenerationResult> {
    const targetRepo = path.resolve(options.repoPath ?? this.config.allowedWorkingDirs[0] ?? process.cwd());

    // 1. Validate repository security containment
    this.antigravityAdapter.validateWorkingDirectory(targetRepo);

    // 2. Overwrite protection
    const safeIdentifier = sanitizeIssueIdentifier(issue.identifier);
    const plansDir = path.resolve(this.config.plansDir);
    if (!fs.existsSync(plansDir)) {
      fs.mkdirSync(plansDir, { recursive: true });
    }

    const planFilePath = path.join(plansDir, `${safeIdentifier}.md`);
    if (fs.existsSync(planFilePath) && !options.overwrite) {
      throw new PlanAlreadyExistsError(planFilePath);
    }

    const currentBranch = getGitBranch(targetRepo);
    const repoContext = extractRepositoryContext(targetRepo, issue);

    // 3. Assemble ticket context
    const commentsText = issue.comments.length > 0
      ? issue.comments.map((c) => `- [${c.user?.name || 'User'} at ${c.createdAt}]: ${c.body}`).join('\n')
      : 'No comments available.';

    const labelsText = issue.labels.map((l) => l.name).join(', ') || 'None';

    // 4. Construct planning prompt with explicit instructions to flag missing contracts
    const planningPrompt = `
You are creating an actionable, repository-aware implementation plan for Linear Ticket ${issue.identifier}.

## TICKET DETAILS
- Identifier: ${issue.identifier}
- Title: ${issue.title}
- State: ${issue.state?.name || 'Unknown'}
- Priority: ${issue.priorityLabel || issue.priority || 'Normal'}
- Labels: ${labelsText}
- URL: ${issue.url}

### Description:
${issue.description || 'No description provided.'}

### Comments & Clarifications:
${commentsText}

## REPOSITORY CONTEXT
- Target Directory: ${targetRepo}
- Branch: ${currentBranch}

${repoContext}

## INSTRUCTIONS FOR PLAN GENERATION
Generate a comprehensive, structured implementation plan in Markdown.
CRITICAL RULES:
1. Do NOT invent missing backend endpoints, API contracts, or schemas. If a requirement or API contract is missing or ambiguous, flag it explicitly under "Risks, Assumptions and Unresolved Questions".
2. Do NOT perform any code modifications; only generate the plan.
3. Base your implementation steps on the actual repository structure and existing patterns observed above.

The plan MUST include the following exact sections:
# Implementation Plan: [${issue.identifier}] ${issue.title}

## 1. Problem Summary
Concise explanation of the problem, motivation, and expected outcome.

## 2. Requirements & Acceptance Criteria
Bullet list of user and technical requirements derived from the ticket.

## 3. Relevant Files & Modules
List files to create, inspect, or modify, with a brief explanation of each file's role.

## 4. Step-by-Step Implementation Steps
Ordered, technical tasks for implementation.

## 5. API Contracts & External Dependencies
Existing or required endpoints, payload schemas, and contracts. Clearly note if any backend contracts are missing.

## 6. UI/State Handling (if applicable)
Loading, success, empty, and error states.

## 7. Testing & Verification Plan
Exact verification commands, automated unit test scenarios, and manual acceptance steps.

## 8. Risks, Assumptions, and Unresolved Questions
Explicitly list any uncertainties, missing documentation, or dependencies needing clarification.
`.trim();

    // 5. Invoke Antigravity CLI in non-interactive print mode
    const executionResult = await this.antigravityAdapter.executePrompt({
      workingDir: targetRepo,
      prompt: planningPrompt,
      outputFormat: 'json',
      effort: options.effort ?? 'medium',
      model: options.model,
      timeoutMs: options.timeoutMs,
    });

    if (!executionResult.success) {
      throw new Error(
        `Failed to generate plan via Antigravity CLI: ${executionResult.error || executionResult.stderr || 'Unknown execution error'}`
      );
    }

    const generatedBody = executionResult.parsedOutput?.response?.trim() || executionResult.stdout.trim();
    const generatedAt = new Date().toISOString();

    // 6. Format final plan document with metadata header
    const planDocument = `---
issue: "${issue.identifier}"
title: "${issue.title.replace(/"/g, '\\"')}"
url: "${issue.url}"
repository: "${targetRepo.replace(/\\/g, '/')}"
branch: "${currentBranch}"
generated_at: "${generatedAt}"
---

${generatedBody}
`;

    // 7. Write plan to disk
    fs.writeFileSync(planFilePath, planDocument, 'utf8');

    return {
      filePath: planFilePath,
      issueIdentifier: issue.identifier,
      issueTitle: issue.title,
      repoPath: targetRepo,
      branch: currentBranch,
      generatedAt,
      content: planDocument,
      durationMs: executionResult.durationMs,
    };
  }
}
