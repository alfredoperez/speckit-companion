# Tasks: Complete the ICE capture

**Feature**: 386-ice-capture · **Plan**: [plan.md](./plan.md)

## Phase 1: Setup

No setup tasks.

## Phase 2: Foundational

**Wave 1 — independent (different files):**

- [x] **T001** [P] `--context` flag + dispatch + print line in the writer; pytest cases (append/de-dupe/no-op/idempotent) · `speckit-extension/scripts/write-context.py`, `speckit-extension/tests/test_capture_fields.py`
- [x] **T002** [P] Declare `context` in the JSON schema and both ViewerState copies; derivation passthrough dropping non-strings + tests · `src/core/types/spec-context.schema.json`, `src/core/types/specContext.ts`, `webview/src/spec-viewer/types.ts`, `src/features/spec-viewer/stateDerivation.ts`, `__tests__/stateDerivation.test.ts`

## Phase 3: User Story 1+2 — emissions (P1)

**Wave 1:**

- [x] **T003** [US1,US2] Emit per-FR titled coverage in `draft-spec` and `--context` entries in `finalize`; reassemble commands + refresh goldens; parity green · `speckit-extension/nodes/specify/draft-spec.md`, `speckit-extension/nodes/specify/finalize.md`, assembled commands

## Phase 4: Polish

**Wave 1 — independent (different files):**

- [x] **T004** [P] Docs (capture WHEN map, schema reference) + spec-kit ext CHANGELOG entry · `docs/capture-and-timing.md`, `docs/spec-context-schema.md`, `speckit-extension/CHANGELOG.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T005** Full gate: jest + python + parity + tsc; validate SC-001/002 against this run's own context · repo root

## Dependencies & Execution Order

Foundational (T001/T002 parallel) → T003 (needs the flag) → T004 parallel-safe → T005 gate.
