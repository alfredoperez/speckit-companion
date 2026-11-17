# Tasks: Release QA leftovers

No setup or foundational work: every story owns its own files.

## Phase 1: User Story 1 - A code edit always marks a check out of date (P1)

Files: `apps/speckit-extension/scripts/capture.py`, `apps/speckit-extension/tests/test_receipts.py`

### Tests

- [x] **T001** [US1] FR-001: a same-size rewrite of a tracked file within the same second as the commit still reads out of date, through `receipts.py` · apps/speckit-extension/tests/test_receipts.py

### Implementation

**⟶ Wait for T001, then:**

- [x] **T002** [US1] Copy the index with `shutil.copy2` so its mtime survives · apps/speckit-extension/scripts/capture.py

**Checkpoint**: the receipt test passes 50 of 50 runs.

## Phase 2: User Story 2 - The board shows no fake recent time (P2)

Files: `apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/public/app.js`, `apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/spec-rules.mjs`, `apps/copilot-canvas/tests/page.test.mjs`, `apps/copilot-canvas/tests/core.test.mjs`

### Tests

**Wave 1 — independent (different files):**

- [x] **T003** [P] [US2] FR-002, FR-003: the rendered card shows no time for a record with no history, file time for a spec with no record · apps/copilot-canvas/tests/page.test.mjs
- [x] **T004** [P] [US2] FR-002: `sortSpecs` ignores file time for a spec with a record · apps/copilot-canvas/tests/core.test.mjs

### Implementation

**⟶ Wait for Wave 1 to finish, then (Wave 2 — independent):**

- [x] **T005** [P] [US2] Card time falls back to `updatedAt` only when `hasContext` is false · apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/public/app.js
- [x] **T006** [P] [US2] Sort key applies the same rule · apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/spec-rules.mjs

**Checkpoint**: a fresh checkout's record-only spec shows no "just now".

## Phase 3: User Story 3 - Release QA tooling explains itself (P3)

Files: `apps/website/package.json`, `apps/website/README.md`, `.claude/skills/release-qa/qa-stage.sh`, `.claude/skills/release-qa/SKILL.md`, `apps/speckit-extension/scripts/check-command-emissions.py`

### Tests

- [x] **T007** [US3] FR-004, FR-005, FR-007: run the preview and load `/`; run `qa-stage.sh` in this linked worktree and see it stop naming `npm ci`; read the gate message · manual, results recorded with `--verify-run`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T008** [P] [US3] FR-004: preview serves `dist/client` with `python3 -m http.server` · apps/website/package.json, apps/website/README.md
- [x] **T009** [P] [US3] FR-005, FR-006: gate on a linked `node_modules` before any build; guide recommends an own worktree with `npm ci` · .claude/skills/release-qa/qa-stage.sh, .claude/skills/release-qa/SKILL.md
- [x] **T010** [P] [US3] FR-007: gate failure message names `/install-local` · apps/speckit-extension/scripts/check-command-emissions.py

**Checkpoint**: each QA tool fails or runs with a message that says what to do.

## Phase 4: Polish

- [x] **T011** Run the related tests and `npm run test:all` against the Success Criteria · repo root

## Dependencies & Execution Order

Phases 1, 2 and 3 own disjoint files and can run in any order; Polish runs last. Phase 1: T001 then T002. Phase 2: Wave 1 (T003, T004) then Wave 2 (T005, T006). Phase 3: T008–T010 in one wave, then T007 checks them.
