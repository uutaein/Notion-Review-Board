# TRACEABILITY.md

## Purpose

This document connects product intent to implementation evidence:

```text
PRD -> SRS -> Feature -> Test Case -> Code/Test -> Status
```

Use this file as the project-level traceability index. Detailed behavior remains in the linked
source documents.

## Status Rules

| Status             | Meaning                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Specified          | PRD, SRS, and Feature exist, but no dedicated TC or implementation was confirmed               |
| TC Defined         | Dedicated TC exists, but implementation evidence was not confirmed                             |
| Partially Verified | Some implementation tests pass, but TC coverage or UI/end-to-end coverage is incomplete        |
| Backend Verified   | Main-process/domain implementation tests pass; renderer UI remains unverified or unimplemented |
| Verified           | Required implementation and its identified automated tests pass                                |
| P1 Specified       | Post-MVP specification only                                                                    |

Feature files are specification documents at present. `npm run test:features:dry` reports undefined
steps, so a Feature file alone is not executable verification.

## Source Documents

| Artifact   | Path                                   | Document status                         |
| ---------- | -------------------------------------- | --------------------------------------- |
| PRD        | `docs/notion-review-board-prd-v0.1.md` | Draft                                   |
| SRS        | `docs/notion-review-board-srs-v0.1.md` | PRD v0.1 based draft                    |
| Features   | `feature/**/*.feature`                 | Specification; Cucumber steps undefined |
| Test cases | `docs/test-cases/*.md`                 | Seven feature areas currently covered   |
| Code       | `src/**`                               | Incremental implementation              |

## Functional Traceability

| PRD                     | SRS                                       | Feature                                                                                                          | TC                                                                                                                         | Code and automated test evidence                                                                                                                                                                                                                                                                                           | Status             |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 7.1 Notion 연동 설정    | SRS-FR-001 ~ 003; SRS-NFR-SEC-006/008/010 | `feature/notion-connection/notion-connection.feature`                                                            | `docs/test-cases/notion-connection.md`; TC-NOTION-CONN-001 ~ 026; TC-NOTION-CONN-UI-001 ~ 010                              | `src/main/services/notion/connection.ts`; `src/main/ipc/notion-connection.ts`; `src/preload/index.ts`; `src/renderer/src/composables/useNotionConnection.ts`; backend, IPC, preload, renderer state-model, and mock-browser UI verification pass                                                                           | Partially Verified |
| 7.2 Review Source 등록  | SRS-FR-010 ~ 013                          | `feature/review-source/review-source.feature`                                                                    | `docs/test-cases/review-source-field-mapping.md`; TC-SOURCE-001 ~ 034; TC-SOURCE-IPC-001 ~ 005; TC-SOURCE-UI-001 ~ 008     | `src/main/services/source/index.ts`; `src/main/ipc/source-mapping.ts`; `src/renderer/src/composables/useReviewSourceSettings.ts`; service, IPC, preload, renderer state-model tests, and mock-browser tab/UI verification pass                                                                                             | Partially Verified |
| 7.3 필드 매핑           | SRS-FR-020 ~ 022                          | `feature/field-mapping/field-mapping.feature`                                                                    | `docs/test-cases/review-source-field-mapping.md`; TC-MAPPING-001 ~ 016; TC-SOURCE-IPC-001 ~ 005; TC-MAPPING-UI-001/002/005 | `src/main/services/notion/source-metadata.ts`; `src/main/ipc/source-mapping.ts`; `src/renderer/src/composables/useReviewSourceSettings.ts`; property discovery and selector state-model tests pass; live Notion target verification remains incomplete                                                                     | Partially Verified |
| 7.4 복습 대상 수집 기준 | SRS-FR-030 ~ 032                          | `feature/collection-rules/collection-rules.feature`                                                              | `docs/test-cases/manual-sync-collection-engine.md`; TC-COLLECTION-001 ~ 018                                                | `src/main/services/collection/index.ts`; Collection Engine and Manual Sync target-selection tests pass                                                                                                                                                                                                                     | Backend Verified   |
| 7.5 통합 Review Queue   | SRS-FR-043 ~ 045                          | `feature/synchronization/synchronization.feature`; `feature/mvp-acceptance/mvp-acceptance.feature`               | `docs/test-cases/manual-sync-collection-engine.md`; TC-SYNC-022 ~ 042                                                      | `src/main/services/database/sync-persistence.ts`; SQLite tests cover create, update, schedule/log preservation, changed, missing, merge, idempotency, and rollback                                                                                                                                                         | Backend Verified   |
| 7.6 오늘 복습 목록      | SRS-FR-050 ~ 054                          | `feature/today-review/today-review.feature`                                                                      | `docs/test-cases/today-review.md`; TC-REVIEW-001 ~ 016; TC-REVIEW-UI-001/002/011                                           | `src/main/services/review/index.ts`; `src/main/ipc/today-review.ts`; `src/preload/index.ts`; `src/renderer/src/composables/useTodayReview.ts`; backend, IPC, preload, renderer state-model, Source filter, and database tests pass; live Electron/Notion display remains unverified                                        | Partially Verified |
| 7.7 목록 보기 방식      | SRS-FR-052 ~ 054                          | `feature/today-review/today-review.feature`                                                                      | `docs/test-cases/today-review.md`; TC-REVIEW-007 ~ 012; TC-REVIEW-UI-002                                                   | `src/main/services/review/index.ts`; `src/main/ipc/today-review.ts`; `src/renderer/src/composables/useTodayReview.ts`; due-sort service tests and renderer state-model tests pass; live UI display remains unverified                                                                                                      | Partially Verified |
| 7.8 문서 뷰어           | SRS-FR-060 ~ 062; SRS-NFR-SEC-001 ~ 005   | `feature/document-viewer/document-viewer.feature`                                                                | `docs/test-cases/document-viewer.md`; TC-VIEWER-001 ~ 009; TC-VIEWER-UI-001 ~ 003                                          | `src/main/services/document-viewer/index.ts`; `src/main/ipc/document-viewer.ts`; `src/preload/index.ts`; `src/renderer/src/composables/useDocumentViewer.ts`; embedded WebContentsView URL policy, bounds validation, IPC, preload, and renderer state-model tests pass; live internal Notion rendering remains unverified | Partially Verified |
| 7.9 복습 평가           | SRS-FR-070 ~ 072; SRS-NFR-REL-002         | `feature/review-scheduling/review-scheduling.feature`                                                            | `docs/test-cases/review-rating-fsrs.md`; TC-FSRS-001 ~ 016; TC-FSRS-UI-001 ~ 007                                           | `src/main/services/scheduler/index.ts`; `src/main/services/scheduler/fsrs-engine.ts`; `src/main/ipc/review-rating.ts`; `src/preload/index.ts`; `src/renderer/src/composables/useReviewRating.ts`; scheduler, database, IPC, preload, and renderer state-model tests pass                                                   | Partially Verified |
| 7.10 칸반 보드          | SRS-FR-100                                | `feature/kanban-board/kanban-board.feature`                                                                      | No dedicated TC document                                                                                                   | No implementation/test confirmed                                                                                                                                                                                                                                                                                           | P1 Specified       |
| 7.11 삭제된 페이지 화면 | SRS-FR-090 ~ 092                          | `feature/missing-deleted-pages/missing-deleted-pages.feature`                                                    | `docs/test-cases/status-pages.md`; TC-STATUS-002 ~ 004; TC-STATUS-IPC-001/002; TC-STATUS-UI-002                            | `src/main/services/status-pages/index.ts`; `src/main/ipc/status-pages.ts`; `src/preload/index.ts`; `src/renderer/src/composables/useStatusPages.ts`; missing/deleted read-only list service, IPC, preload, and renderer state-model tests pass                                                                             | Partially Verified |
| 7.12 변경된 페이지 화면 | SRS-FR-080 ~ 083                          | `feature/changed-pages/changed-pages.feature`                                                                    | `docs/test-cases/status-pages.md`; TC-STATUS-001/003/004/005/006/007/008; TC-STATUS-IPC-001/002/003; TC-STATUS-UI-001/003  | `src/main/services/status-pages/index.ts`; `src/main/ipc/status-pages.ts`; `src/preload/index.ts`; `src/renderer/src/composables/useStatusPages.ts`; changed list and handling actions pass service, DB transaction, IPC, preload, and renderer state-model tests                                                          | Partially Verified |
| 7.13 동기화             | SRS-FR-040 ~ 045; SRS-FR-093              | `feature/synchronization/synchronization.feature`; `feature/missing-deleted-pages/missing-deleted-pages.feature` | `docs/test-cases/manual-sync-collection-engine.md`; TC-SYNC-001 ~ 045; TC-SYNC-IPC-001 ~ 006; TC-SYNC-UI-001 ~ 010         | Manual Sync orchestration, Notion query mapping, finite Retry-After, cancellation, SQLite reconciliation, Main Process composition, privileged IPC, preload, renderer state-model tests, and mock-browser UI verification pass; live Electron/Notion E2E remains unverified                                                | Partially Verified |
| 13.3 MVP 인수           | Cross-feature MVP requirements            | `feature/mvp-acceptance/mvp-acceptance.feature`                                                                  | No dedicated end-to-end TC document                                                                                        | No executable Cucumber steps or end-to-end test confirmed                                                                                                                                                                                                                                                                  | Specified          |

## Supporting Traceability

| PRD                       | SRS                                                   | Code/Test                                                                                                                                       | Status             |
| ------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 8 데이터 모델 방향        | SRS sections 7 and 8                                  | `src/shared/domain/*.ts`; `src/main/services/database/*.ts`; domain/database tests                                                              | Partially Verified |
| 9 비즈니스 규칙           | SRS sections 6 and 8                                  | `src/shared/domain/*.ts`; `src/shared/domain/__tests__/domain.test.ts`                                                                          | Partially Verified |
| 10.1 Electron 데스크톱 앱 | SRS section 5; SRS-NFR-SEC-001 ~ 005                  | `src/main/index.ts`; `src/preload/index.ts`; Manual Sync composition and narrow preload tests pass                                              | Partially Verified |
| 10.2 SQLite 저장          | SRS section 7; SRS-NFR-REL-002/005; SRS-NFR-MAINT-003 | `src/main/services/database/*.ts`; database integration tests                                                                                   | Partially Verified |
| 10.3 Notion API 제약      | SRS-FR-041/042; SRS-NFR-REL-003                       | Connection, metadata, and sync query clients exist; pagination, Retry-After, cancellation, and sanitized error tests pass                       | Backend Verified   |
| 10.4 Notion 토큰 저장     | SRS-FR-001 ~ 003; SRS-NFR-SEC-006                     | Connection service, IPC, preload, renderer state-model tests, and mock-browser UI verification pass                                             | Partially Verified |
| 11 주요 화면 방향         | SRS section 11; SRS-NFR-UX-001 ~ 005                  | `src/renderer/src/App.vue`; Today Review and Notion integration are separated into tabs; focused state-model tests and mock-browser checks pass | Partially Verified |
| 14 미확정 사항            | SRS-OPEN-001 ~ 010                                    | `docs/notion-review-board-srs-v0.1.md` section 15                                                                                               | Open               |

## Current Coverage Gaps

| Gap                                                      | Required next artifact                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Notion connection live verification is incomplete        | Save and verify the user token in the Electron UI                                     |
| Review Source live registration is incomplete            | Register the user's Notion DB/Data Source through the UI                              |
| Manual Sync live end-to-end verification is incomplete   | Verify Electron UI against a real or controlled Notion sync fixture                   |
| Today Review live display is incomplete                  | Verify synced real Notion pages appear in the Today Review list                       |
| Document viewer live rendering remains unverified        | Verify allowed Notion pages render in the internal Electron document window           |
| Changed-page live handling remains unverified            | Verify pull-today and keep-schedule in Electron against real changed data             |
| Missing/deleted actions remain policy-blocked            | Close SRS-OPEN-003 before implementing confirmation/recovery/removal actions          |
| Renderer UI cases are documented but not automated       | Implement UI, then map UI test files to the existing `*-UI-*` cases                   |
| Cucumber Features are not executable                     | Add step definitions only when executable BDD is intentionally adopted                |
| MVP acceptance Feature has no end-to-end evidence        | Add an explicit MVP acceptance test strategy and executable cases                     |
| ADR-015 Source deletion policy differs from current code | Remove `orphaned`/`system-deleted`; add nullable Source and log snapshot migration TC |

## Verification Baseline

Verified on 2026-06-12:

| Command                     | Result                                                        |
| --------------------------- | ------------------------------------------------------------- |
| `npm test`                  | Passed: 11 files, 152 tests                                   |
| `npm run typecheck`         | Passed                                                        |
| `npm run test:features:dry` | Command completed; all Feature scenarios have undefined steps |

## Current Specification Notes

- `feature/collection-rules/collection-rules.feature` defines Collection Engine candidate selection
  separately from synchronization orchestration.
- `feature/synchronization/synchronization.feature` covers all-active and single-Source manual sync,
  progress and summary results, partial Source failure, pagination, rate-limit cancellation, new item
  creation, existing item updates, and cross-Source merge rules.
- `docs/test-cases/manual-sync-collection-engine.md` defines 18 collection cases, 45 sync cases, 6 IPC
  cases, and 10 deferred UI cases.
- Collection and synchronization interfaces compile under node and renderer TypeScript checks.
- Focused collection, orchestration, retry, and SQLite reconciliation verification passes 3 files
  and 46 tests.
- The production Notion query adapter maps Data Source pages without exposing raw payloads or tokens
  and has focused verification of 1 file and 14 tests.
- Manual Sync privileged IPC and preload cover TC-SYNC-IPC-001 ~ 006 with exact payload validation,
  single-run cancellation, sanitized errors, structured progress, and no generic invoke bridge.
- The Main Process composes Notion query, Collection Engine, SQLite reconciliation, FSRS
  initialization, and finite retry behind the restricted IPC boundary.
- Focused Manual Sync IPC, preload, and orchestration verification passes 3 files and 43 tests.
- Full regression passes 17 files and 233 tests; full typecheck and production build pass.
- Renderer Manual Sync state-model tests cover TC-SYNC-UI-001 ~ 010 in 1 file and 9 tests.
- Mock-preload browser verification confirms panel render, enabled Source selection, sync-all
  completion counts, Source status, and no 1440px horizontal overflow.
- Full regression passes 18 files and 242 tests; production build passes.
- Notion connection renderer state-model tests cover TC-NOTION-CONN-UI-001 ~ 010 in 1 file and 12
  tests.
- Mock-preload browser verification confirms password input, token clearing after save, no token
  text in rendered UI, and connected-state display after verification.
- Full regression passes 19 files and 254 tests; production build passes.
- Review Source settings renderer tests cover property loading, required fields, mode-specific
  requirements, all/tag create payloads, duplicate target warnings, sanitized metadata errors, and
  enabled toggling in 1 file and 8 tests.
- Review Source settings renderer tests now also cover edit loading, cancel, update payloads,
  delete confirmation, and explicit delete policies in 1 file and 12 tests.
- Mock-preload browser verification confirms Today Review and Notion integration tab separation,
  Source creation, Source list display, Manual Sync source selector refresh, and no 1440px
  horizontal overflow.
- Full regression passes 20 files and 262 tests; production build passes.
- Manual Sync remains `Partially Verified` until live Electron/Notion end-to-end behavior is
  verified.
- Notion connection remains `Partially Verified` until live Electron token save and verification are
  completed.
- Review Source and Field Mapping remain `Partially Verified` until live Notion property discovery
  and Source registration are completed with the user's database.
- Today Review renderer now loads SQLite-backed items through restricted IPC instead of hardcoded
  sample rows; focused IPC, preload, and renderer state-model tests pass, but live Electron display
  remains unverified.
- Today Review Source filtering is implemented through `filter: { kind: 'source', sourceId }` and
  uses `ReviewItem.sourceIds` in the Main Process service so shared pages can appear under each
  referenced Source. The renderer drives this from the existing Manual Sync Source controls instead
  of separate queue tabs. Focused service, IPC, preload, and renderer state-model tests pass.
- Review Rating now has restricted IPC, narrow preload exposure, Main Process SchedulingService
  composition, pending-state duplicate prevention, sanitized renderer errors, and focused
  IPC/preload/renderer state-model tests. It remains `Partially Verified` until live Electron rating
  behavior is manually confirmed against synced data.
- Status Pages now provide `변경된 페이지` handling actions and read-only `삭제된 페이지` lists through
  restricted IPC, narrow preload exposure, a Main Process service, and renderer state-model tests.
  Missing/deleted state-changing actions remain unimplemented pending open deletion policy
  resolution.
- Document Viewer now has dedicated TC coverage for SRS-FR-060 ~ 062 and a restricted
  Notion-URL-only internal/external open path. Automated tests cover URL policy, sandboxed window
  options, IPC validation, preload exposure, and renderer state messages. Live Notion content
  rendering remains unverified.

## Maintenance Rule

Update this file in the same change when any of the following occurs:

1. A PRD or SRS requirement is added, removed, or renumbered.
2. A Feature or TC is added or materially changed.
3. Implementation code is introduced for a previously specified requirement.
4. Automated verification is added, removed, or changes status.
5. A requirement moves between MVP, P1, or another delivery scope.
