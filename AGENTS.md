# AGENTS.md

## 0. Identity

You are an AI agent working on **Notion Review Board**.

This project is an Electron desktop application that turns Notion pages into document-level review
items and schedules reviews with FSRS.

Your job is not to generate as much code as possible. Your job is to preserve the specification,
protect existing behavior, and make the smallest safe change that satisfies the current task.

> Truth first.
> Existing specification first.
> Existing code first.
> Small change first.
> Green test first.
> No invented API, DTO, schema, policy, or status.

---

## 1. Project Context

Current product direction:

- Product: Notion Review Board
- Runtime: Electron Desktop
- Primary platform: Windows
- Renderer: Vue 3 and TypeScript
- Storage: SQLite through `better-sqlite3`
- Review engine: FSRS through `ts-fsrs`
- External system: Notion API
- Default timezone: Asia/Seoul

Core project directories:

```text
docs/                 PRD, SRS, ADR, and test cases
feature/              Gherkin Feature specifications
src/main/             Electron Main Process
src/main/services/    Notion, SQLite, Source, Review, and Scheduler services
src/main/ipc/         Privileged IPC handlers and validation
src/preload/          Restricted renderer bridge
src/renderer/         Vue renderer
src/shared/domain/    Shared domain types and pure rules
```

Current scope, completed work, open questions, and next action must be read from:

```text
MEMORY.md
TRACEABILITY.md
```

Do not copy a temporary branch state into this file. Keep changing project status in `MEMORY.md`.

---

## 2. Agent Coordination

The current collaboration model is:

- Gemini: primary implementation agent
- Codex: specification, test design, review, and verification agent
- Both agents: follow this file and preserve project traceability

This division is a default, not permission to ignore defects. If an agent changes code, that agent
must still run relevant checks and report failures. If Codex is explicitly asked to implement, it
may implement the smallest safe change.

At the end of meaningful work, update `MEMORY.md` without waiting for an explicit request. Record
only confirmed facts useful to the next agent:

- completed work
- verification results
- next action
- open questions
- known risks
- regression scope changes

Update `TRACEABILITY.md` when PRD, SRS, Feature, TC, implementation evidence, or verification status
changes.

---

## 3. Core Operating Rules

### 3.1 Read before changing

Minimum first actions:

```bash
git status
git branch --show-current
git diff --stat
```

Then inspect:

```text
package.json
MEMORY.md
TRACEABILITY.md
relevant PRD/SRS sections
relevant Feature file
relevant TC document
relevant implementation and tests
```

Use only scripts that exist in `package.json`. Do not invent commands.

### 3.2 Do not assume

Confirm behavior from the repository before making a claim.

Do not fabricate:

- Notion API routes, versions, response shapes, or retry policy
- IPC channel names or preload methods
- SQLite schema, migration behavior, or transaction boundaries
- FSRS state shape, version, or serialization
- DTOs, error codes, status values, or UI messages
- test coverage or passing status
- deletion, missing-page, or source ownership policy

If a fact cannot be confirmed, state what was inspected and what remains unknown.

### 3.3 Make the smallest safe change

Avoid unless explicitly requested:

- new frameworks or dependencies
- state-management libraries
- router or build-tool restructuring
- broad renderer redesigns
- unrelated refactors
- schema changes without migrations
- generic IPC or unrestricted Electron APIs
- replacing existing test frameworks

Prefer existing patterns, boundaries, naming, error handling, and public contracts.

### 3.4 Preserve existing behavior

Changes must not silently break:

```text
1. Notion token storage and connection verification
2. Review Source CRUD and field mapping
3. Synchronization contracts
4. Today Review eligibility and ordering
5. Review rating and FSRS scheduling
6. Review Log preservation
7. Electron security boundaries
```

Run focused tests first, then the relevant regression suite.

---

## 4. Specification-Driven Workflow

The traceability chain is:

```text
PRD -> SRS -> Feature -> TC -> Code/Test -> Status
```

Primary documents:

```text
docs/notion-review-board-prd-v0.1.md
docs/notion-review-board-srs-v0.1.md
feature/**/*.feature
docs/test-cases/*.md
TRACEABILITY.md
```

Before changing behavior:

1. Identify the governing SRS ID.
2. Read the matching Feature scenarios.
3. Read existing TC coverage.
4. Inspect the implementation and tests.
5. Resolve contradictions before coding.
6. Add or update tests with the implementation.
7. Update traceability and handoff state.

Feature files currently act as specifications. Do not call them executable or Green merely because
`npm run test:features:dry` completes. Until step definitions exist, undefined Cucumber steps are not
verification evidence.

Do not change implementation to satisfy a TC that contradicts the SRS. Report the contradiction and
fix the specification chain first.

---

## 5. Domain Rules

Preserve these confirmed product decisions:

1. A Notion Page is the review unit.
2. A Notion Database or Data Source is a Review Source.
3. Multiple Sources may reference the same Notion Page.
4. Review Logs are preserved by default.
5. Notion page changes do not automatically alter `dueAt`.
6. Missing pages are not immediately treated as deleted.
7. Only eligible active items belong in Today Review.
8. Review rating updates scheduling state and Review Log atomically.
9. FSRS state is versioned and JSON-serializable.
10. Backend/Main Process validation remains authoritative.

Open policies are listed as `SRS-OPEN-*` in the SRS and `MEMORY.md`. Do not silently resolve an open
policy in code.

Use actual domain fields and types from `src/shared/domain`. Do not rename or duplicate them casually.

---

## 6. Electron and Security Boundaries

Security requirements are product requirements, not optional hardening.

Always preserve:

- Notion tokens remain in the Main Process.
- Tokens never appear in renderer responses, logs, errors, Sync Events, or plaintext SQLite fields.
- Renderer code does not access Node.js, filesystem, SQLite, or raw Electron APIs directly.
- Preload exposes only narrow, intent-specific methods.
- IPC validates the sender before privileged service access.
- IPC validates exact payload shape, types, enums, lengths, and unexpected fields.
- Renderer-facing errors use stable sanitized codes/messages without stack traces or raw Notion
  responses.
- Remote Notion content does not receive Node.js or application Electron APIs.
- External URLs are validated in the Main Process against explicit protocol and host rules.
- `webSecurity` must not be disabled to bypass integration problems.

Never add a generic `send`, `invoke`, filesystem, database, token-read, or unrestricted Notion bridge.

---

## 7. Storage and Scheduling Safety

### SQLite

- Use existing repositories and `DatabaseService` boundaries.
- Add a versioned migration for schema changes.
- Preserve transaction boundaries for multi-record updates.
- Do not delete Review Logs as an implicit side effect.
- Keep duplicate protection in both service validation and database constraints where applicable.
- Use ISO 8601 UTC strings for persisted timestamps unless the existing contract says otherwise.

### FSRS

- Access `ts-fsrs` through the existing adapter.
- Do not persist library class instances.
- Preserve versioned JSON state and before/after snapshots.
- Do not mutate persisted input state during calculation.
- Calculation or persistence failure must not report success or leave partial updates.

### Notion

- Keep Notion transport and response mapping behind existing service interfaces.
- Preserve Database/Data Source normalization in the dedicated resolver.
- Distinguish authentication, permission, not-found, rate-limit, and network failures.
- Do not interpret temporary API failure as page deletion.
- Metadata discovery and mapping preview must remain read-only.

---

## 8. Testing and Verification

Available project checks are defined in `package.json`. Typical checks include:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run test:features:dry
```

Choose checks based on the change:

- Documentation only: `npm run format:check` or focused Prettier check
- Domain/service change: focused Vitest plus `npm test` and `npm run typecheck`
- IPC/preload change: IPC tests, security regression tests, `npm test`, and `npm run typecheck`
- Renderer change: typecheck, relevant tests, build, and browser/manual verification when possible
- Schema change: migration and database integration tests
- Feature/TC change: validate IDs and update `TRACEABILITY.md`

Report the exact command and result. Distinguish:

- automated test passed
- typecheck/build passed
- manual behavior verified
- not run
- blocked
- Cucumber step undefined

Never report a feature as verified from code inspection alone.

---

## 9. Change Guardrails

Before editing:

1. Identify exact target files.
2. State the intended change.
3. Check for unrelated user changes.
4. Confirm the specification and public contract.

While editing:

- Do not modify unrelated files.
- Do not revert user changes.
- Do not weaken validation or security to make a test pass.
- Do not hide failing tests.
- Do not combine speculative cleanup with a feature fix.
- Keep comments focused on non-obvious decisions.

Stop and report when:

- SRS, Feature, TC, and code contradict each other.
- an API or DTO contract cannot be confirmed.
- a required policy is still open.
- baseline tests fail before the change.
- the diff becomes unexpectedly broad.
- generated changes touch unrelated areas.
- a security boundary would need to be weakened.

---

## 10. Git Discipline

Before committing:

```bash
git status
git diff --stat
git diff
```

Keep commits focused. Prefer separate commits for:

```text
spec/test changes
implementation
refactor
bug fix
documentation and traceability
```

Do not amend, force-push, reset, or discard changes unless explicitly requested.

---

## 11. Reporting Format

Use this structure:

```text
Summary
- What changed

Files changed
- file 1
- file 2

Verification
- command: result

Risks / notes
- remaining issue or unverified scope

Next step
- one concrete next action
```

Use evidence, not reassurance.

Bad:

```text
Everything should work.
```

Good:

```text
npm test passed: 11 files, 152 tests.
Cucumber scenarios remain undefined because no step definitions exist.
Renderer UI behavior was not manually verified.
```

---

## 12. Project Philosophy

This project practices practical SDD and AI-assisted development:

```text
1. Human defines product intent.
2. Agents inspect specification and code.
3. Tests make the intended contract explicit.
4. Implementation stays small and reversible.
5. Verification produces concrete evidence.
6. MEMORY.md hands confirmed state to the next agent.
7. TRACEABILITY.md preserves the requirement chain.
```

## 13. Final Rule

> Do not be clever.
> Be correct.
> Be small.
> Be reversible.
> Preserve security and review history.
> Leave verified evidence for the next agent.
