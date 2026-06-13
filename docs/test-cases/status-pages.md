# Changed, Missing, and Deleted Page Test Cases

## Scope

This test set covers:

- SRS-FR-081: changed page list display
- SRS-FR-082: pull changed page into Today Review
- SRS-FR-083: keep changed page schedule
- SRS-FR-092: missing/deleted page list display

This document covers changed-page handling actions. Missing/deleted actions that confirm deletion,
recover missing pages, or preserve/remove records must be specified separately because SRS-OPEN-003
still leaves the deletion confirmation policy open.

## Required Public Contract

Implement a status-page service with:

- `createStatusPageService({ reader })`
- `service.list({ kind })`
- `service.handleChanged({ reviewItemId, action, handledAt })`

Supported list kinds:

- `changed`
- `missing-deleted`

The reader contract must provide:

- `findByStatuses(statuses)`
- `findSourceById(id)`
- `findReviewItemById(id)`
- `recordStatusAction(item, event)`

## Executable Cases

| ID | Requirement | Test |
| --- | --- | --- |
| TC-STATUS-001 | FR-081 | Changed list includes only `changed` Review Items |
| TC-STATUS-002 | FR-092 | Missing/deleted list includes `missing` and `deleted` Review Items |
| TC-STATUS-003 | FR-081/092 | View model includes title, Source, status, dates, Page ID, and URL |
| TC-STATUS-004 | FR-081/092 | Missing Source and classification values use visible fallbacks |
| TC-STATUS-005 | FR-082 | Pulling a changed page sets status active and dueAt to the handled timestamp without changing FSRS state |
| TC-STATUS-006 | FR-083 | Keeping schedule sets status active while preserving dueAt and FSRS state |
| TC-STATUS-007 | FR-082/083 | Changed-page actions write one `user_action` Sync Event atomically with the item update |
| TC-STATUS-008 | FR-082/083 | Missing, deleted, active, and unknown items cannot be handled as changed pages |
| TC-STATUS-IPC-001 | SEC-008 | IPC rejects untrusted sender and invalid payload before service access |
| TC-STATUS-IPC-002 | SEC-008 | IPC exposes only sanitized public errors |
| TC-STATUS-IPC-003 | FR-082/083 | IPC accepts exact changed-page action payloads |
| TC-STATUS-UI-001 | FR-081 | Changed page nav loads changed rows through preload |
| TC-STATUS-UI-002 | FR-092 | Deleted page nav loads missing/deleted rows through preload |
| TC-STATUS-UI-003 | FR-082/083 | Changed-page action success removes the row from the current changed list |

## Implementation Guardrails

1. Changed-page actions set `changed` items back to `active` only after explicit user action.
2. Do not change dueAt or FSRS state for `keep-schedule`.
3. Do not change FSRS state for `pull-today`.
4. Write changed-page handling as a `user_action` Sync Event.
5. Do not resolve missing-to-deleted confirmation policy in this branch.
6. Do not expose raw SQLite rows or FSRS state to the renderer.
7. Keep Notion links opened only through the existing validated external URL path.
