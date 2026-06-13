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
- Active Feature: changed and missing/deleted status pages
- Active SRS IDs:
  - SRS-FR-050
  - SRS-FR-051
  - SRS-FR-052
  - SRS-FR-030
  - SRS-FR-031
  - SRS-FR-032
  - SRS-FR-040
  - SRS-FR-041
  - SRS-FR-042
  - SRS-FR-043
  - SRS-FR-044
  - SRS-FR-045
  - SRS-FR-070
  - SRS-FR-071
  - SRS-FR-072
  - SRS-FR-081
  - SRS-FR-092
  - SRS-FR-093

## Current Decision Summary

- Notion Page is the review unit.
- Notion DB/Data Source is Review Source.
- Database inputs with multiple Data Sources are rejected; users must enter a Data Source directly.
- Duplicate normalized Notion Targets are rejected.
- Source deletion supports archive, delete tombstone, and keep-history policies.
- Review Logs are preserved for every Source deletion policy.
- `orphaned` status and `system-deleted` sentinel Source are not used.
- Changed pages do not automatically alter dueAt.
- Missing pages are not immediately deleted.

## Last Completed

- PRD v0.1 drafted.
- SRS v0.1-draft drafted.
- MVP acceptance tests listed.
- Root TRACEABILITY.md created to connect PRD, SRS, Feature, TC, code, tests, and status.
- AGENTS.md updated from the previous reservation project to the current Notion Review Board context.
- Shared agent rules now cover Gemini/Codex roles, Electron security, SDD traceability, and automatic handoff updates.
- ADR-015 accepted for Source target resolution, uniqueness, deletion policies, and log preservation.
- SRS-OPEN-002 and SRS-OPEN-004 closed by ADR-015.
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
- Implemented Notion connection settings UI on the main screen with a masked token input, explicit
  save, connection verification, confirmed deletion, pending-state duplicate prevention, and
  sanitized user messages.
- Added shared Notion connection status type in `src/shared/notion-connection.ts`.
- Renderer Notion connection state-model tests cover TC-NOTION-CONN-UI-001 ~ 010 across 1 file and
  12 tests.
- Mock-preload browser verification confirmed password input, token clearing after save, no token
  text in rendered UI, and connected-state display after verification.
- Full regression now passes 19 files and 254 tests; production build passes.
- Implemented a dedicated Notion integration tab separate from Today Review. Today Review now shows
  review content and Manual Sync only; Notion connection and Review Source registration live under
  `Notion 연동`.
- Implemented the initial Review Source registration and field-mapping renderer flow: target input,
  property discovery, collection mode conditional fields, title/URL/category/tag/origin/edited
  selectors, all/tag/checkbox collection settings, Source save, Source listing, and enabled toggle.
- Renderer Source settings state-model tests cover property loading, required fields, mode-specific
  requirements, all/tag Source creation payloads, duplicate target warning, sanitized metadata
  errors, and enabled toggling across 1 file and 8 tests.
- Mock-preload browser verification confirmed tab separation, Source creation, Source list display,
  Manual Sync source selector refresh, and no 1440px horizontal overflow.
- Full regression now passes 20 files and 262 tests; production build passes.
- Replaced the hardcoded Today Review sample rows with a restricted `review:list-today` IPC,
  preload `todayReview.list`, shared Today Review DTOs, and renderer state binding.
- Today Review now reloads from SQLite on app mount and after manual sync completes.
- Focused Today Review IPC, preload, and renderer state-model verification passes 3 files and 15
  tests; full typecheck passes.
- Full regression now passes 23 files and 277 tests; production build passes.
- Electron dev app was restarted after the Today Review renderer data-binding change.
- Limited the Today Review queue panel height and moved Review Item cards into an internal
  scrollable list so long queues do not stretch the whole workspace.
- Renderer typecheck passes after the queue scroll change.
- Added Review Source edit and delete controls to the Notion integration tab using the existing
  `source:update` and `source:delete` preload/IPC contract.
- Source delete requires an explicit policy selection before confirmation.
- Focused Source settings renderer verification passes 1 file and 12 tests; renderer typecheck
  passes.
- Source update now exits edit mode and clears the form so a new Source can be registered
  immediately; the edit header also exposes an explicit `새 Source` reset action.
- Connected the Today Review rating buttons to the existing FSRS SchedulingService through a
  restricted `review:rate` IPC channel and `reviewRating.rate` preload API.
- The Main Process now composes SchedulingService with the existing FSRS adapter and
  `DatabaseService.recordReview` transaction, so accepted ratings update Review Item scheduling and
  create Review Logs atomically.
- Rating buttons disable while a submission is pending, reject duplicate rapid clicks in renderer
  state, refresh Today Review after success, and display sanitized public errors after failure.
- Same-day FSRS results such as `hard` and `again` can still be due today in storage, so the
  renderer removes the completed item from the current Today Review session after a successful
  rating to satisfy the "current Today Review" removal rule.
- Added Today Review Source filtering through the existing Manual Sync Source controls. Selecting
  or syncing a single Source shows that Source's queue, while full sync resets to the full queue.
  Source filtering is enforced in the Main Process service with
  `ReviewItem.sourceIds.includes(sourceId)` so shared pages appear under every referenced Source.
- Focused Review Rating IPC, preload, and renderer state-model verification passes 3 files and 17
  tests; full typecheck passes.
- Focused Today Review service, IPC, preload, and renderer state-model verification passes 4 files
  and 36 tests after adding Source filtering.
- Full regression now passes 26 files and 300 tests.
- Added a read-only Status Pages path for `변경된 페이지` and `삭제된 페이지`.
- Added `docs/test-cases/status-pages.md` for changed/missing/deleted list visibility while leaving
  state-changing actions out of scope until deletion confirmation policy is closed.
- Added restricted `status-pages:list` IPC, `statusPages.list` preload API, StatusPageService, SQLite
  status lookup, and renderer state binding.
- The status pages show title, Source, status, Notion Page ID, URL open action, dueAt, last review,
  last sync, Notion edit time, and missing/deleted detection timestamps without exposing FSRS state.
- Added changed-page handling actions: `오늘 복습으로 당기기` sets the changed item back to active
  with dueAt at the action timestamp, and `기존 일정 유지` sets the item back to active while
  preserving dueAt and fsrsState.
- Changed-page actions are persisted atomically with one `user_action` Sync Event and do not create
  Review Logs.
- Focused Status Pages service, IPC, preload, and renderer state-model verification passes 4 files
  and 41 tests; full typecheck passes.
- Full regression now passes 30 files and 349 tests; production build passes.

## Next Action

- Verify the live Electron UI for `변경된 페이지` and `삭제된 페이지` against real changed/missing
  data.
- Verify the live Electron UI for changed-page actions against real changed data.
- Consider adding component-level DOM automation if renderer test dependencies are introduced.

## Open Questions

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
- Notion token settings UI is implemented and mock-browser verified; actual token save/verify
  against the user's workspace still needs live Electron verification.
- Review Source registration UI is implemented and mock-browser verified; real Notion property
  discovery and Source save remain to be verified with the user's database.
- Today Review renderer now reads real SQLite-backed items through IPC, but live Electron/Notion
  display has not yet been rechecked after this change.
- Today Review queue scroll behavior has only been typechecked; visual confirmation in the running
  Electron window remains manual.
- Review Source edit/delete UI has focused state-model coverage but still needs live Electron
  confirmation against existing real Sources.
- The Source edit-to-new flow has focused state-model coverage but still needs live Electron
  confirmation.
- Review Rating IPC/preload/renderer binding has focused automated coverage, but live Electron UI
  rating against the user's synced data has not yet been manually confirmed.
- Today Review Source filtering through the Manual Sync controls has focused automated coverage but
  still needs live Electron UI confirmation against the user's real Sources.
- Missing/deleted status pages remain read-only. They intentionally do not implement deletion
  confirmation, recovery, archive, or history-preservation actions yet.
- The internal Notion document viewer remains a placeholder; selected items currently support
  external browser opening only.
- Full `npm run format:check` currently fails on 52 pre-existing files; the two changed Feature files
  were not reported.
- Current code uses `orphaned` status and `system-deleted` Source contrary to accepted ADR-015.
- ADR-015 requires a migration before the Source deletion backend can be considered verified.
- No standalone TEST_MATRIX exists; `docs/test-cases/*.md` currently serves as the test matrix.

## Regression Scope

- Token setting
- Source CRUD
- Sync
- Today Review
- Review Rating
