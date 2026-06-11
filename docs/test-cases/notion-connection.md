# Notion Connection Test Cases

## Scope

This test set covers `feature/notion-connection/notion-connection.feature`:

- SRS-FR-001: token input, replacement, and missing-token behavior
- SRS-FR-002: secure token persistence and deletion
- SRS-FR-003: Notion connection verification
- SRS-NFR-SEC-006: token redaction from UI, logs, errors, events, and SQLite
- SRS-NFR-SEC-008: IPC sender and payload validation
- SRS-NFR-SEC-010: sanitized renderer-facing errors

Source registration, synchronization, and Notion target discovery are separate features. Connection
verification proves that the stored credential can reach Notion, but it does not require a Review
Source to exist.

## Required Public Contract

Implement the privileged boundary in the Electron Main Process.

`src/main/services/notion/connection.ts`:

- `createNotionConnectionService(dependencies)`
- `getStatus()`
- `saveToken({ token })`
- `deleteToken()`
- `verifyConnection()`
- `TokenVault`
- `NotionConnectionClient`

`src/main/ipc/notion-connection.ts`:

- `registerNotionConnectionIpc(dependencies)`
- sender validation before service access
- runtime payload validation before token access or network access
- sanitized error/result mapping

The preload bridge may expose only:

- `notionConnection.getStatus()`
- `notionConnection.saveToken({ token })`
- `notionConnection.deleteToken()`
- `notionConnection.verify()`

Renderer-facing status values are `not_configured`, `configured`, `connected`, `unauthorized`,
`forbidden`, `rate_limited`, and `network_error`. No public response contains the token, encrypted
blob, filesystem path, internal stack trace, or raw Notion response.

## Executable Cases

| ID | Requirement | Test |
| --- | --- | --- |
| TC-NOTION-CONN-001 | FR-001/002 | A non-empty token is encrypted before the persistent store is written |
| TC-NOTION-CONN-002 | FR-002/SEC-006 | Persistent storage contains only the encrypted blob, never the token text |
| TC-NOTION-CONN-003 | FR-001 | Saving a token returns `configured` without returning the token |
| TC-NOTION-CONN-004 | FR-001 | Replacing a token overwrites the previous encrypted blob |
| TC-NOTION-CONN-005 | FR-001 | Encryption or persistence failure leaves the previous token unchanged |
| TC-NOTION-CONN-006 | FR-002 | Unavailable OS encryption rejects storage before any file write |
| TC-NOTION-CONN-007 | FR-002 | A weak or explicitly disallowed encryption backend rejects storage |
| TC-NOTION-CONN-008 | FR-002 | Deleting a configured token removes the encrypted blob and returns `not_configured` |
| TC-NOTION-CONN-009 | FR-002 | Deleting when no token exists is idempotent |
| TC-NOTION-CONN-010 | FR-001 | Missing token blocks connection verification and synchronization prerequisites |
| TC-NOTION-CONN-011 | FR-003 | Successful API verification returns `connected` |
| TC-NOTION-CONN-012 | FR-003 | HTTP 401 maps to `unauthorized` |
| TC-NOTION-CONN-013 | FR-003 | HTTP 403 maps to `forbidden` |
| TC-NOTION-CONN-014 | FR-003 | HTTP 429 maps to `rate_limited` without exposing the raw response |
| TC-NOTION-CONN-015 | FR-003 | Transport and timeout failures map to `network_error` |
| TC-NOTION-CONN-016 | FR-003 | Verification failure does not delete or mutate Review Sources and Review Logs |
| TC-NOTION-CONN-017 | SEC-006/010 | Save, decrypt, and verification errors redact the token from messages and stack data |
| TC-NOTION-CONN-018 | SEC-006 | Logger and Sync Event dependencies never receive token text or decrypted credentials |
| TC-NOTION-CONN-019 | SEC-008 | IPC rejects an untrusted sender before calling the connection service |
| TC-NOTION-CONN-020 | SEC-008 | IPC rejects missing, null, array, and primitive save payloads |
| TC-NOTION-CONN-021 | SEC-008 | IPC rejects missing, non-string, empty, whitespace-only, and oversized token values |
| TC-NOTION-CONN-022 | SEC-008 | IPC rejects unexpected save payload properties |
| TC-NOTION-CONN-023 | SEC-008 | Status, delete, and verify IPC channels reject unexpected arguments |
| TC-NOTION-CONN-024 | SEC-008/010 | Rejected IPC input performs no storage, decryption, or network operation |
| TC-NOTION-CONN-025 | SEC-010 | IPC failures return a stable public error code without an internal stack trace |
| TC-NOTION-CONN-026 | SEC-006/008 | Preload exposes intent-specific methods and no generic `send`, `invoke`, token-read, or filesystem API |

## UI Cases To Add With The Connection Settings Component

| ID | Requirement | Expected behavior |
| --- | --- | --- |
| TC-NOTION-CONN-UI-001 | FR-001 | Token input uses a masked password field |
| TC-NOTION-CONN-UI-002 | FR-001/002 | Saved status is shown without displaying the original token |
| TC-NOTION-CONN-UI-003 | FR-001 | Empty or whitespace-only input cannot be submitted |
| TC-NOTION-CONN-UI-004 | FR-001 | Save failure displays a user-actionable, sanitized message |
| TC-NOTION-CONN-UI-005 | FR-001 | Replacing a token requires an explicit save action |
| TC-NOTION-CONN-UI-006 | FR-002 | Token deletion requires confirmation and updates status to unconfigured |
| TC-NOTION-CONN-UI-007 | FR-002 | Unavailable secure storage explains that the token was not saved |
| TC-NOTION-CONN-UI-008 | FR-003 | Connection verification distinguishes connected, authentication, permission, rate-limit, and network states |
| TC-NOTION-CONN-UI-009 | FR-003 | Verification pending state prevents duplicate requests |
| TC-NOTION-CONN-UI-010 | FR-001/003 | Missing token disables verification and directs the user to token setup |

## Implementation Guardrails

1. Keep plaintext tokens inside the Main Process. Do not return a token-reading method through IPC.
2. Inject encryption, blob persistence, Notion transport, and logging so tests never require a real
   credential or network call.
3. Write a newly encrypted blob atomically. A failed replacement must preserve the previous blob.
4. Treat trim as validation, not token normalization. Preserve the accepted token bytes exactly.
5. Put a conservative maximum length on IPC token input and reject unknown object properties.
6. Validate the sender before payload parsing and before invoking any privileged dependency.
7. Map dependency failures to stable public codes. Do not serialize raw `Error`, Notion response,
   stack, request headers, or encrypted blob objects across IPC.
8. Connection verification must use a minimal authenticated Notion request and must not require or
   mutate Review Source, Review Item, Review Log, or Sync Event data.
