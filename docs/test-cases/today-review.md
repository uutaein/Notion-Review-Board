# Today Review Test Cases

## Scope

This test set covers `feature/today-review/today-review.feature`:

- SRS-FR-050: Today Review eligibility and empty state
- SRS-FR-051: required item display information
- SRS-FR-052: due-date ordering
- SRS-FR-053: explicit random ordering
- SRS-FR-054: category, tag, Source, and unclassified filtering

Kanban is tagged `@p1` and document viewing is a separate feature, so their behavior is not part of
this branch.

## Required Public Contract

Implement `src/main/services/review/index.ts` with:

- `createTodayReviewService({ reader, random? })`
- `getLocalDayEndUtc(now, timeZone)`
- `TodayReviewReader`
- `service.list({ now, timeZone, sort?, filter? })`

The reader contract must provide:

- `findDue(through)`
- `findSourceById(id)`

Default sort is `due`. Supported filters are `unclassified`, `category`, `tag`, and `source`.

## Executable Cases

| ID | Requirement | Test |
| --- | --- | --- |
| TC-REVIEW-001 | FR-050 | Query boundary is the end of the user's local date |
| TC-REVIEW-002 | FR-050 | Daylight-saving transitions produce the correct UTC boundary |
| TC-REVIEW-003 | FR-050 | Future-local-date and non-active items are excluded defensively |
| TC-REVIEW-004 | FR-050 | No eligible items returns an explicit empty state |
| TC-REVIEW-005 | FR-051 | View model contains title, Source, classification, origin, dates, status, and URL |
| TC-REVIEW-006 | FR-051/054 | Missing Source and classification values use visible fallbacks |
| TC-REVIEW-007 | FR-052 | Default sort is due date ascending |
| TC-REVIEW-008 | FR-052 | Equal due dates put never-reviewed items first |
| TC-REVIEW-009 | FR-053 | Random sort runs only when explicitly selected |
| TC-REVIEW-010 | FR-053 | Randomization includes only eligible Today Review items |
| TC-REVIEW-011 | FR-054 | Unclassified filtering preserves date and status rules |
| TC-REVIEW-012 | FR-054 | Category and tag filters select exact values |
| TC-REVIEW-013 | FR-050 | Invalid date and time-zone input is rejected before storage access |
| TC-REVIEW-014 | FR-050 | SQLite query includes the final millisecond of the local day |
| TC-REVIEW-015 | FR-050/071 | Moving dueAt to a future day removes the item from Today Review |
| TC-REVIEW-016 | FR-054 | Source filtering selects items whose `sourceIds` include the selected Source |

## UI Cases To Add With The Review Components

| ID | Requirement | Expected behavior |
| --- | --- | --- |
| TC-REVIEW-UI-001 | FR-050 | Empty queue shows completion or synchronization guidance |
| TC-REVIEW-UI-002 | FR-051 | Every row shows title, Source, classification, due date, and status |
| TC-REVIEW-UI-003 | FR-051 | Long titles wrap or truncate without breaking layout |
| TC-REVIEW-UI-004 | FR-051 | Document-open and four rating buttons are keyboard accessible |
| TC-REVIEW-UI-005 | FR-052 | Current sort mode is visibly identified |
| TC-REVIEW-UI-006 | FR-053 | Selecting random mode updates order without adding ineligible rows |
| TC-REVIEW-UI-007 | FR-054 | Selecting `미분류` shows only eligible unclassified items |
| TC-REVIEW-UI-008 | FR-054 | Empty filter result shows a filter-specific empty state |
| TC-REVIEW-UI-009 | FR-071 | Successful rating removes a newly future-due item |
| TC-REVIEW-UI-010 | FR-071 | Pending rating disables duplicate submission |
| TC-REVIEW-UI-011 | FR-054 | Selecting a Source from the Manual Sync controls shows only eligible items for that Source |

## Implementation Guardrails

1. `dueAt <= now` is incorrect for this feature. Include every item due on the user's current local
   date.
2. Convert the next local midnight to UTC and subtract one millisecond. Do not assume every day is 24
   hours because daylight-saving time zones are supported by the contract.
3. Apply eligibility before randomization and filtering.
4. Do not mutate repository-owned Review Item objects while sorting or projecting.
5. Keep random generation injectable so ordering behavior is testable.
6. Resolve Source display names in the service boundary; the renderer must not receive only an opaque
   Source ID.
