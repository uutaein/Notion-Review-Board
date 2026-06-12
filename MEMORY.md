# MEMORY.md

## Current Project

- Product: Notion Review Board
- Runtime: Electron Desktop
- Primary Platform: Windows
- Storage: SQLite
- Review Engine: FSRS
- Timezone: Asia/Seoul

## Current Phase

- Phase: SRS → Feature → TC
- Active Feature: review-source
- Active SRS IDs:
  - SRS-FR-010
  - SRS-FR-011
  - SRS-FR-012
  - SRS-FR-013

## Current Decision Summary

- Notion Page is the review unit.
- Notion DB/Data Source is Review Source.
- Review Log must be preserved by default.
- Changed pages do not automatically alter dueAt.
- Missing pages are not immediately deleted.

## Last Completed

- PRD v0.1 drafted.
- SRS v0.1-draft drafted.
- MVP acceptance tests listed.
- Root TRACEABILITY.md created to connect PRD, SRS, Feature, TC, code, tests, and status.
- AGENTS.md updated from the previous reservation project to the current Notion Review Board context.
- Shared agent rules now cover Gemini/Codex roles, Electron security, SDD traceability, and automatic handoff updates.
- Verification baseline: 11 Vitest files and 152 tests passed; typecheck passed.
- Cucumber Feature scenarios are specifications only; dry-run reports undefined steps.

## Next Action

- Review TRACEABILITY.md coverage gaps before selecting the next implementation scope.
- Complete unmapped Review Source and Field Mapping TC coverage or begin renderer UI cases.
- Confirm SRS-OPEN-002 handling policy.

## Open Questions

- SRS-OPEN-002: Database vs Data Source compatibility
- SRS-OPEN-003: deleted 확정 기준
- SRS-OPEN-010: FSRS state serialization

## Risk Notes

- Notion API version changes may affect data source query behavior.
- Electron viewer must not expose Node.js to remote content.
- Token must never appear in logs/UI.
- Do not mark Feature scenarios verified until step definitions or equivalent executable evidence exist.

## Regression Scope

- Token setting
- Source CRUD
- Sync
- Today Review
- Review Rating
