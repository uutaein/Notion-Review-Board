# Review Source and Field Mapping Test Cases

## Scope

This test set covers:

- `feature/review-source/review-source.feature`
- `feature/field-mapping/field-mapping.feature`
- SRS-FR-010: Review Source creation
- SRS-FR-011: Review Source update
- SRS-FR-012: Review Source deletion and impact handling
- SRS-FR-013: Review Source activation
- SRS-FR-020: per-Source field mapping
- SRS-FR-021: Notion property discovery and mapping validation
- SRS-FR-022: complete manual mapping without automatic inference
- SRS-NFR-SEC-008/010: IPC validation and sanitized errors

Collection query execution belongs to `feature/collection-rules/collection-rules.feature`. This test
set validates that a Source stores a coherent collection configuration, but does not define
pagination or page filtering behavior.

## Required Public Contract

`src/main/services/source/index.ts`:

- `createReviewSourceService(dependencies)`
- `listSources()`
- `getSource({ sourceId })`
- `createSource(input)`
- `updateSource(input)`
- `getDeleteImpact({ sourceId })`
- `deleteSource({ sourceId, itemPolicy })`
- `setSourceEnabled({ sourceId, enabled })`
- `ReviewSourcePersistence`
- `SourceDeleteImpact`

`src/main/services/notion/source-metadata.ts`:

- `createNotionSourceMetadataService(dependencies)`
- `resolveTarget({ target })`
- `listProperties({ target })`
- `validateMapping(input)`
- `previewMapping(input)`
- `NotionTargetResolver`
- `NotionMetadataClient`

The persistence contract must support:

- lookup by Source ID
- lookup by normalized Notion target ID
- ordered Source listing
- insert and update without resetting `createdAt` or `lastSyncedAt`
- deletion inside a transaction with affected Review Item references
- preserving Review Logs when a Source is updated or deleted

The IPC/preload boundary may expose intent-specific Source and mapping methods only. Every request
must validate the sender, exact object shape, IDs, strings, enums, nested mapping/filter objects,
and delete policy before service or Notion access.

## Source Input Rules

All modes require:

- non-empty Source name
- a resolvable Notion Database/Data Source URL or ID
- `enabled`
- collection mode: `tag`, `checkbox`, or `all`
- title property mapping

Mode-specific rules:

| Mode | Required configuration | Forbidden or cleared configuration |
| --- | --- | --- |
| `tag` | filter property, `equals` or `contains`, non-empty filter value | checkbox mapping and `checked` operator |
| `checkbox` | checkbox property | tag filter value; effective operator is `checked` |
| `all` | none | checkbox and tag filter configuration |

Optional mappings are URL, category, tags, origin/source label, and last-edited time. An omitted URL
mapping falls back to the Notion page URL. Empty category and tag values project as `미분류`.

## Executable Cases

| ID | Requirement | Test |
| --- | --- | --- |
| TC-SOURCE-001 | FR-010 | A valid Source is created with generated ID and UTC timestamps |
| TC-SOURCE-002 | FR-010 | Created Source persists normalized target ID, target type, enabled state, mode, mappings, and filters |
| TC-SOURCE-003 | FR-010 | Missing or whitespace-only name is rejected before persistence |
| TC-SOURCE-004 | FR-010 | Missing or malformed target input is rejected before Notion access |
| TC-SOURCE-005 | FR-010 | Unsupported collection mode and non-boolean enabled values are rejected |
| TC-SOURCE-006 | FR-010/020 | Missing title mapping is rejected for every collection mode |
| TC-SOURCE-007 | FR-010 | Tag mode requires property, supported operator, and non-empty value |
| TC-SOURCE-008 | FR-010/020 | Checkbox mode requires a checkbox property mapping |
| TC-SOURCE-009 | FR-010 | All mode clears stale tag and checkbox collection configuration |
| TC-SOURCE-010 | FR-010 | Database and Data Source URLs/IDs resolve to a normalized target ID and type |
| TC-SOURCE-011 | FR-010 | Duplicate normalized target returns a stable duplicate warning and performs no insert |
| TC-SOURCE-012 | FR-010 | Concurrent duplicate creation is rejected by persistence uniqueness |
| TC-SOURCE-013 | FR-011 | Updating a Source changes only editable settings and `updatedAt` |
| TC-SOURCE-014 | FR-011 | Update preserves Source ID, `createdAt`, `lastSyncedAt`, Review Items, and Review Logs |
| TC-SOURCE-015 | FR-011 | Changing mode revalidates and normalizes mode-specific configuration |
| TC-SOURCE-016 | FR-011 | Missing Source update returns not-found without creating a new row |
| TC-SOURCE-017 | FR-011 | Persistence failure leaves the previous Source configuration intact |
| TC-SOURCE-018 | FR-012 | Delete impact reports sole-reference and shared-reference item counts before mutation |
| TC-SOURCE-019 | FR-012 | Deletion without an explicit item policy is rejected |
| TC-SOURCE-020 | FR-012 | Deleting one shared Source removes only that Source ID from shared Review Items |
| TC-SOURCE-021 | FR-012 | Shared items receive a valid remaining primary Source when the deleted Source was primary |
| TC-SOURCE-022 | FR-012 | Sole-reference items follow the selected archive, delete, or keep-history policy |
| TC-SOURCE-023 | FR-012 | Source deletion preserves existing Review Logs |
| TC-SOURCE-024 | FR-012 | Source deletion and Review Item reference changes are atomic |
| TC-SOURCE-025 | FR-013 | Disabling a Source excludes it from sync target listing |
| TC-SOURCE-026 | FR-013 | Disabling a Source does not delete or change existing Review Item status or due date |
| TC-SOURCE-027 | FR-013 | Re-enabling a Source makes it eligible for the next manual synchronization |
| TC-MAPPING-001 | FR-020 | Two Sources persist independent mappings with overlapping property names |
| TC-MAPPING-002 | FR-020 | Missing URL mapping projects the canonical Notion page URL |
| TC-MAPPING-003 | FR-020 | Missing category and tag mappings or values project as `미분류` |
| TC-MAPPING-004 | FR-020 | Last-edited mapping uses the selected date property or Notion `last_edited_time` fallback |
| TC-MAPPING-005 | FR-021 | Property discovery returns stable property ID, name, and Notion type |
| TC-MAPPING-006 | FR-021 | Property discovery requires a configured token and resolved target |
| TC-MAPPING-007 | FR-021 | Notion 401, 403, 404, 429, and network failures map to sanitized public results |
| TC-MAPPING-008 | FR-021 | Mapping validation rejects a property absent from the current schema |
| TC-MAPPING-009 | FR-021 | Title mapping accepts only a title-compatible property |
| TC-MAPPING-010 | FR-021 | URL mapping accepts only URL-compatible data or an explicit page-URL fallback |
| TC-MAPPING-011 | FR-021 | Checkbox collection mapping accepts only a checkbox property |
| TC-MAPPING-012 | FR-021 | Tag/category filter operator is compatible with the selected property type |
| TC-MAPPING-013 | FR-021 | Preview returns sample title, URL, category, tags, origin, checkbox, and edited time |
| TC-MAPPING-014 | FR-021 | Empty target returns a valid property list and an explicit no-sample preview |
| TC-MAPPING-015 | FR-021 | Preview and validation do not persist Source or Review Item data |
| TC-MAPPING-016 | FR-022 | A complete manually selected mapping validates without automatic suggestions |
| TC-SOURCE-IPC-001 | SEC-008 | Untrusted sender is rejected before repository or Notion access |
| TC-SOURCE-IPC-002 | SEC-008 | IPC rejects missing, primitive, array, null, oversized, and unknown-property payloads |
| TC-SOURCE-IPC-003 | SEC-008 | IPC validates nested mapping, filter, enum, and delete-policy values |
| TC-SOURCE-IPC-004 | SEC-010 | IPC errors expose stable codes without target response bodies or stack traces |
| TC-SOURCE-IPC-005 | SEC-008 | Preload exposes no generic invoke, raw token, database, filesystem, or unrestricted Notion API |

## UI Cases To Add With Source Settings

| ID | Requirement | Expected behavior |
| --- | --- | --- |
| TC-SOURCE-UI-001 | FR-010 | Source form identifies required, conditional, and optional fields |
| TC-SOURCE-UI-002 | FR-010 | Selecting collection mode updates visible required fields |
| TC-SOURCE-UI-003 | FR-010 | Duplicate target warning identifies the existing Source |
| TC-SOURCE-UI-004 | FR-011 | Editing loads persisted settings without changing them before save |
| TC-SOURCE-UI-005 | FR-011 | Unsaved changes can be cancelled |
| TC-SOURCE-UI-006 | FR-012 | Delete confirmation displays sole-reference and shared-reference impact |
| TC-SOURCE-UI-007 | FR-012 | Delete action requires an explicit item handling policy |
| TC-SOURCE-UI-008 | FR-013 | Enabled state is visible and can be toggled without deleting items |
| TC-MAPPING-UI-001 | FR-020/022 | Property selectors are populated from the selected Notion target |
| TC-MAPPING-UI-002 | FR-020 | Optional mapping selectors provide a clear unmapped/fallback choice |
| TC-MAPPING-UI-003 | FR-021 | Incompatible property types are disabled or display an immediate error |
| TC-MAPPING-UI-004 | FR-021 | Validation preview labels fallback and empty values clearly |
| TC-MAPPING-UI-005 | FR-021 | Loading, empty schema, no sample, permission, and network states are distinct |
| TC-MAPPING-UI-006 | FR-021 | Pending metadata or preview requests prevent duplicate submissions |

## Implementation Guardrails

1. Normalize Notion target URLs and IDs once in a dedicated resolver. Duplicate checks and storage
   must use the normalized target ID, not the user-entered URL.
2. Keep Source command validation separate from SQLite constraints. Database constraints remain the
   final concurrency guard, not the primary user-facing validation layer.
3. Treat mode changes as full configuration transitions. Do not retain stale checkbox or tag filter
   settings that can silently affect later synchronization.
4. Use Notion property IDs internally when available while retaining display names for the UI. A
   property rename must be detectable instead of silently binding to an unrelated field.
5. Do not infer deletion from a failed metadata request. Permission and network failures must not
   mutate Sources or Review Items.
6. Run Source deletion and all affected Review Item reference changes in one SQLite transaction.
7. Never delete Review Logs as an implicit side effect of Source update, disable, or deletion.
8. Keep metadata discovery and mapping preview read-only. No Review Item should be created during
   validation.
9. Return DTOs from IPC. Do not expose repository entities, raw Notion responses, token values, or
   internal database errors.
10. Add a schema migration for any new mapping field, including the last-edited property, rather
    than overloading an unrelated existing column.
