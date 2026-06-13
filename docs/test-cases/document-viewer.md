# Document Viewer Test Cases

## Scope

- SRS-FR-060: internal Notion document viewer
- SRS-FR-061: safe external browser fallback
- SRS-FR-062: selected document metadata remains visible with review controls
- SRS-NFR-SEC-001 ~ 005: Electron isolation and narrow IPC boundary

## Test Cases

| ID               | SRS        | Type     | Scenario                                           | Expected result                                                                 |
| ---------------- | ---------- | -------- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| TC-VIEWER-001    | FR-060     | Main     | Open `https://app.notion.com/...` or `https://www.notion.so/...` internally | A sandboxed embedded Electron document view loads the Notion URL                |
| TC-VIEWER-002    | FR-060     | Main     | Open `https://workspace.notion.site/...` internally | A sandboxed embedded Electron document view loads the Notion URL                |
| TC-VIEWER-003    | FR-060     | Main     | Open `http://www.notion.so/...` internally         | Request is rejected with `UNSAFE_DOCUMENT_URL`                                  |
| TC-VIEWER-004    | FR-060     | Main     | Open `https://example.com/...` internally          | Request is rejected with `UNSAFE_DOCUMENT_URL`                                  |
| TC-VIEWER-005    | FR-060     | Main     | Internal viewer is constructed                     | Embedded `WebContentsView` uses `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and no preload |
| TC-VIEWER-006    | FR-060     | IPC      | Renderer sends extra fields with viewer open       | IPC rejects before controller access with `INVALID_PAYLOAD`                     |
| TC-VIEWER-007    | FR-060     | IPC      | Untrusted sender invokes viewer open               | IPC rejects before controller access with `UNAUTHORIZED_SENDER`                 |
| TC-VIEWER-008    | FR-061     | IPC      | Renderer asks to open an allowed Notion URL externally | IPC routes through the same Notion URL policy before `shell.openExternal`       |
| TC-VIEWER-009    | FR-061     | IPC      | Internal open fails with raw Electron details      | Renderer-facing error is sanitized to `INTERNAL_ERROR` without stack            |
| TC-VIEWER-UI-001 | FR-062     | Renderer | A Today Review item is selected                    | Title/category remain visible above document controls and rating buttons remain available |
| TC-VIEWER-UI-002 | FR-062     | Renderer | Document/status detail content is long             | Viewer body scrolls internally and the rating/action controls stay fixed        |
| TC-VIEWER-UI-003 | FR-061     | Renderer | Unsafe URL error is returned                       | UI shows a sanitized public message, not the raw URL parser/backend detail      |

## Verification Notes

- Feature files are still specifications only; Cucumber steps are undefined.
- Live Notion login and content rendering in the embedded internal view require manual Electron verification.
