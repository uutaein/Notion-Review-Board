# MEMORY.md

## Current Project

- Product: Notion Review Board
- Runtime: Electron Desktop
- Primary Platform: Windows
- Storage: SQLite
- Review Engine: FSRS
- Timezone: Asia/Seoul

## Current Phase

- Phase: SRS → Feature → TC
- Active Feature: manual-sync + collection-engine
- Active SRS IDs:
  - SRS-FR-030
  - SRS-FR-031
  - SRS-FR-032
  - SRS-FR-040
  - SRS-FR-041
  - SRS-FR-042
  - SRS-FR-043
  - SRS-FR-044
  - SRS-FR-045
  - SRS-FR-093

## Current Decision Summary

- Notion Page is the review unit.
- Notion DB/Data Source is Review Source.
- Review Log must be preserved by default.
- Changed pages do not automatically alter dueAt.
- Missing pages are not immediately deleted.

## Last Completed

- PRD v0.1 drafted.
- SRS v0.1-draft drafted.
- MVP acceptance tests listed.
- Root TRACEABILITY.md created to connect PRD, SRS, Feature, TC, code, tests, and status.
- AGENTS.md updated from the previous reservation project to the current Notion Review Board context.
- Shared agent rules now cover Gemini/Codex roles, Electron security, SDD traceability, and automatic handoff updates.
- Verification baseline: 11 Vitest files and 152 tests passed; typecheck passed.
- Cucumber Feature scenarios are specifications only; dry-run reports undefined steps.
- Collection Engine Feature now separates candidate selection from synchronization orchestration.
- Manual Sync Feature now covers all-active and single-Source execution, progress/result reporting,
  partial Source failure, pagination, rate-limit cancellation, and Review Item merge rules.
- Manual Sync and Collection Engine TC are defined in
  `docs/test-cases/manual-sync-collection-engine.md`.
- The TC contract uses Source-unit atomic persistence after complete pagination and preserves
  successful results from other Sources.
- Focused Prettier check passed for the new TC document.
- TC validation found 79 unique cases with no duplicate IDs.
- Cucumber dry-run completed; scenarios remain undefined because step definitions do not exist.
- Implemented `CollectionEngine` for equals, contains, checkbox, collect-all, empty-result, and
  schema-mismatch behavior.
- Implemented Manual Sync Source selection, complete pagination before persistence, normalized Page
  ID deduplication, Collection Engine invocation, per-Source aggregation, progress, partial Source
  failure isolation, and cancellation without persistence.
- Focused verification passes 2 files and 25 tests.
- Full regression passes 13 files and 177 tests.
- Full typecheck, focused ESLint, focused Prettier, and `git diff --check` pass.
- Implemented SQLite `applySourceResult` as a Source-unit transaction.
- Reconciliation creates scheduled active items, updates metadata without changing dueAt/FSRS/logs,
  detects changed and missing items, merges Source references, preserves the first primary Source,
  removes only the absent Source from shared items, records Sync Events, and advances Source
  `lastSyncedAt` only on commit.
- Focused collection, orchestration, and persistence verification passes 3 files and 34 tests.
- Full regression now passes 14 files and 186 tests.
- Implemented finite, injectable rate-limit retry with structured `Retry-After`, fallback delay,
  retry-count limit, total-wait budget, cancellation during wait, and sanitized exhausted failure.
- Invalid non-finite retry policies are rejected before Notion access.
- Focused collection, orchestration, retry, and persistence verification passes 3 files and 46 tests.
- Full regression now passes 14 files and 198 tests.
- Implemented the production Notion Data Source query adapter with token isolation, fixed API
  version and page size, cursor pagination, mapped Sync DTOs, sanitized HTTP/transport errors,
  structured Retry-After handling, cancellation preservation, and malformed-response rejection.
- Focused Notion query adapter verification passes 1 file and 14 tests.
- Full regression now passes 15 files and 212 tests; full typecheck passes.
- Implemented privileged Manual Sync IPC for sync-all, single-Source sync, cancellation, and
  structured progress delivery.
- IPC rejects untrusted senders, invalid payloads, overlapping runs, and invalid cancellation before
  privileged service access.
- Preload exposes only `syncAll`, `syncSource`, `cancel`, and fixed-channel `onProgress` methods.
- Composed Notion query, Collection Engine, SQLite persistence, FSRS initialization, finite retry,
  and Manual Sync services in the Electron Main Process.
- AbortSignal-triggered Notion `AbortError` is handled as cancellation without failure persistence.
- Focused Manual Sync IPC, preload, and orchestration verification passes 3 files and 43 tests.
- Full regression now passes 17 files and 233 tests; full typecheck and production build pass.
- Implemented the Manual Sync renderer flow on the main review screen: sync-all, enabled
  single-Source selection, disabled Source exclusion, running/cancelling states, cancellation,
  aggregate counts, Source-level success/failure/cancelled results, and sanitized public messages.
- Added shared Manual Sync DTO types in `src/shared/manual-sync.ts` for Main, preload, and renderer
  contracts.
- Renderer Manual Sync state-model tests cover TC-SYNC-UI-001 ~ 010 across 1 file and 9 tests.
- Mock-preload browser verification confirmed the panel renders, disabled Sources are excluded,
  sync-all completion displays counts and Source status, and no horizontal overflow occurs at
  1440px.
- Full regression now passes 18 files and 242 tests; production build passes.

## Next Action

- Add live Electron/manual end-to-end verification with a real or controlled Notion sync fixture.
- Consider adding component-level DOM automation if renderer test dependencies are introduced.

## Open Questions

- SRS-OPEN-002: Database vs Data Source compatibility
- SRS-OPEN-003: deleted 확정 기준
- SRS-OPEN-010: FSRS state serialization

## Risk Notes

- Notion API version changes may affect data source query behavior.
- Electron viewer must not expose Node.js to remote content.
- Token must never appear in logs/UI.
- Do not mark Feature scenarios verified until step definitions or equivalent executable evidence exist.
- Source-unit atomic persistence is now the TC contract: pagination completes before mutation, a
  failed Source rolls back, and already committed Sources remain preserved.
- Manual Sync renderer behavior is implemented and mock-browser verified; live Electron/Notion
  end-to-end verification has not been performed.
- Full `npm run format:check` currently fails on 52 pre-existing files; the two changed Feature files
  were not reported.

## Regression Scope

- Token setting
- Source CRUD
- Sync
- Today Review
- Review Rating
