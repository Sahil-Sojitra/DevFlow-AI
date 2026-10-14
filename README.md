# DevFlow AI — Local-First Developer Automation

DevFlow AI connects tickets (Linear) to the local Google Antigravity CLI for controlled, repository-aware implementation planning, verification, and human review on Windows.

---

## Milestone Status

- **Milestone 1**: Project Foundation & Antigravity CLI Adapter (Complete)
- **Milestone 2**: Linear Integration & Repository-Aware Ticket Planning (Complete)
- **Milestone 3**: Local Next.js Developer Dashboard & Plan Review Workflow (Complete)
- **Milestone 4**: Controlled Implementation & Verification (Complete)

---

## Key Features & Architecture

1. **Local Next.js Developer Dashboard (Phase 3 Addition)**:
   - Modern, responsive local web interface built with **Next.js (App Router)** and **React 19**.
   - Binds strictly to `localhost` (`http://localhost:3000`) for private developer use.
   - **Sidebar**: Quick navigation across Overview, My Tickets, Plan Review, Repositories, and Settings with live Antigravity and Linear status indicators.
   - **Ticket Inbox**: Searchable, filterable assigned ticket list with priority/status badges and deep inspection modals (description, acceptance criteria, comments, author timestamps).
   - **Plan Review Workspace**: Dual-selector for tickets and allowed repositories, branch indicators, pre-existing uncommitted change warnings, interactive plan generation, Markdown plan reader, and persistent Approve/Reject decision controls.
   - **Repository Registry**: Server-side containment registry verifying allowed repositories, active branches, and Git clean/dirty states.
   - **Settings & Safety Policies**: Read-only overview of verified paths, execution modes, and containment rules without exposing credentials.

2. **Local-First & Zero Paid AI API Dependencies**:
   - Uses the locally installed, verified Google Antigravity CLI (`agy.exe`) in non-interactive print mode (`--print ... --output-format json`).
   - Requires no paid OpenAI, Anthropic, or external cloud LLM API tokens.

3. **Official Linear GraphQL Integration**:
   - Read-only connection to Linear's official GraphQL API (`https://api.linear.app/graphql`).
   - Queries viewer identity (`viewer`) and retrieves assigned tickets (`IssueFilter: { assignee: { id: { eq: viewer.id } } }`).
   - Supports cursor-based pagination (`pageInfo { hasNextPage, endCursor }`).
   - Retrieves descriptions, acceptance criteria, comments, priorities, labels, and relations.
   - Robust error handling: authentication (401/403), rate limits (429), GraphQL errors, and network timeouts.
   - Credentials protection: `LINEAR_API_KEY` is scrubbed from error messages and never passed to Antigravity or the browser.

4. **Repository-Aware Implementation Planning**:
   - Gathers repository context safely: project structure, package scripts, project instructions (`GEMINI.md`, `README.md`), and relevant source files.
   - **Security Exclusions**: Strictly ignores `.env`, private keys (`.pem`, `.key`), credentials, tokens, `node_modules`, and `.git`.
   - **Repository Containment**: Execution is strictly confined to whitelisted paths in `DEVFLOW_ALLOWED_WORKING_DIRS`.
   - **Factual & Honest Prompting**: The planner explicitly instructs the agent to flag missing backend contracts, endpoints, or requirements under *Risks & Unresolved Questions* rather than hallucinating or inventing answers    - **Plan Storage & Review State**: Saves structured Markdown plans to `data/plans/<ISSUE-ID>.md` with frontmatter metadata. Persists approval and rejection decisions with developer notes in `data/plans/reviews.json`.

5. **Controlled Implementation & Verification (Milestone 4 Addition)**:
   - **Explicit Authorization Only**: Implementation can only begin when the plan has been formally reviewed and `approved`. Approval alone never starts execution; a human must explicitly confirm execution via the dashboard modal or CLI.
   - **Working Tree Protection & Git Worktree Isolation**: Detects staged, unstaged, and untracked files. If the working tree has uncommitted changes, DevFlow automatically runs the implementation in an isolated Git worktree (`<repo>/.devflow/worktrees/<sessionId>`), guaranteeing the user's main working tree is never overwritten or reset. If isolation fails, execution on a dirty repository is strictly blocked.
   - **Controlled Antigravity Agent**: Implements the approved plan within strict boundaries. Concurrency guards prevent duplicate runs on the same repository or issue. Environment secrets are strictly scrubbed.
   - **Automated Verification Pipeline**: Inspects `package.json` for configured scripts (`typecheck`, `test`, `lint`, `build`). Executes configured checks sequentially and records pass/fail status, duration, and output. Unconfigured checks are marked as `not configured`.
   - **Changed Files & Unified Diff Inspector**: Distinguishes pre-existing changes from changes introduced during the session. Provides full unified syntax-highlighted diffs in the dashboard.
   - **Zero Automatic Deployments Guarantee**: Never automatically commits, pushes, merges, or deploys. The developer retains full control.

---

## Project Structure

```text
DevFlow/
├── src/
│   ├── index.ts               # CLI entry point (Linear commands, plan generator, implement runner)
│   ├── app/                   # Next.js App Router (Dashboard & API endpoints)
│   │   ├── layout.tsx         # Root layout with dark theme & typography
│   │   ├── page.tsx           # Main developer dashboard page
│   │   ├── globals.css        # Design tokens, dark theme, and Markdown styles
│   │   └── api/               # Server-side REST API routes
│   │       ├── status/        # System health & secret-redacted status
│   │       ├── tickets/       # Assigned Linear tickets & ticket details
│   │       ├── repositories/  # Configured allowed repository registry
│   │       ├── plans/         # Plan listing, generation, and review approval
│   │       └── sessions/      # Execution session listing, start, cancel, and diff
│   ├── components/            # React UI components
│   │   ├── Sidebar.tsx        # Navigation sidebar with connection badges & active sessions
│   │   ├── OverviewView.tsx   # Overview metrics, greeting, and recent activity
│   │   ├── TicketsView.tsx    # Searchable, filterable ticket inbox
│   │   ├── TicketDetailModal.tsx # Full ticket description & comments modal
│   │   ├── PlanReviewView.tsx # Plan generation, approve/reject & execution trigger
│   │   ├── ExecutionConfirmationModal.tsx # Pre-flight checklist & isolation confirmation
│   │   ├── ExecutionSessionsView.tsx # Live monitoring, diffs, logs, & verification cards
│   │   ├── RepositoriesView.tsx # Allowed repositories & Git status inspector
│   │   └── SettingsView.tsx   # Security policies & configuration status
│   ├── adapters/
│   │   ├── antigravity.ts     # Antigravity CLI process adapter with safety controls
│   │   └── linear.ts          # Read-only Linear GraphQL adapter
│   ├── services/
│   │   ├── planner.ts         # Repository inspection and plan generation service
│   │   ├── plan-storage.ts    # Safe plan file storage & review decisions service
│   │   ├── repo-registry.ts   # Repository allowlist & Git inspection service
│   │   ├── git-ops.ts         # Working tree status, worktree isolation, & diff generation
│   │   ├── verification.ts    # Configured project checks (typecheck, test, lint, build)
│   │   ├── execution-storage.ts # Session persistence, concurrency locks, & log storage
│   │   └── executor.ts        # Controlled implementation & verification orchestrator
│   ├── config/
│   │   └── env.ts             # Zod-validated environment configuration
│   └── types/
│       ├── antigravity.ts     # Antigravity types and schemas
│       ├── linear.ts          # Linear issue, comment, and user schemas
│       ├── execution.ts       # Session state transitions, verification, and diff types
│       └── index.ts           # Types barrel export
├── tests/
│   └── unit/                  # Comprehensive unit test suite (71 tests across 13 suites)
├── data/
│   ├── plans/                 # Generated implementation plans & reviews.json
│   └── sessions/              # Persisted execution sessions (*.json)
├── next.config.mjs            # Next.js configuration (Webpack extension alias)
├── tsconfig.json              # Full project & Next.js TypeScript configuration
├── tsconfig.build.json        # Standalone build configuration for CLI binary
├── vitest.config.ts           # Vitest configuration with @/ path alias
├── package.json               # Dependencies and scripts
└── README.md
```

---

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `LINEAR_API_KEY` | Linear Personal API Key ([Linear API Settings](https://linear.app/settings/api)) | *Required for Linear commands & ticket inbox* |
| `LINEAR_API_URL` | Linear GraphQL endpoint | `https://api.linear.app/graphql` |
| `ANTIGRAVITY_BIN_PATH` | Path to `agy.exe` | `%LOCALAPPDATA%\agy\bin\agy.exe` |
| `DEVFLOW_ALLOWED_WORKING_DIRS` | Semicolon/comma-separated whitelist of allowed repositories | Current working directory |
| `DEVFLOW_PLANS_DIR` | Directory where generated markdown plans are stored | `data/plans` |
| `DEVFLOW_TIMEOUT_MS` | Process timeout for Antigravity executions (ms) | `60000` |
| `DEVFLOW_INTEGRATION_TEST` | Enable live Antigravity integration test (`true`/`false`) | `false` |
| `LINEAR_INTEGRATION_TEST` | Enable live Linear integration test (`true`/`false`) | `false` |

---

## Dashboard Usage (Phase 3)

### Start Local Dashboard
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Dashboard Workflows
1. **Overview**: View your assigned ticket count, saved plan count, pending reviews, and connected integrations.
2. **My Tickets**:
   - Search across ticket IDs (`SAH-5`), titles, descriptions, and labels.
   - Filter by status (`Backlog`, `In Progress`, `Todo`, `Done`).
   - Click **View Details** to inspect requirements and comment history.
   - Click **Plan** to immediately stage the ticket for implementation planning.
3. **Plan Review**:
   - Select any assigned ticket or existing plan.
   - Choose the target repository from the server allowlist.
   - Check the active branch and uncommitted changes alert.
   - Click **Generate Plan** to run Antigravity.
   - Review the generated plan tasks, API contracts, verification plan, and assumptions.
   - Click **Approve Plan** or **Reject Plan** (with optional developer notes). Decisions are saved to `data/plans/reviews.json`.
4. **Repositories**: Inspect verified allowed repository paths, Git branches, and working tree clean/dirty states.
5. **Settings**: Review active security boundaries, verified binary paths, and secret redaction guarantees.

---

## CLI Usage (Preserved from M1 & M2)

You can also use DevFlow AI entirely from the command line:

```bash
# Verify Linear connection and show authenticated user
npm run linear:whoami

# List assigned Linear tickets
npm run linear:issues

# Inspect a specific ticket (e.g. SAH-5)
npm run linear:issue -- SAH-5

# Generate a plan for an issue
npm run plan -- --issue SAH-5

# Overwrite an existing plan
npm run plan -- --issue SAH-5 --overwrite

# Self-test ping to the local Antigravity CLI
node dist/index.js --ping
```

---

## Verification & Testing

### 1. Typecheck
```bash
npm run typecheck
```

### 2. Run Automated Unit Tests (Mocked API & CLI)
```bash
npm test
```
*Runs all 43 unit tests covering:*
- Linear viewer authentication and issue filtering.
- Cursor-based pagination.
- Linear HTTP 401, 403, 429, 500, and GraphQL errors.
- Network timeouts and response validation.
- API key scrubbing from error messages and server responses.
- Repository allowlist enforcement and Git status checks.
- Plan storage, path traversal defenses, and reviews persistence.
- Concurrency lock preventing duplicate simultaneous plan generations.
- Overwrite protection for plan files.
- Antigravity process invocation, timeout, and concurrency lock.

### 3. Production Build
```bash
npm run build
```
*Compiles the standalone CLI binary (`tsc -p tsconfig.build.json`) and Next.js production web bundle (`next build --webpack`).*

### 4. Opt-In Live Integration Tests
Live tests require explicit opt-in flags and are excluded from default test runs:

- **Antigravity CLI**:
  ```powershell
  $env:DEVFLOW_INTEGRATION_TEST="true"; npm run test:integration
  ```
- **Linear GraphQL API**:
  ```powershell
  $env:LINEAR_INTEGRATION_TEST="true"; npm run test:integration
  ```

---

## Limitations & Guardrails

1. **Localhost Only**: The dashboard server binds strictly to `127.0.0.1` and is designed for single-user local use.
2. **Read-Only Linear Integration**: DevFlow AI does not mutate Linear issues, change ticket statuses, or add comments.
3. **No Automatic Code Changes**: Plan generation is read-only. **Plan approval in Milestone 3 does NOT trigger code implementation, file edits, or script executions.**
4. **No Automatic Git Commits or Push**: Git commit, push, or merge actions are intentionally omitted.
5. **Honest Unknowns**: When API contracts or requirements are absent from ticket details, the generated plan highlights them under *Risks, Assumptions and Unresolved Questions* rather than assuming or inventing backend behavior.
