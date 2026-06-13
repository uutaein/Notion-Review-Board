# MEMORY.md

## Current Project

- Product: Notion Review Board
- Runtime: Electron Desktop
- Primary Platform: Windows
- Storage: SQLite
- Review Engine: FSRS
- Timezone: Asia/Seoul

## Current Phase

- Phase: Traceability repair before next implementation loop
- Active Feature: review-source + field-mapping closure
- Active SRS IDs:
  - SRS-FR-010
  - SRS-FR-011
  - SRS-FR-012
  - SRS-FR-013
  - SRS-FR-020
  - SRS-FR-021
  - SRS-FR-022

## Current Decision Summary

- Notion Page is the review unit.
- Notion DB/Data Source is Review Source.
- Database inputs with multiple Data Sources are rejected; users must enter a Data Source directly.
- Duplicate normalized Notion Targets are rejected.
- Source deletion supports archive, delete tombstone, and keep-history policies.
- Review Logs are preserved for every Source deletion policy.
- `orphaned` status and `system-deleted` sentinel Source are not used.
- Changed pages do not automatically alter dueAt.
- Missing pages are not immediately deleted.

## Last Completed

- PRD v0.1 drafted.
- SRS v0.1-draft drafted.
- MVP acceptance tests listed.
- Root TRACEABILITY.md created to connect PRD, SRS, Feature, TC, code, tests, and status.
- AGENTS.md updated from the previous reservation project to the current Notion Review Board context.
- Shared agent rules now cover Gemini/Codex roles, Electron security, SDD traceability, and automatic handoff updates.
- ADR-015 accepted for Source target resolution, uniqueness, deletion policies, and log preservation.
- SRS-OPEN-002 and SRS-OPEN-004 closed by ADR-015.
- Verification baseline: 11 Vitest files and 152 tests passed; typecheck passed.
- Cucumber Feature scenarios are specifications only; dry-run reports undefined steps.

## Next Action

- Close the Review Source/Field Mapping backend contract before starting renderer UI.
- Define the schema/service repair for nullable primary Source and Review Log snapshots.
- Remove `orphaned` and `system-deleted` behavior through a migration-backed repair.
- Add TC-SOURCE-028 ~ 034 and remaining Source/Mapping tests, then update TRACEABILITY.md status.

## Open Questions

- SRS-OPEN-003: deleted 확정 기준
- SRS-OPEN-010: FSRS state serialization

## Risk Notes

- Notion API version changes may affect data source query behavior.
- Electron viewer must not expose Node.js to remote content.
- Token must never appear in logs/UI.
- Do not mark Feature scenarios verified until step definitions or equivalent executable evidence exist.
- Current code uses `orphaned` status and `system-deleted` Source contrary to accepted ADR-015.
- ADR-015 requires a migration before the Source deletion backend can be considered verified.
- No standalone TEST_MATRIX exists; `docs/test-cases/*.md` currently serves as the test matrix.

## Regression Scope

- Token setting
- Source CRUD
- Sync
- Today Review
- Review Rating
