# DevFlow AI — Local-First Developer Automation

DevFlow AI connects tickets (Linear) to the local Google Antigravity CLI for controlled, repository-aware implementation planning, verification, and human review.

---

## Milestone Status

- **Milestone 1**: Project Foundation & Antigravity CLI Adapter (Complete)
- **Milestone 2**: Linear Integration & Repository-Aware Ticket Planning (Complete)

---

## Key Features & Architecture

1. **Local-First & Zero Paid AI API Dependencies**:
   - Uses the locally installed, verified Google Antigravity CLI (`agy.exe`) in non-interactive print mode (`--print ... --output-format json`).
   - Requires no paid OpenAI, Anthropic, or external LLM API tokens.

2. **Official Linear GraphQL Integration**:
   - Read-only connection to Linear's official GraphQL API (`https://api.linear.app/graphql`).
   - Queries viewer identity (`viewer`) and retrieves assigned tickets (`IssueFilter: { assignee: { id: { eq: viewer.id } } }`).
   - Supports cursor-based pagination (`pageInfo { hasNextPage, endCursor }`).
   - Retrieves descriptions, acceptance criteria, comments, priorities, labels, and relations.
   - Comprehensive error handling: authentication (401/403), rate limits (429), GraphQL errors, and timeouts.
   - Credentials protection: `LINEAR_API_KEY` is scrubbed from error messages and never passed to Antigravity.

3. **Repository-Aware Implementation Planning**:
   - Gathers repository context safely: project structure, package scripts, project instructions (`GEMINI.md`, `README.md`), and relevant source files.
   - **Security Exclusions**: Strictly ignores `.env`, private keys (`.pem`, `.key`), credentials, tokens, `node_modules`, and `.git`.
   - **Repository Containment**: Execution is confined to whitelisted paths in `DEVFLOW_ALLOWED_WORKING_DIRS`.
   - **Factual & Honest Prompting**: The planner explicitly instructs the agent to flag missing backend contracts, endpoints, or requirements under *Risks & Unresolved Questions* rather than hallucinating or inventing answers.
   - **Plan Storage**: Saves structured markdown plans to `data/plans/<ISSUE-ID>.md` with frontmatter metadata. Includes overwrite protection by default.

---

## Project Structure

```text
DevFlow/
├── src/
│   ├── index.ts               # CLI entry point (Linear commands, plan generator, ping harness)
│   ├── adapters/
│   │   ├── antigravity.ts     # Antigravity CLI process adapter with safety controls
│   │   └── linear.ts          # Read-only Linear GraphQL adapter
│   ├── services/
│   │   └── planner.ts         # Repository inspection and plan generation service
│   ├── config/
│   │   └── env.ts             # Zod-validated environment configuration
│   └── types/
│       ├── antigravity.ts     # Antigravity types and schemas
│       ├── linear.ts          # Linear issue, comment, and user schemas
│       └── index.ts           # Types barrel export
├── tests/
│   ├── unit/
│   │   ├── antigravity.test.ts # Antigravity process adapter unit tests (mocked spawn)
│   │   ├── linear.test.ts      # Linear GraphQL unit tests (mocked fetch)
│   │   ├── planner.test.ts     # Repository planner & security tests
│   │   └── config.test.ts      # Environment configuration tests
│   └── integration/
│       ├── antigravity.integration.test.ts # Opt-in live Antigravity test
│       └── linear.integration.test.ts      # Opt-in live Linear GraphQL test
├── data/
│   └── plans/                 # Generated implementation plan markdown files
├── .env.example               # Template environment configuration
├── .gitignore                 # Excludes .env, dist/, data/plans/ scratch files
├── package.json               # Scripts and dependencies
├── tsconfig.json              # TypeScript NodeNext configuration
├── vitest.config.ts           # Vitest configuration
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
| `LINEAR_API_KEY` | Linear Personal API Key ([Linear API Settings](https://linear.app/settings/api)) | *Required for Linear commands* |
| `LINEAR_API_URL` | Linear GraphQL endpoint | `https://api.linear.app/graphql` |
| `ANTIGRAVITY_BIN_PATH` | Path to `agy.exe` | `%LOCALAPPDATA%\agy\bin\agy.exe` |
| `DEVFLOW_ALLOWED_WORKING_DIRS` | Semicolon/comma-separated whitelist of allowed repositories | Current working directory |
| `DEVFLOW_PLANS_DIR` | Directory where generated markdown plans are stored | `data/plans` |
| `DEVFLOW_TIMEOUT_MS` | Process timeout for Antigravity executions (ms) | `60000` |
| `DEVFLOW_INTEGRATION_TEST` | Enable live Antigravity integration test (`true`/`false`) | `false` |
| `LINEAR_INTEGRATION_TEST` | Enable live Linear integration test (`true`/`false`) | `false` |

---

## CLI Usage & Workflow

### 1. Verify Linear Authentication
Test your credentials and display the authenticated Linear user:
```bash
npm run linear:whoami
```

### 2. List Assigned Issues
Retrieve issues assigned to your authenticated Linear account:
```bash
npm run linear:issues
```

### 3. Inspect a Specific Issue
View ticket details, description, acceptance criteria, and comments:
```bash
npm run linear:issue -- PRO-906
```

### 4. Generate an Implementation Plan
Generate a repository-aware plan using the local Antigravity CLI and save it to `data/plans/<ISSUE>.md`:
```bash
npm run plan -- --issue PRO-906
```
Optional flags:
- `--repo <path>`: Specify target repository path (must be in `DEVFLOW_ALLOWED_WORKING_DIRS`).
- `--overwrite`: Overwrite an existing plan if one was already generated for this issue.

### 5. Verify Local Antigravity CLI (Milestone 1 self-test)
```bash
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
*Runs all 30 unit tests covering:*
- Linear viewer authentication and issue filtering.
- Cursor-based pagination.
- Linear HTTP 401, 403, 429, 500, and GraphQL errors.
- Network timeouts and response validation.
- API key scrubbing from error messages.
- Repository path whitelist enforcement and sensitive file filtering (`.env`, `.key`).
- Overwrite protection for plan files.
- Antigravity process invocation, timeout, and concurrency lock.

### 3. Run Opt-In Live Integration Tests
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

1. **Read-Only Linear Integration**: DevFlow AI does not update ticket statuses, add comments, or mutate Linear issues.
2. **Read-Only Planning Phase**: The planner inspects repository context and outputs a Markdown plan under `data/plans/`. It does not modify repository source code.
3. **No Automatic Git Commits or Push**: Git commit, push, or merge actions are intentionally omitted.
4. **Honest Unknowns**: When API contracts or requirements are absent from ticket details, the generated plan highlights them under *Risks & Unresolved Questions* rather than assuming or inventing backend behavior.
