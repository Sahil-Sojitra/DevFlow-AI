import fs from 'node:fs';
import path from 'node:path';
import { getAppConfig, type AppConfig } from '../config/env.js';
import { sanitizeIssueIdentifier } from './planner.js';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface PlanReviewRecord {
  issueIdentifier: string;
  status: ReviewStatus;
  updatedAt: string;
  notes?: string;
}

export interface SavedPlanSummary {
  issueIdentifier: string;
  title: string;
  url?: string;
  repository: string;
  branch: string;
  generatedAt: string;
  filePath: string;
  reviewStatus: ReviewStatus;
  reviewNotes?: string;
  reviewUpdatedAt?: string;
}

export interface SavedPlanDetail extends SavedPlanSummary {
  content: string;
}

/**
 * Concurrency guard tracking active plan generation tasks by issue identifier.
 */
const activePlanGenerations = new Set<string>();

export class DuplicatePlanGenerationError extends Error {
  constructor(issueId: string) {
    super(`Plan generation for issue "${issueId}" is already in progress.`);
    this.name = 'DuplicatePlanGenerationError';
  }
}

/**
 * Service for reading, listing, and persisting plan reviews and files safely.
 */
export class PlanStorageService {
  private readonly config: AppConfig;

  constructor(config?: AppConfig) {
    this.config = config ?? getAppConfig();
  }

  private getReviewsFilePath(): string {
    const plansDir = path.resolve(this.config.plansDir);
    return path.join(plansDir, 'reviews.json');
  }

  /**
   * Loads review records from disk.
   */
  public getReviews(): Record<string, PlanReviewRecord> {
    const filePath = this.getReviewsFilePath();
    if (!fs.existsSync(filePath)) {
      return {};
    }
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  /**
   * Persists review records to disk.
   */
  public saveReview(issueIdentifier: string, status: ReviewStatus, notes?: string): PlanReviewRecord {
    const safeId = sanitizeIssueIdentifier(issueIdentifier);
    const reviews = this.getReviews();
    const plansDir = path.resolve(this.config.plansDir);

    if (!fs.existsSync(plansDir)) {
      fs.mkdirSync(plansDir, { recursive: true });
    }

    const record: PlanReviewRecord = {
      issueIdentifier: safeId,
      status,
      updatedAt: new Date().toISOString(),
      notes: notes?.trim() || undefined,
    };

    reviews[safeId] = record;
    fs.writeFileSync(this.getReviewsFilePath(), JSON.stringify(reviews, null, 2), 'utf8');
    return record;
  }

  /**
   * Lists all saved plans with their review statuses.
   */
  public listPlans(): SavedPlanSummary[] {
    const plansDir = path.resolve(this.config.plansDir);
    if (!fs.existsSync(plansDir)) {
      return [];
    }

    const reviews = this.getReviews();
    const files = fs.readdirSync(plansDir);
    const plans: SavedPlanSummary[] = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(plansDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const summary = this.parsePlanMetadata(content, filePath);
          if (summary) {
            const review = reviews[summary.issueIdentifier];
            plans.push({
              ...summary,
              reviewStatus: review ? review.status : 'pending',
              reviewNotes: review?.notes,
              reviewUpdatedAt: review?.updatedAt,
            });
          }
        } catch {
          // Ignore unreadable files
        }
      }
    }

    // Sort by generation timestamp descending
    return plans.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  /**
   * Retrieves a single saved plan and its content.
   */
  public getPlan(issueIdentifier: string): SavedPlanDetail | null {
    const safeId = sanitizeIssueIdentifier(issueIdentifier);
    const plansDir = path.resolve(this.config.plansDir);
    const filePath = path.join(plansDir, `${safeId}.md`);

    // Path traversal safety
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(plansDir) || !fs.existsSync(resolvedPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(resolvedPath, 'utf8');
      const summary = this.parsePlanMetadata(content, resolvedPath);
      if (!summary) return null;

      const review = this.getReviews()[summary.issueIdentifier];

      return {
        ...summary,
        reviewStatus: review ? review.status : 'pending',
        reviewNotes: review?.notes,
        reviewUpdatedAt: review?.updatedAt,
        content,
      };
    } catch {
      return null;
    }
  }

  /**
   * Concurrency lock acquisition for plan generation.
   */
  public acquireGenerationLock(issueIdentifier: string): () => void {
    const safeId = sanitizeIssueIdentifier(issueIdentifier);
    if (activePlanGenerations.has(safeId)) {
      throw new DuplicatePlanGenerationError(issueIdentifier);
    }

    activePlanGenerations.add(safeId);
    return () => {
      activePlanGenerations.delete(safeId);
    };
  }

  public isGenerating(issueIdentifier: string): boolean {
    return activePlanGenerations.has(sanitizeIssueIdentifier(issueIdentifier));
  }

  /**
   * Extracts frontmatter metadata from Markdown plan document.
   */
  private parsePlanMetadata(
    content: string,
    filePath: string
  ): Omit<SavedPlanSummary, 'reviewStatus'> | null {
    const baseName = path.basename(filePath, '.md');
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

    if (!match) {
      return {
        issueIdentifier: baseName,
        title: baseName,
        repository: '',
        branch: 'unknown',
        generatedAt: fs.statSync(filePath).mtime.toISOString(),
        filePath,
      };
    }

    const frontmatterText = match[1];
    const parseField = (field: string): string => {
      const fieldMatch = frontmatterText.match(new RegExp(`^${field}:\\s*"(.*?)"`, 'm'));
      return fieldMatch ? fieldMatch[1] : '';
    };

    return {
      issueIdentifier: parseField('issue') || baseName,
      title: parseField('title') || baseName,
      url: parseField('url') || undefined,
      repository: parseField('repository') || '',
      branch: parseField('branch') || 'unknown',
      generatedAt: parseField('generated_at') || fs.statSync(filePath).mtime.toISOString(),
      filePath,
    };
  }
}
