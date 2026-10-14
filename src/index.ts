import path from 'node:path';
import { getAppConfig } from './config/env.js';
import { AntigravityAdapter } from './adapters/antigravity.js';
import { LinearAdapter } from './adapters/linear.js';
import { TicketPlanner } from './services/planner.js';
import { ImplementationExecutor } from './services/executor.js';

export * from './config/env.js';
export * from './adapters/antigravity.js';
export * from './adapters/linear.js';
export * from './services/planner.js';
export * from './services/git-ops.js';
export * from './services/verification.js';
export * from './services/execution-storage.js';
export * from './services/executor.js';
export * from './types/index.js';

/**
 * Parses CLI command-line arguments into a structured command object.
 */
function parseCliArgs(args: string[]): {
  command: string;
  issueId?: string;
  repoPath?: string;
  overwrite: boolean;
} {
  let command = 'info';
  let issueId: string | undefined;
  let repoPath: string | undefined;
  let overwrite = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--ping') {
      command = 'ping';
    } else if (arg === 'linear:whoami' || arg === '--whoami') {
      command = 'linear:whoami';
    } else if (arg === 'linear:issues' || arg === '--issues') {
      command = 'linear:issues';
    } else if (arg === 'linear:issue' || arg === '--issue-details') {
      command = 'linear:issue';
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        issueId = args[++i];
      }
    } else if (arg === 'plan' || arg === '--plan') {
      command = 'plan';
    } else if (arg === 'implement' || arg === '--implement' || arg === 'execute') {
      command = 'implement';
    } else if (arg === '--issue' || arg === '-i') {
      issueId = args[++i];
    } else if (arg === '--repo' || arg === '-r') {
      repoPath = args[++i];
    } else if (arg === '--overwrite' || arg === '-f') {
      overwrite = true;
    } else if (!arg.startsWith('-') && command === 'info') {
      if (arg.includes('-') && /^[a-zA-Z]+-\d+$/.test(arg)) {
        // If an issue identifier like PRO-906 was passed directly
        issueId = arg;
      }
    }
  }

  return { command, issueId, repoPath, overwrite };
}

/**
 * Main application entry point for DevFlow AI.
 */
export async function main(): Promise<void> {
  const config = getAppConfig();
  const cliArgs = parseCliArgs(process.argv.slice(2));

  const linear = new LinearAdapter(config);
  const antigravity = new AntigravityAdapter(config);
  const planner = new TicketPlanner(config, antigravity);

  switch (cliArgs.command) {
    case 'linear:whoami': {
      console.log('Verifying Linear connection...');
      try {
        const viewer = await linear.getViewer();
        console.log('\n--- Authenticated Linear User ---');
        console.log(`ID:           ${viewer.id}`);
        console.log(`Name:         ${viewer.name}`);
        console.log(`Email:        ${viewer.email || 'N/A'}`);
        console.log(`Display Name: ${viewer.displayName || 'N/A'}`);
      } catch (err: unknown) {
        console.error('\nLinear connection check failed:', (err as Error).message);
        process.exitCode = 1;
      }
      break;
    }

    case 'linear:issues': {
      console.log('Fetching assigned Linear issues...');
      try {
        const issues = await linear.getAssignedIssues();
        console.log(`\nFound ${issues.length} assigned issue(s):\n`);
        if (issues.length === 0) {
          console.log('No open issues assigned to you.');
          return;
        }

        console.log(
          'IDENTIFIER'.padEnd(12) +
          'PRIORITY'.padEnd(12) +
          'STATE'.padEnd(18) +
          'TITLE'
        );
        console.log('-'.repeat(75));

        for (const issue of issues) {
          const priority = issue.priorityLabel || String(issue.priority);
          const state = issue.state?.name || 'Unknown';
          console.log(
            issue.identifier.padEnd(12) +
            priority.padEnd(12) +
            state.padEnd(18) +
            issue.title
          );
        }
      } catch (err: unknown) {
        console.error('\nFailed to retrieve assigned issues:', (err as Error).message);
        process.exitCode = 1;
      }
      break;
    }

    case 'linear:issue': {
      const targetId = cliArgs.issueId;
      if (!targetId) {
        console.error('Error: Please provide an issue identifier (e.g. "PRO-906").');
        console.error('Usage: npm run linear:issue -- <IDENTIFIER>');
        process.exitCode = 1;
        return;
      }

      console.log(`Fetching issue "${targetId}" from Linear...`);
      try {
        const issue = await linear.getIssue(targetId);
        if (!issue) {
          console.error(`Issue "${targetId}" was not found in Linear.`);
          process.exitCode = 1;
          return;
        }

        console.log('\n======================================================');
        console.log(`[${issue.identifier}] ${issue.title}`);
        console.log('======================================================');
        console.log(`URL:      ${issue.url}`);
        console.log(`State:    ${issue.state?.name || 'Unknown'}`);
        console.log(`Priority: ${issue.priorityLabel || issue.priority}`);
        console.log(`Assignee: ${issue.assignee?.name || 'Unassigned'}`);
        console.log(`Labels:   ${issue.labels.map((l) => l.name).join(', ') || 'None'}`);
        console.log(`Created:  ${issue.createdAt}`);
        console.log('\n--- Description ---');
        console.log(issue.description || 'No description provided.');

        if (issue.comments.length > 0) {
          console.log(`\n--- Comments (${issue.comments.length}) ---`);
          for (const c of issue.comments) {
            console.log(`- [${c.user?.name || 'User'} at ${c.createdAt}]:\n  ${c.body}\n`);
          }
        }
      } catch (err: unknown) {
        console.error(`\nFailed to fetch issue "${targetId}":`, (err as Error).message);
        process.exitCode = 1;
      }
      break;
    }

    case 'plan': {
      const targetId = cliArgs.issueId;
      if (!targetId) {
        console.error('Error: Please specify an issue identifier via --issue <IDENTIFIER>.');
        console.error('Usage: npm run plan -- --issue <IDENTIFIER> [--repo <path>] [--overwrite]');
        process.exitCode = 1;
        return;
      }

      const targetRepo = cliArgs.repoPath || config.allowedWorkingDirs[0] || process.cwd();
      console.log(`Retrieving issue "${targetId}" from Linear...`);

      try {
        const issue = await linear.getIssue(targetId);
        if (!issue) {
          console.error(`Issue "${targetId}" was not found in Linear.`);
          process.exitCode = 1;
          return;
        }

        console.log(`Found issue: [${issue.identifier}] ${issue.title}`);
        console.log(`Target Repository: ${path.resolve(targetRepo)}`);
        console.log('Generating implementation plan via Antigravity CLI (this may take 15-30s)...');

        const result = await planner.generatePlan(issue, {
          repoPath: targetRepo,
          overwrite: cliArgs.overwrite,
        });

        console.log('\n======================================================');
        console.log('PLAN SUCCESSFULLY GENERATED');
        console.log('======================================================');
        console.log(`Plan file:    ${result.filePath}`);
        console.log(`Duration:     ${result.durationMs}ms`);
        console.log(`Branch:       ${result.branch}`);
        console.log(`Generated at: ${result.generatedAt}`);
        console.log('\nTo inspect the generated plan, open:');
        console.log(`file:///${result.filePath.replace(/\\/g, '/')}`);
      } catch (err: unknown) {
        console.error('\nPlan generation failed:', (err as Error).message);
        process.exitCode = 1;
      }
      break;
    }

    case 'implement': {
      if (!cliArgs.issueId) {
        console.error('Error: --issue <IDENTIFIER> is required for implementation execution (e.g., --issue SAH-6).');
        process.exitCode = 1;
        return;
      }

      console.log(`Validating implementation eligibility for ${cliArgs.issueId}...`);
      const executor = new ImplementationExecutor({ config, antigravityAdapter: antigravity });

      try {
        const session = await executor.startExecutionSession({
          issueIdentifier: cliArgs.issueId,
          repoPath: cliArgs.repoPath,
          useIsolation: true,
        });

        console.log(`\nExecution Session Created: ${session.id}`);
        console.log(`Status:      ${session.status}`);
        console.log(`Repository:  ${session.repositoryPath}`);
        console.log(`Working Dir: ${session.workingPath}`);
        console.log(`Isolated:    ${session.isIsolated ? 'Yes (Worktree)' : 'No (Direct repo)'}`);
        console.log(`Message:     ${session.progressMessage}`);
        console.log('\nTrack live execution progress via the dashboard at http://localhost:4000');
      } catch (err: unknown) {
        console.error('\nImplementation execution failed:', (err as Error).message);
        process.exitCode = 1;
      }
      break;
    }

    case 'ping': {
      console.log('\nExecuting harmless ping prompt ("Respond with pong")...');
      const result = await antigravity.executePrompt({
        workingDir: config.allowedWorkingDirs[0],
        prompt: 'Respond with pong',
        outputFormat: 'json',
      });

      console.log(`Success: ${result.success}`);
      console.log(`Duration: ${result.durationMs}ms`);
      console.log(`Exit Code: ${result.exitCode}`);
      if (result.parsedOutput) {
        console.log(`Response: ${result.parsedOutput.response?.trim()}`);
        console.log(`Conversation ID: ${result.parsedOutput.conversation_id}`);
      } else {
        console.log(`Stdout: ${result.stdout}`);
        console.log(`Stderr: ${result.stderr}`);
      }
      if (result.error) {
        console.error(`Error: ${result.error}`);
      }
      break;
    }

    default: {
      console.log('--- DevFlow AI (Milestone 2: Linear Integration & Ticket Planning) ---');
      console.log(`Antigravity Binary: ${config.antigravityBinPath}`);
      console.log(`Allowed Repos:      ${config.allowedWorkingDirs.join(', ')}`);
      console.log(`Plans Directory:    ${config.plansDir}`);
      console.log(`Linear Endpoint:    ${config.linearApiUrl}`);
      console.log(`Linear Configured:  ${config.linearApiKey ? 'Yes (API key provided)' : 'No (LINEAR_API_KEY missing)'}`);
      console.log('\nAvailable CLI commands:');
      console.log('  npm run linear:whoami               - Verify Linear connection and show authenticated user');
      console.log('  npm run linear:issues               - List assigned tickets');
      console.log('  npm run linear:issue -- <ID>        - View issue description and comments');
      console.log('  npm run plan -- --issue <ID>        - Generate implementation plan for issue');
      console.log('  node dist/index.js --ping           - Self-test Antigravity CLI ping harness');
      break;
    }
  }
}

// Auto-run if executed as script
if (process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'))) {
  main().catch((err) => {
    console.error('Fatal application error:', err);
    process.exit(1);
  });
}
