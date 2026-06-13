# Manual Sync and Collection Engine Test Cases

## Scope

This test set covers:

- `feature/collection-rules/collection-rules.feature`
- `feature/synchronization/synchronization.feature`
- SRS-FR-030: tag/category collection
- SRS-FR-031: checkbox collection
- SRS-FR-032: collect-all mode
- SRS-FR-040: manual synchronization
- SRS-FR-041: Notion pagination
- SRS-FR-042: Notion rate-limit handling and cancellation
- SRS-FR-043: new Review Item creation
- SRS-FR-044: existing Review Item update
- SRS-FR-045: cross-Source Review Item merge
- SRS-FR-093: synchronization error presentation
- SRS-NFR-REL-001/003/004: partial failure, retry, and deletion/error separation
- SRS-NFR-PERF-002/003: visible progress without blocking the renderer
- SRS-NFR-SEC-006/008/010: token protection, IPC validation, and sanitized errors

Deleted-page confirmation remains governed by SRS-FR-090 ~ 093 and SRS-OPEN-003. These cases may
create a `missing` candidate, but they do not define when that candidate becomes `deleted`.

## Test Boundaries

Tests should keep these responsibilities separate:

1. Collection rule tests decide whether mapped Notion page data is a candidate. They do not call
   SQLite, FSRS, IPC, or the renderer.
2. Notion query tests cover request filtering, pagination, rate-limit waiting, cancellation, and
   sanitized transport failures through an injected client. They do not require a real token or
   network request.
3. Synchronization service tests select Sources, orchestrate collection, reconcile Review Items,
   produce progress/results, and invoke persistence.
4. SQLite integration tests verify Source-unit transactions, uniqueness, timestamps, Source
   references, Sync Events, and preservation of scheduling/history fields.
5. IPC tests verify the privileged boundary before service, token, Notion, or database access.

No test may depend on a specific implementation function name until that public contract exists.
Use the existing domain types from `src/shared/domain` and the existing database service boundary.

## Collection Rule Matrix

The MVP conditions are intentionally limited to the SRS-defined property families:

| Operator | Supported mapped value behavior |
| --- | --- |
| `equals` | exact value match for `select`, `status`, and `rich_text` |
| `contains` | exact member match for `multi_select`; substring match for `rich_text` |
| `checked` | boolean `true` for a mapped checkbox property |

An unsupported property/operator combination is a schema or mapping error, not an empty collection
result. Complex AND/OR filters are outside MVP scope.

## Synchronization Transaction Contract

The executable contract uses a Source as the transaction unit:

1. Read all pages for one Source, including every pagination cursor.
2. Do not mutate Review Items while remote pagination is incomplete.
3. Reconcile and persist that Source's complete result in one transaction.
4. Commit a successful Source independently from other Sources.
5. Roll back all mutations for a Source whose collection, reconciliation, or persistence fails.

This preserves successful Source results without exposing partially collected state from a failed
Source. It does not require one transaction across the entire multi-Source run.

## Executable Collection Cases

| ID | Requirement | Test |
| --- | --- | --- |
| TC-COLLECTION-001 | FR-030 | `equals` collects only pages whose mapped select value exactly matches the configured value |
| TC-COLLECTION-002 | FR-030 | `equals` collects only pages whose mapped status value exactly matches the configured value |
| TC-COLLECTION-003 | FR-030 | `equals` collects only pages whose mapped rich-text value exactly matches the configured value |
| TC-COLLECTION-004 | FR-030 | `contains` collects a page when its mapped multi-select contains the configured member |
| TC-COLLECTION-005 | FR-030 | `contains` collects a page when its mapped rich-text value contains the configured substring |
| TC-COLLECTION-006 | FR-030 | Non-matching pages are excluded without creating an error |
| TC-COLLECTION-007 | FR-030 | Missing or whitespace-only filter values are rejected before Notion query or persistence |
| TC-COLLECTION-008 | FR-030 | Unsupported property/operator combinations return a schema or mapping error |
| TC-COLLECTION-009 | FR-030 | No matching page completes successfully with zero collected candidates |
| TC-COLLECTION-010 | FR-030 | Collection evaluates one configured condition only and does not invent AND/OR behavior |
| TC-COLLECTION-011 | FR-031 | Checkbox mode collects only pages whose mapped checkbox value is `true` |
| TC-COLLECTION-012 | FR-031 | Checkbox mode excludes `false`, missing, and null checkbox values |
| TC-COLLECTION-013 | FR-031 | Missing checkbox mapping blocks synchronization before Notion query or persistence |
| TC-COLLECTION-014 | FR-031 | A removed mapped checkbox property fails the Source as a schema mismatch |
| TC-COLLECTION-015 | FR-031 | A mapped property whose current type is not checkbox fails the Source as a schema mismatch |
| TC-COLLECTION-016 | FR-032 | Collect-all mode includes every returned page regardless of tag or checkbox values |
| TC-COLLECTION-017 | FR-032 | Collect-all mode does not require tag, category, or checkbox mappings |
| TC-COLLECTION-018 | FR-032 | A disabled collect-all Source is not passed to the Collection Engine |

## Executable Manual Sync Cases

| ID | Requirement | Test |
| --- | --- | --- |
| TC-SYNC-001 | FR-040 | Sync-all selects every enabled Source and excludes disabled and soft-deleted Sources |
| TC-SYNC-002 | FR-040 | Single-Source sync runs only the selected enabled Source |
| TC-SYNC-003 | FR-040 | Single-Source sync rejects a missing, disabled, or soft-deleted Source before Notion access |
| TC-SYNC-004 | FR-040/PERF-002 | Progress identifies the current Source and a non-terminal running state |
| TC-SYNC-005 | FR-040 | Completion reports created, updated, changed, missing, and error counts |
| TC-SYNC-006 | FR-040/REL-001 | One Source failure does not roll back a different Source that already committed |
| TC-SYNC-007 | FR-040 | An unselected Source retains its previous `lastSyncedAt` and Sync Events |
| TC-SYNC-008 | FR-040/PERF-003 | Long-running synchronization is asynchronous and does not execute Notion transport in the renderer |
| TC-SYNC-009 | FR-041 | Pagination follows cursors until the response indicates no next page |
| TC-SYNC-010 | FR-041 | Each next request uses the cursor returned by the immediately preceding response |
| TC-SYNC-011 | FR-041 | Duplicate pages across pagination responses are reconciled once by normalized Notion Page ID |
| TC-SYNC-012 | FR-041/REL-001 | A middle-page failure persists no Review Item mutation for the failed Source |
| TC-SYNC-013 | FR-041 | A middle-page failure records a Source-level synchronization error |
| TC-SYNC-014 | FR-042/REL-003 | HTTP 429 is distinguished from authentication, permission, not-found, and network failures |
| TC-SYNC-015 | FR-042/REL-003 | A valid `Retry-After` delay is honored before the next request |
| TC-SYNC-016 | FR-042/REL-003 | Retry count and total wait remain within configured finite limits |
| TC-SYNC-017 | FR-042 | A request succeeding within the retry limit continues the same Source synchronization |
| TC-SYNC-018 | FR-042 | Exhausted rate-limit retries fail the Source and record a sanitized sync error |
| TC-SYNC-019 | FR-042 | Cancellation during rate-limit waiting prevents another Notion request |
| TC-SYNC-020 | FR-042 | Cancellation before persistence produces no new Source mutations |
| TC-SYNC-021 | FR-042 | Cancellation is reported separately from successful completion |

## Executable Reconciliation Cases

| ID | Requirement | Test |
| --- | --- | --- |
| TC-SYNC-022 | FR-043 | A previously unknown normalized Notion Page ID creates one active Review Item |
| TC-SYNC-023 | FR-043 | A new item records `createdAt`, `updatedAt`, and `lastSyncedAt` as UTC timestamps |
| TC-SYNC-024 | FR-043 | A new item receives the existing scheduler adapter's initial due date and serializable FSRS state |
| TC-SYNC-025 | FR-043 | A new item stores the current Source in both `primarySourceId` and `sourceIds` |
| TC-SYNC-026 | FR-043 | Mapped title, URL fallback, category, tags, origin, and Notion edited time are projected into the new item |
| TC-SYNC-027 | FR-044 | Re-syncing the same normalized Page ID updates the existing item without inserting another item |
| TC-SYNC-028 | FR-044 | Re-sync updates mapped metadata, Notion edited time, `lastSyncedAt`, and `updatedAt` |
| TC-SYNC-029 | FR-044 | Re-sync preserves `dueAt`, `lastReviewedAt`, FSRS state, and every Review Log |
| TC-SYNC-030 | FR-044 | Re-sync adds the current Source ID when it is absent without removing existing Source IDs |
| TC-SYNC-031 | FR-044 | A newer meaningful Notion edit is included in the changed result without altering the review schedule |
| TC-SYNC-032 | FR-044 | First-time collection is not counted as a changed existing item |
| TC-SYNC-033 | FR-040/REL-004 | A page absent from a complete successful Source result becomes `missing`, not `deleted` |
| TC-SYNC-034 | FR-040/REL-004 | Authentication, permission, rate-limit, network, schema, cancellation, and pagination failures do not mark unseen pages missing |
| TC-SYNC-035 | FR-045 | The same normalized Page ID from two Sources produces one Review Item |
| TC-SYNC-036 | FR-045 | A merged item preserves both Source IDs without duplicates |
| TC-SYNC-037 | FR-045 | The first collecting Source remains `primarySourceId` when another Source is merged |
| TC-SYNC-038 | FR-045 | Equal URLs with different Page IDs remain separate Review Items |
| TC-SYNC-039 | FR-045 | Equal titles with different Page IDs remain separate Review Items |
| TC-SYNC-040 | FR-040/045 | Re-running an unchanged successful Source is idempotent except for synchronization timestamps and events |
| TC-SYNC-041 | FR-040/REL-001 | Reconciliation or SQLite failure rolls back item changes, Source `lastSyncedAt`, and success events for that Source |
| TC-SYNC-042 | FR-040 | Source `lastSyncedAt` advances only after its complete result commits |
| TC-SYNC-043 | FR-093 | Source-level failures and item-level mapping/projection failures remain distinguishable in results and events |
| TC-SYNC-044 | FR-093 | Authentication, permission, rate-limit, network, and schema/property failures retain distinct existing error categories |
| TC-SYNC-045 | FR-093 | Each public error category provides a sanitized user action without token, stack, or raw response data |

## IPC and Security Cases

| ID | Requirement | Test |
| --- | --- | --- |
| TC-SYNC-IPC-001 | SEC-008 | An untrusted sender is rejected before token, Source, Notion, or database access |
| TC-SYNC-IPC-002 | SEC-008 | Sync-all rejects unexpected arguments and single-Source sync validates exact payload shape and Source ID |
| TC-SYNC-IPC-003 | SEC-008 | Cancellation accepts only the identifier or shape defined by the implemented sync contract |
| TC-SYNC-IPC-004 | SEC-006/010 | Progress, result, errors, logs, and Sync Events never contain the plaintext token or raw Notion response |
| TC-SYNC-IPC-005 | SEC-010 | Renderer-facing failures use existing sanitized error categories without stack traces or database details |
| TC-SYNC-IPC-006 | SEC-008 | Preload exposes intent-specific sync methods and no generic invoke, raw token, database, or unrestricted Notion API |

## UI Cases To Add With Manual Sync

| ID | Requirement | Expected behavior |
| --- | --- | --- |
| TC-SYNC-UI-001 | FR-040 | The user can start sync-all from the main review screen |
| TC-SYNC-UI-002 | FR-040 | The user can start synchronization for one enabled Source |
| TC-SYNC-UI-003 | FR-040 | Disabled Sources cannot be selected for manual synchronization |
| TC-SYNC-UI-004 | FR-040/PERF-002 | Running state shows current Source and visible progress |
| TC-SYNC-UI-005 | FR-040 | Completion shows created, updated, changed, missing, and error counts |
| TC-SYNC-UI-006 | FR-040 | A failed Source is distinguishable from successful Sources in the same run |
| TC-SYNC-UI-007 | FR-042 | The user can cancel a running or rate-limit-waiting synchronization |
| TC-SYNC-UI-008 | FR-042 | Cancellation state is distinct from success and failure |
| TC-SYNC-UI-009 | FR-040 | Duplicate start actions do not create overlapping runs for the same Source |
| TC-SYNC-UI-010 | SEC-006/010 | Sync messages expose no token, raw response, stack trace, or internal database error |

## Implementation Guardrails

1. Keep Notion transport, cursor handling, and response mapping behind injected Main Process
   interfaces. Tests must not use the live Notion API.
2. Build or evaluate collection rules from the persisted Source configuration. Do not trust
   renderer-supplied filter objects as the authoritative configuration.
3. Complete remote pagination before starting the failed Source's persistence transaction.
4. Normalize Notion Page IDs through the shared domain rule before lookup, deduplication, and merge.
5. Initialize FSRS state through the existing scheduler adapter. Do not duplicate FSRS defaults in
   synchronization code.
6. Preserve scheduling fields and Review Logs during metadata-only synchronization.
7. Treat a page as missing only after a complete successful result for the owning Source. Transport,
   schema, rate-limit, cancellation, or permission failure is not absence evidence.
8. Do not resolve SRS-OPEN-003 in this feature. Missing-to-deleted confirmation requires separate
   specification and tests.
9. Emit progress from the Main Process through a narrow channel or subscription contract. Do not
   expose generic Electron messaging.
10. Apply backpressure to progress reporting so large Sources do not flood the renderer.
11. Use finite, injectable retry and clock policies so rate-limit tests are deterministic.
12. Return result DTOs rather than repository entities or raw Notion payloads.
