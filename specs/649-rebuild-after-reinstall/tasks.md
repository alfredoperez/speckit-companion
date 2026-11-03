# Tasks: Rebuild the pipeline after a Companion reinstall

## Phase 2: Foundational

- [x] **T001** [P] [US3] `.github/skills` in the copy step's areas · apps/speckit-extension/scripts/emission_sync.py

## Phase 3: User Story 1 (P1)

- [x] **T003** [US1] `rebuildIfLost` previews, rebuilds on a difference and logs · apps/vscode/src/features/specs/pipelineBuildCommands.ts
- [x] **T004** [US1] Call it at startup and when the extension's files change · apps/vscode/src/extension.ts
- [x] **T005** [US1] Test rebuildIfLost: differs, matches, unconfigured · apps/vscode/src/features/specs/__tests__/rebuildIfLost.test.ts

## Phase 4: Polish

- [x] **T006** [US3] Python test: the build refreshes a Copilot skill · apps/speckit-extension/tests/test_emission_sync.py
- [x] **T007** Changelog lines and the gates · CHANGELOG.md, apps/speckit-extension/CHANGELOG.md

## Dependencies & Execution Order

Foundational T001 first; T003 blocks T004 and T005; Polish last.
