# Changed, Missing, and Deleted Page Test Cases

## Scope

This test set covers:

- SRS-FR-081: changed page list display
- SRS-FR-092: missing/deleted page list display

This document intentionally covers read-only status page visibility first. Actions that change item
state, confirm deletion, recover missing pages, or preserve/remove records must be specified
separately because SRS-OPEN-003 still leaves the deletion confirmation policy open.

## Required Public Contract

Implement a status-page service with:

- `createStatusPageService({ reader })`
- `service.list({ kind })`

Supported list kinds:

- `changed`
- `missing-deleted`

The reader contract must provide:

- `findByStatuses(statuses)`
- `findSourceById(id)`

## Executable Cases

| ID | Requirement | Test |
| --- | --- | --- |
| TC-STATUS-001 | FR-081 | Changed list includes only `changed` Review Items |
| TC-STATUS-002 | FR-092 | Missing/deleted list includes `missing` and `deleted` Review Items |
| TC-STATUS-003 | FR-081/092 | View model includes title, Source, status, dates, Page ID, and URL |
| TC-STATUS-004 | FR-081/092 | Missing Source and classification values use visible fallbacks |
| TC-STATUS-IPC-001 | SEC-008 | IPC rejects untrusted sender and invalid payload before service access |
| TC-STATUS-IPC-002 | SEC-008 | IPC exposes only sanitized public errors |
| TC-STATUS-UI-001 | FR-081 | Changed page nav loads changed rows through preload |
| TC-STATUS-UI-002 | FR-092 | Deleted page nav loads missing/deleted rows through preload |

## Implementation Guardrails

1. Do not change Review Item status from these read-only screens.
2. Do not resolve missing-to-deleted confirmation policy in this branch.
3. Do not expose raw SQLite rows or FSRS state to the renderer.
4. Keep Notion links opened only through the existing validated external URL path.
