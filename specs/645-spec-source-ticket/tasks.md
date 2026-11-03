# Tasks: A spec keeps the ticket it came from

- [x] **T001** [P] [US1] Add the Source line rule to the three draft-spec nodes · apps/speckit-extension/nodes/specify/draft-spec.md, draft-spec-delta.md, draft-spec-bugfix.md
- [x] **T002** [P] [US1] [US2] Record `source`, `extends`, `supersedes` in finalize's wrap-up batch, never fetching a URL · apps/speckit-extension/nodes/specify/finalize.md
- [x] **T003** [P] [US1] Type `source`, `extends`, `supersedes` on SpecContext · apps/vscode/src/core/types/specContext.ts
- [x] **T004** [US1] Rebuild the assembled commands · apps/speckit-extension/commands/
- [x] **T005** [US1] [US2] Test the built specify command carries the rule and a batch with source and extends lands on the record · apps/speckit-extension/tests/test_spec_source.py
- [x] **T006** Changelog line and run the gates · apps/speckit-extension/CHANGELOG.md

T001 to T003 are independent; T004 needs T001 and T002; T005 needs T004.

## Phase 2: Convergence

- [x] T007 Tell the draft steps to take the first ticket as Source when a brief names several, and mention the rest under Assumptions, per Edge Cases (partial)
