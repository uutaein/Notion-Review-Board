# MVP Acceptance Test Cases

## Scope

- PRD 13.1 P0 — 1차 MVP
- SRS section 13.3 Acceptance Tests
- SRS section 17 MVP 완료 정의
- `feature/mvp-acceptance/mvp-acceptance.feature`

These cases define the MVP release gate. Feature files remain specification documents until
Cucumber step definitions exist, so live Electron checks must be recorded separately from
`npm run test:features:dry`.

## Acceptance Cases

| ID             | Source             | Type        | Scenario                                              | Expected result                                                                                 | Current evidence                                                                                                 | Status              |
| -------------- | ------------------ | ----------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------- |
| TC-MVP-001     | SRS 17.1; FR-001~3 | Live manual | Save and verify a real Notion token                   | Connection state can be verified without exposing the token in UI/logs                           | Notion connection IPC/preload/renderer tests pass; user has previously confirmed source integration works         | Manual recheck      |
| TC-MVP-002     | SRS 17.2; FR-010~22 | Live manual | Register at least one Notion DB/Data Source           | Source is saved with field mapping and appears in the Source list                                | Source CRUD, field mapping, preload, and renderer tests pass; user has registered real Sources                    | Manual recheck      |
| TC-MVP-003     | SRS 17.3; FR-030~32 | Automated   | Collect pages using all/tag/checkbox collection modes | Collection rules accept valid pages, reject schema mismatch, and handle empty results            | Collection Engine and Manual Sync orchestration tests pass                                                       | Supporting verified |
| TC-MVP-004     | SRS 17.4; FR-040~45 | Live manual | Run manual sync for all Sources and a selected Source | Sync reports Source-level progress/result and persists successful Source results                 | Manual Sync service/IPC/preload/renderer tests pass; live all/selected Source behavior needs final pass           | Manual recheck      |
| TC-MVP-005     | SRS 17.6~7; FR-043~45; FR-050~54 | Live manual | Show unified Today Review after sync                  | Active due items from one or more Sources appear in one queue; shared pages are not duplicated   | Today Review service/IPC/preload/renderer and Source filter tests pass; user has confirmed queue behavior         | Manual recheck      |
| TC-MVP-006     | SRS 17.8; FR-060~62 | Live manual | Open the selected page in the embedded internal viewer | Page opens inside the right viewer panel, resizes with layout, and external fallback remains     | Document Viewer URL policy, IPC, preload, renderer state-model, bounds, and build tests pass; user confirmed live | Manual recheck      |
| TC-MVP-007     | SRS 17.9~10; FR-070~72 | Live manual | Rate a page as Good                                   | Review Log is created, dueAt/FSRS state are updated atomically, and the item leaves current queue | Scheduler, DB transaction, IPC, preload, and renderer tests pass; user has confirmed queue removal                | Manual recheck      |
| TC-MVP-008     | SRS 17.11; FR-080~83 | Live manual | Handle a changed page                                 | Changed page is excluded from Today Review and can be pulled today or kept on existing schedule  | Status Pages service/DB/IPC/preload/renderer tests pass                                                          | Manual recheck      |
| TC-MVP-009     | SRS 17.11; FR-090~92 | Live manual | View missing/deleted candidates                       | Missing/deleted candidates are excluded from Today Review and visible in the dedicated screen    | Status Pages read-only list service/IPC/preload/renderer tests pass                                              | Manual recheck      |
| TC-MVP-010     | SRS 17.13; NFR-SEC | Automated   | Preserve Electron and token security boundaries       | Renderer has narrow preload APIs, no generic invoke bridge, no Node access to Notion content     | IPC/preload tests pass across connection, sync, review, status, and viewer paths                                 | Supporting verified |
| TC-MVP-011     | SRS 17.14           | Automated   | Run project regression checks                         | Typecheck, regression tests, and production build pass                                           | `npm test` passes 42 files/429 tests; `npm run test:screen` build step passes on 2026-06-17                      | Supporting verified |
| TC-MVP-012     | SRS 17.5; FR-046   | Live manual | Show the full active Review Queue                     | Active due and future items appear in due order; non-active statuses remain excluded             | Review Queue service, IPC, preload, renderer state-model tests, and mock-preload Playwright screen test pass; live Electron display needs final pass | Manual recheck      |

## MVP Release Gate

MVP can be marked complete when:

1. TC-MVP-001, 002, 004, 005, 006, 007, 008, 009, and 012 are manually rechecked in the live Electron app.
2. TC-MVP-003, 010, and 011 remain green on the final candidate commit.
3. Open deletion policy work remains explicitly scoped out of MVP actions beyond read-only
   missing/deleted candidate visibility.
4. The final manual pass records date, tester, Notion workspace fixture or real Source name, and
   any observed limitations in `MEMORY.md`.

## Non-Blocking MVP Notes

- Cucumber scenarios are still undefined and are not executable release evidence.
- Missing/deleted state-changing actions remain blocked by SRS-OPEN-003.
- Kanban is P1-specified and not required for MVP completion.
