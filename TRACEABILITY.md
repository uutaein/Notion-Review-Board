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
| Test cases | `docs/test-cases/*.md`                 | Four feature areas currently covered    |
| Code       | `src/**`                               | Incremental implementation              |

## Functional Traceability

| PRD                     | SRS                                       | Feature                                                                                                          | TC                                                                                              | Code and automated test evidence                                                                                                                                                                                                       | Status             |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 7.1 Notion 연동 설정    | SRS-FR-001 ~ 003; SRS-NFR-SEC-006/008/010 | `feature/notion-connection/notion-connection.feature`                                                            | `docs/test-cases/notion-connection.md`; TC-NOTION-CONN-001 ~ 026                                | `src/main/services/notion/connection.ts`; `src/main/ipc/notion-connection.ts`; `src/preload/index.ts`; `src/main/services/notion/__tests__/notion-connection.test.ts`                                                                  | Backend Verified   |
| 7.2 Review Source 등록  | SRS-FR-010 ~ 013                          | `feature/review-source/review-source.feature`                                                                    | `docs/test-cases/review-source-field-mapping.md`; TC-SOURCE-001 ~ 027; TC-SOURCE-IPC-001 ~ 005  | `src/main/services/source/index.ts`; `src/main/ipc/source-mapping.ts`; `src/main/services/source/__tests__/source.test.ts`; `src/main/ipc/__tests__/source-mapping.test.ts`                                                            | Partially Verified |
| 7.3 필드 매핑           | SRS-FR-020 ~ 022                          | `feature/field-mapping/field-mapping.feature`                                                                    | `docs/test-cases/review-source-field-mapping.md`; TC-MAPPING-001 ~ 016; TC-SOURCE-IPC-001 ~ 005 | `src/main/services/notion/source-metadata.ts`; `src/main/ipc/source-mapping.ts`; `src/main/services/notion/__tests__/source-metadata.test.ts`; `src/main/ipc/__tests__/source-mapping.test.ts`                                         | Partially Verified |
| 7.4 복습 대상 수집 기준 | SRS-FR-030 ~ 032                          | `feature/collection-rules/collection-rules.feature`                                                              | No dedicated TC document                                                                        | No dedicated collection execution service/test confirmed                                                                                                                                                                               | Specified          |
| 7.5 통합 Review Queue   | SRS-FR-043 ~ 045                          | `feature/synchronization/synchronization.feature`; `feature/mvp-acceptance/mvp-acceptance.feature`               | No dedicated synchronization/queue TC document                                                  | Domain and repository primitives exist, but synchronization implementation/test was not confirmed                                                                                                                                      | Specified          |
| 7.6 오늘 복습 목록      | SRS-FR-050 ~ 054                          | `feature/today-review/today-review.feature`                                                                      | `docs/test-cases/today-review.md`; TC-REVIEW-001 ~ 015                                          | `src/main/services/review/index.ts`; `src/main/services/review/__tests__/today-review-service.test.ts`; `src/main/services/review/__tests__/today-review-integration.test.ts`; `src/main/services/database/__tests__/database.test.ts` | Backend Verified   |
| 7.7 목록 보기 방식      | SRS-FR-052 ~ 054                          | `feature/today-review/today-review.feature`                                                                      | `docs/test-cases/today-review.md`; TC-REVIEW-007 ~ 012                                          | `src/main/services/review/index.ts`; `src/main/services/review/__tests__/today-review-service.test.ts`                                                                                                                                 | Backend Verified   |
| 7.8 문서 뷰어           | SRS-FR-060 ~ 062; SRS-NFR-SEC-001 ~ 005   | `feature/document-viewer/document-viewer.feature`                                                                | No dedicated TC document                                                                        | No viewer implementation/test confirmed                                                                                                                                                                                                | Specified          |
| 7.9 복습 평가           | SRS-FR-070 ~ 072; SRS-NFR-REL-002         | `feature/review-scheduling/review-scheduling.feature`                                                            | `docs/test-cases/review-rating-fsrs.md`; TC-FSRS-001 ~ 016                                      | `src/main/services/scheduler/index.ts`; `src/main/services/scheduler/fsrs-engine.ts`; `src/main/services/scheduler/__tests__/*.test.ts`; `src/main/services/database/__tests__/database.test.ts`                                       | Backend Verified   |
| 7.10 칸반 보드          | SRS-FR-100                                | `feature/kanban-board/kanban-board.feature`                                                                      | No dedicated TC document                                                                        | No implementation/test confirmed                                                                                                                                                                                                       | P1 Specified       |
| 7.11 삭제된 페이지 화면 | SRS-FR-090 ~ 092                          | `feature/missing-deleted-pages/missing-deleted-pages.feature`                                                    | No dedicated TC document                                                                        | Status transition primitives exist in `src/shared/domain`, but feature implementation/test was not confirmed                                                                                                                           | Specified          |
| 7.12 변경된 페이지 화면 | SRS-FR-080 ~ 083                          | `feature/changed-pages/changed-pages.feature`                                                                    | No dedicated TC document                                                                        | Status primitives exist, but changed-page workflow implementation/test was not confirmed                                                                                                                                               | Specified          |
| 7.13 동기화             | SRS-FR-040 ~ 045; SRS-FR-093              | `feature/synchronization/synchronization.feature`; `feature/missing-deleted-pages/missing-deleted-pages.feature` | No dedicated TC document                                                                        | No synchronization orchestration implementation/test confirmed                                                                                                                                                                         | Specified          |
| 13.3 MVP 인수           | Cross-feature MVP requirements            | `feature/mvp-acceptance/mvp-acceptance.feature`                                                                  | No dedicated end-to-end TC document                                                             | No executable Cucumber steps or end-to-end test confirmed                                                                                                                                                                              | Specified          |

## Supporting Traceability

| PRD                       | SRS                                                   | Code/Test                                                                          | Status             |
| ------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------ |
| 8 데이터 모델 방향        | SRS sections 7 and 8                                  | `src/shared/domain/*.ts`; `src/main/services/database/*.ts`; domain/database tests | Partially Verified |
| 9 비즈니스 규칙           | SRS sections 6 and 8                                  | `src/shared/domain/*.ts`; `src/shared/domain/__tests__/domain.test.ts`             | Partially Verified |
| 10.1 Electron 데스크톱 앱 | SRS section 5; SRS-NFR-SEC-001 ~ 005                  | `src/main/index.ts`; `src/preload/index.ts`                                        | Partially Verified |
| 10.2 SQLite 저장          | SRS section 7; SRS-NFR-REL-002/005; SRS-NFR-MAINT-003 | `src/main/services/database/*.ts`; database integration tests                      | Partially Verified |
| 10.3 Notion API 제약      | SRS-FR-041/042; SRS-NFR-REL-003                       | Connection and metadata clients exist; sync pagination/retry tests not confirmed   | Partially Verified |
| 10.4 Notion 토큰 저장     | SRS-FR-001 ~ 003; SRS-NFR-SEC-006                     | Connection service and tests                                                       | Backend Verified   |
| 11 주요 화면 방향         | SRS section 11; SRS-NFR-UX-001 ~ 005                  | `src/renderer/src/App.vue`; no mapped UI TC automation confirmed                   | Specified          |
| 14 미확정 사항            | SRS-OPEN-001 ~ 010                                    | `docs/notion-review-board-srs-v0.1.md` section 15                                  | Open               |

## Current Coverage Gaps

| Gap                                                      | Required next artifact                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| Collection rules have no dedicated TC set                | Add TC for SRS-FR-030 ~ 032                                            |
| Synchronization and queue merge have no dedicated TC set | Add TC for SRS-FR-040 ~ 045 and SRS-FR-093                             |
| Document viewer has no dedicated TC set                  | Add security and fallback TC for SRS-FR-060 ~ 062                      |
| Changed-page workflow has no dedicated TC set            | Add TC for SRS-FR-080 ~ 083                                            |
| Missing/deleted workflow has no dedicated TC set         | Add TC for SRS-FR-090 ~ 093                                            |
| Renderer UI cases are documented but not automated       | Implement UI, then map UI test files to the existing `*-UI-*` cases    |
| Cucumber Features are not executable                     | Add step definitions only when executable BDD is intentionally adopted |
| MVP acceptance Feature has no end-to-end evidence        | Add an explicit MVP acceptance test strategy and executable cases      |

## Verification Baseline

Verified on 2026-06-12:

| Command                     | Result                                                        |
| --------------------------- | ------------------------------------------------------------- |
| `npm test`                  | Passed: 11 files, 152 tests                                   |
| `npm run typecheck`         | Passed                                                        |
| `npm run test:features:dry` | Command completed; all Feature scenarios have undefined steps |

## Maintenance Rule

Update this file in the same change when any of the following occurs:

1. A PRD or SRS requirement is added, removed, or renumbered.
2. A Feature or TC is added or materially changed.
3. Implementation code is introduced for a previously specified requirement.
4. Automated verification is added, removed, or changes status.
5. A requirement moves between MVP, P1, or another delivery scope.
