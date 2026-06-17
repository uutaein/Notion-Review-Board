# Review Queue Test Cases

## Scope

This test set covers `feature/review-queue/review-queue.feature`:

- SRS-FR-043: new Review Item creation evidence feeds the queue
- SRS-FR-044: metadata updates remain visible without changing schedules
- SRS-FR-045: cross-Source Review Item merge remains one queue item
- SRS-FR-046: full active Review Queue visibility
- SRS-NFR-SEC-008/010: restricted IPC/preload and sanitized errors

The full Review Queue view is read-only. Rating, exclusion, changed-page handling, missing/deleted
handling, and Review Log mutation remain covered by their dedicated test sets.

## Required Public Contract

Implement:

- `createReviewQueueService({ reader })`
- `ReviewQueueService.list()`
- restricted IPC channel `review-queue:list`
- narrow preload API `reviewQueue.list()`

The renderer-facing DTO must not include FSRS internal state, tokens, raw Notion responses, stack
traces, repository entities, or Review Log internals.

## Test Data Baseline

Unless a case states otherwise, timestamps are ISO 8601 UTC strings and the queue is evaluated with
the local app timezone left at the product default, `Asia/Seoul`.

| Fixture | Required fields | Purpose |
| --- | --- | --- |
| `source-dev` | id `source-dev`, name `개발 학습`, enabled `true` | Primary Source for due active item |
| `source-ai` | id `source-ai`, name `AI 학습`, enabled `true` | Secondary Source for future/shared item |
| `rq-active-due` | status `active`, dueAt `2026-06-16T15:00:00.000Z`, sourceIds [`source-dev`] | Active item that can also appear in Today Review |
| `rq-active-future` | status `active`, dueAt `2026-07-01T00:00:00.000Z`, sourceIds [`source-ai`, `source-dev`] | Future-due active item that must still appear in the full queue |
| `rq-active-tie-a` / `rq-active-tie-b` | both status `active`, identical dueAt, ids ordered alphabetically | Deterministic tie-break verification |
| `rq-changed` | status `changed` | Non-active status exclusion |
| `rq-missing` | status `missing` | Non-active status exclusion |
| `rq-deleted` | status `deleted` | Non-active status exclusion |
| `rq-sync-error` | status `sync_error` | Non-active status exclusion |
| `rq-archived` | status `archived` | Non-active status exclusion |
| `rq-shared-page` | one Review Item for one Notion Page ID with sourceIds [`source-ai`, `source-dev`] | Merged Source display without duplicate queue rows |

## Service Cases

### TC-QUEUE-001: Active Future Items Are Included

- Requirement: SRS-FR-046
- Preconditions: `rq-active-due` and `rq-active-future` exist with status `active`.
- Steps:
  1. Create `ReviewQueueService` with a reader containing both fixtures.
  2. Call `ReviewQueueService.list()`.
- Expected result:
  - The service asks the reader for `['active']` statuses only.
  - The result contains both `rq-active-due` and `rq-active-future`.
  - `totalCount` equals the number of returned active rows.
  - `isEmpty` is `false` and `emptyReason` is `null`.
- Automated evidence: `src/main/services/review/__tests__/review-queue-service.test.ts`.

### TC-QUEUE-002: Non-Active Statuses Are Excluded

- Requirement: SRS-FR-046
- Preconditions: The reader contains active fixtures plus `rq-changed`, `rq-missing`, `rq-deleted`,
  `rq-sync-error`, and `rq-archived`.
- Steps:
  1. Call `ReviewQueueService.list()`.
  2. Inspect returned item ids and statuses.
- Expected result:
  - Every returned item has status `active`.
  - No `changed`, `missing`, `deleted`, `sync_error`, or `archived` item appears in `items`.
  - Excluded statuses are not converted, deleted, archived again, or otherwise mutated by the list
    operation.
- Automated evidence: `src/main/services/review/__tests__/review-queue-service.test.ts`.

### TC-QUEUE-003: Queue Uses Deterministic Due Ordering

- Requirement: SRS-FR-046
- Preconditions: The reader contains active items with different `dueAt` values and
  `rq-active-tie-a` / `rq-active-tie-b` with the same `dueAt`.
- Steps:
  1. Call `ReviewQueueService.list()`.
  2. Read the returned `items` order.
- Expected result:
  - `sort` is `due`.
  - Items are ordered by `dueAt` ascending.
  - Items with identical `dueAt` are ordered by `id` ascending.
- Automated evidence: `src/main/services/review/__tests__/review-queue-service.test.ts`.

### TC-QUEUE-004: Queue DTO Contains Only Safe Display Metadata

- Requirement: SRS-FR-046; SRS-NFR-SEC-010
- Preconditions: `rq-active-future` has title, primary Source, merged Source ids, category, tags,
  origin label, dueAt, lastReviewedAt, lastSyncedAt, status, and Notion URL.
- Steps:
  1. Call `ReviewQueueService.list()`.
  2. Inspect the projected DTO for `rq-active-future`.
- Expected result:
  - DTO includes `id`, `title`, `sourceId`, `sourceName`, `sourceNames`, `displayCategory`, `tags`,
    `originLabel`, `dueAt`, `lastReviewedAt`, `lastSyncedAt`, `status`, and `notionUrl`.
  - Empty category/tag values are displayed as `미분류`.
  - DTO does not include token values, FSRS serialized state, repository entities, Review Log rows,
    raw Notion responses, stack traces, or internal database paths.
- Automated evidence: `src/main/services/review/__tests__/review-queue-service.test.ts`;
  `src/shared/review-queue.ts`.

### TC-QUEUE-005: Shared Notion Page Appears Once With Source References

- Requirement: SRS-FR-045; SRS-FR-046
- Preconditions: `rq-shared-page` represents one Notion Page collected through `source-ai` and
  `source-dev`.
- Steps:
  1. Call `ReviewQueueService.list()`.
  2. Count rows for the shared Review Item id or Notion Page identity.
  3. Inspect `sourceName` and `sourceNames`.
- Expected result:
  - The shared page is represented by one queue row.
  - `sourceName` is the primary Source display name.
  - `sourceNames` contains each referenced Source display name once.
  - The list operation does not create a second Review Item or alter Source ownership.
- Automated evidence: `src/main/services/review/__tests__/review-queue-service.test.ts`;
  SQLite merge behavior remains covered in `docs/test-cases/manual-sync-collection-engine.md`.

### TC-QUEUE-006: Empty Active Queue Returns Explicit Empty State

- Requirement: SRS-FR-046
- Preconditions: No Review Item has status `active`.
- Steps:
  1. Call `ReviewQueueService.list()`.
- Expected result:
  - `items` is an empty array.
  - `totalCount` is `0`.
  - `isEmpty` is `true`.
  - `emptyReason` is `no-active-items`.
  - `sort` remains `due`.
- Automated evidence: `src/main/services/review/__tests__/review-queue-service.test.ts`.

## IPC And Preload Cases

### TC-QUEUE-IPC-001: Untrusted Sender Is Rejected Before Service Access

- Requirement: SRS-NFR-SEC-008
- Preconditions: `review-queue:list` is registered and `isValidSender(event)` returns `false`.
- Steps:
  1. Invoke the IPC handler with an untrusted event.
- Expected result:
  - Handler rejects with sanitized code `UNAUTHORIZED_SENDER`.
  - Stack trace is blank in the renderer-facing error.
  - `ReviewQueueService.list()` is not called.
- Automated evidence: `src/main/ipc/__tests__/review-queue.test.ts`.

### TC-QUEUE-IPC-002: Renderer Payload Is Rejected

- Requirement: SRS-NFR-SEC-008
- Preconditions: `review-queue:list` is registered and sender validation succeeds.
- Steps:
  1. Invoke the handler with each unexpected payload: `{}`, `{ sort: 'random' }`, `'source-1'`,
     and `null`.
- Expected result:
  - Each invocation rejects with `INVALID_PAYLOAD`.
  - `ReviewQueueService.list()` is not called for invalid payload attempts.
  - No filter, sort, Source id, status, or pagination contract is accepted until specified.
- Automated evidence: `src/main/ipc/__tests__/review-queue.test.ts`.

### TC-QUEUE-IPC-003: Backend Errors Are Sanitized

- Requirement: SRS-NFR-SEC-010
- Preconditions: `ReviewQueueService.list()` throws an error containing raw persistence or Notion
  details.
- Steps:
  1. Invoke `review-queue:list`.
- Expected result:
  - Renderer-facing error message is `INTERNAL_ERROR`.
  - Stack trace is blank.
  - Raw SQLite, token, file path, and Notion response text are not exposed.
- Automated evidence: `src/main/ipc/__tests__/review-queue.test.ts`.

### TC-QUEUE-PRELOAD-001: Preload Exposes Only The Intent-Specific API

- Requirement: SRS-NFR-SEC-008
- Preconditions: preload script is loaded in an isolated renderer context.
- Steps:
  1. Inspect `window.reviewQueue`.
  2. Call `window.reviewQueue.list()`.
- Expected result:
  - `window.reviewQueue` exposes exactly `list`.
  - It does not expose generic `invoke`, database, filesystem, token, or raw Notion access.
  - `list()` invokes only the fixed `review-queue:list` channel and sends no renderer payload.
- Automated evidence: `src/preload/__tests__/review-queue-preload.test.ts`.

## Renderer State Cases

### TC-QUEUE-UI-001: Sidebar Opens The Full Queue View

- Requirement: SRS-FR-046
- Preconditions: Renderer starts on the Today Review screen with `window.reviewQueue.list`
  available.
- Steps:
  1. Click the sidebar control named `전체 큐`.
- Expected result:
  - The active view changes from Today Review to the full Review Queue view.
  - The view heading shows `전체 큐`.
  - Loading the view calls `reviewQueue.list()` once for the full active queue.
- Automated evidence: `src/renderer/src/composables/__tests__/useReviewQueue.test.ts`;
  `e2e/review-queue.screen.spec.ts`.

### TC-QUEUE-UI-002: Active Rows Show Queue Summary Fields In Due Order

- Requirement: SRS-FR-046
- Preconditions: `reviewQueue.list()` resolves with `rq-active-due` before `rq-active-future`.
- Steps:
  1. Open `전체 큐`.
  2. Inspect the list area.
- Expected result:
  - Both due and future active rows are visible.
  - Each row shows title, Source, category, and due label.
  - The order matches the service DTO order.
  - No row for `changed`, `missing`, `deleted`, `sync_error`, or `archived` appears.
- Automated evidence: `e2e/review-queue.screen.spec.ts`.

### TC-QUEUE-UI-003: Selecting A Row Shows Read-Only Details

- Requirement: SRS-FR-046
- Preconditions: `rq-active-future` has merged Source names, category/tags, origin, dueAt,
  lastReviewedAt, lastSyncedAt, and URL fields.
- Steps:
  1. Open `전체 큐`.
  2. Select `rq-active-future`.
  3. Inspect the detail panel.
- Expected result:
  - Detail panel shows Source list, category/tags, origin, dueAt, last review, last sync, and URL.
  - Selecting the row does not call rating, exclusion, sync, or document mutation APIs.
  - FSRS state and Review Log internals are not rendered.
- Automated evidence: `e2e/review-queue.screen.spec.ts`.

### TC-QUEUE-UI-004: Empty Queue Shows Source Sync Hint

- Requirement: SRS-FR-046
- Preconditions: `reviewQueue.list()` resolves with `items: []`, `isEmpty: true`, and
  `emptyReason: 'no-active-items'`.
- Steps:
  1. Load the queue state model.
- Expected result:
  - No item is selected.
  - User-facing message is `전체 큐에 active 항목이 없습니다. Source를 동기화하면 항목이 표시됩니다.`
- Automated evidence: `src/renderer/src/composables/__tests__/useReviewQueue.test.ts`.

### TC-QUEUE-UI-005: Renderer Error Message Is Sanitized

- Requirement: SRS-NFR-SEC-010
- Preconditions: `reviewQueue.list()` rejects with an unknown backend error.
- Steps:
  1. Load the queue state model.
- Expected result:
  - UI state becomes `error`.
  - User-facing message is `전체 큐를 불러오지 못했습니다.`
  - Raw error text is not displayed.
- Automated evidence: `src/renderer/src/composables/__tests__/useReviewQueue.test.ts`.

## Playwright Screen Cases

These cases use mock preload data against the built renderer. They verify the rendered screen shape
and layout, but they do not replace live Electron/Notion acceptance.

### TC-QUEUE-SCREEN-001: Built Renderer Opens The Full Queue Screen

- Requirement: SRS-FR-046
- Preconditions: `npm run build` has produced `out/renderer`; Playwright starts the local static
  renderer server; mock preload APIs include `reviewQueue.list()`.
- Steps:
  1. Navigate to the renderer test URL.
  2. Confirm Today Review heading is visible.
  3. Click the `전체 큐` sidebar control.
- Expected result:
  - `전체 큐` page heading is visible.
  - `전체 active 큐` section heading is visible.
- Automated evidence: `e2e/review-queue.screen.spec.ts`; `npm run test:screen`.

### TC-QUEUE-SCREEN-002: Active Due And Future Rows Render With Details

- Requirement: SRS-FR-046; SRS-FR-045
- Preconditions: Mock preload queue contains `오늘 복습 문서` and `미래 일정 문서`; future item has
  `sourceNames: ['AI 학습', '개발 학습']` and URL `https://www.notion.so/future-review`.
- Steps:
  1. Open `전체 큐`.
  2. Confirm both rows are visible.
  3. Select `미래 일정 문서`.
- Expected result:
  - Future active item is visible even though its `dueAt` is `2026-07-01T00:00:00.000Z`.
  - Detail panel shows `AI 학습, 개발 학습`.
  - Detail panel shows the future `dueAt` and Notion URL.
  - Text for excluded statuses such as `changed` and `archived` is absent.
- Automated evidence: `e2e/review-queue.screen.spec.ts`; `npm run test:screen`.

### TC-QUEUE-SCREEN-003: Desktop Queue Layout Has No Horizontal Overflow

- Requirement: SRS-FR-046
- Preconditions: Playwright viewport is the configured desktop viewport and the queue screen is open.
- Steps:
  1. Evaluate `document.documentElement.scrollWidth` and `clientWidth`.
  2. Capture a full-page screenshot.
- Expected result:
  - `scrollWidth` is not greater than `clientWidth`.
  - Screenshot is written to `test-results/playwright/review-queue-screen.png`.
  - Screenshot buffer is non-empty.
- Automated evidence: `e2e/review-queue.screen.spec.ts`; `npm run test:screen`.

## Manual Live Acceptance Cases

### TC-QUEUE-LIVE-001: Live Electron Queue Uses Real Synced Data

- Requirement: SRS-FR-046
- Preconditions: The Electron app is connected to Notion and at least one Review Source has synced
  active due and future Review Items.
- Steps:
  1. Start the Electron app.
  2. Run Manual Sync for the relevant Source(s).
  3. Open `전체 큐`.
  4. Compare displayed rows with the underlying active Review Items.
- Expected result:
  - Active due and future rows appear in due order.
  - Changed, missing, deleted, sync_error, and archived rows do not appear.
  - Opening the queue does not mutate dueAt, FSRS state, Review Logs, or item status.
- Status: Not yet executed.

## Implementation Guardrails

1. Do not query Notion or require a token for full queue display.
2. Do not include non-active statuses in the full active queue; changed/missing/deleted are handled
   by Status Pages.
3. Do not expose FSRS state or Review Log internals in the renderer DTO.
4. Keep the IPC channel read-only and reject renderer-supplied filters until a filter contract is
   specified.
5. Do not mutate Review Items, dueAt, FSRS state, or Review Logs from the full queue view.
