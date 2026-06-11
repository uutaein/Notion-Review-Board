# Review Rating and FSRS Test Cases

## Scope

This test set covers `feature/review-scheduling/review-scheduling.feature` and:

- SRS-FR-070: four-level rating mapping
- SRS-FR-071: atomic review processing
- SRS-FR-072: versioned FSRS state persistence

The tests intentionally define the scheduler boundary before implementation. They should remain red
until the scheduling service and `ts-fsrs` adapter are implemented.

## Required Public Contract

`src/main/services/scheduler/index.ts`:

- `createSchedulingService(dependencies)`
- `SchedulingEngine`
- `ReviewPersistence`
- `rateReview({ reviewItemId, rating, reviewedAt })`

`src/main/services/scheduler/fsrs-engine.ts`:

- `createFsrsEngine()`
- `createInitialState(reviewedAt)`
- `schedule({ state, rating, reviewedAt })`

The application service owns domain validation, snapshots, log creation, and persistence orchestration.
The FSRS adapter owns only conversion between versioned JSON state and `ts-fsrs`.

## Executable Cases

| ID | Requirement | Test |
| --- | --- | --- |
| TC-FSRS-001 | FR-070 | `again`, `hard`, `good`, and `easy` map to FSRS ratings 1-4 |
| TC-FSRS-002 | FR-072 | Initial state contains a non-empty `ts-fsrs@...` version |
| TC-FSRS-003 | FR-072 | Initial and scheduled states survive a JSON round trip |
| TC-FSRS-004 | FR-072 | Same state, rating, and timestamp produce the same result |
| TC-FSRS-005 | FR-072 | Scheduling does not mutate persisted input state |
| TC-FSRS-006 | FR-072 | Incompatible state versions are rejected |
| TC-FSRS-007 | FR-071 | One rating creates one updated item and one complete log |
| TC-FSRS-008 | FR-071 | `dueAt`, `lastReviewedAt`, and `updatedAt` update together |
| TC-FSRS-009 | FR-071/072 | Log stores exact previous and next due/state snapshots |
| TC-FSRS-010 | FR-071 | Non-scheduling item metadata remains unchanged |
| TC-FSRS-011 | FR-071 | Missing and non-active items are rejected before calculation |
| TC-FSRS-012 | FR-072 | FSRS calculation failure performs no persistence call |
| TC-FSRS-013 | FR-071 | Persistence failure is surfaced as failure |
| TC-FSRS-014 | FR-071 | Invalid review timestamps are rejected before calculation |
| TC-FSRS-015 | FR-071 | SQLite integration stores exactly one log |
| TC-FSRS-016 | FR-071 | A newly future-due item disappears from the due query |

## UI Cases To Add With The Rating Component

| ID | Requirement | Expected behavior |
| --- | --- | --- |
| TC-FSRS-UI-001 | FR-070 | Four buttons use labels `다시`, `어려움`, `보통`, `쉬움` |
| TC-FSRS-UI-002 | FR-070 | Buttons submit by click/tap without drag and drop |
| TC-FSRS-UI-003 | FR-070 | Each touch target is at least 44 by 44 CSS pixels |
| TC-FSRS-UI-004 | FR-071 | All rating buttons disable while one submission is pending |
| TC-FSRS-UI-005 | FR-071 | Rapid repeated clicks result in one IPC/service request |
| TC-FSRS-UI-006 | FR-071 | Success removes the item when its new due date is in the future |
| TC-FSRS-UI-007 | FR-071/072 | FSRS or database failure keeps the item and displays an error |

## Implementation Guardrails

1. Use the current `ts-fsrs` API through the adapter only. Do not persist library class instances.
2. Persist dates as ISO 8601 UTC strings.
3. Clone the previous FSRS state before invoking the adapter so a mutating dependency cannot corrupt
   the Review Log snapshot.
4. Call the existing `DatabaseService.recordReview` once per accepted rating.
5. Do not catch and convert calculation or database failures into a success result.
6. Keep duplicate-click protection in the renderer or IPC request coordinator; the synchronous domain
   service cannot represent an in-flight UI request.
