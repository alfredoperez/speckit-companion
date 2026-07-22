# Tasks: Fast path fills the Overview

Feature: [spec.md](./spec.md) · Plan: [plan.md](./plan.md)

## Phase 1: Setup

No setup tasks — the change lives inside the existing capture runtime and node bodies.

## Phase 2: Foundational

The recorder script is the shared foundation both node bodies call. It must exist and be packaged before the node bodies reference it.

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US2] Create `speckit-extension/scripts/record-living-specs.py`: `--feature-dir` + `--changed` CLI that path-imports `resolve-spec-paths.py`, calls `load_living(root)`, gates on `enabled`, runs `match_changed`, and records matched names via `capture.set_living_specs_loaded`; whole body wrapped best-effort so any error prints one stderr line and exits 0 · speckit-extension/scripts/record-living-specs.py
- [x] **T002** [P] [US2] Add `record-living-specs.py` to `RUNTIME_SCRIPTS` in `package-manifest.py` so a real install ships it · speckit-extension/scripts/package-manifest.py

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** [US2][US3] Add `speckit-extension/tests/test_record_living_specs.py`: enabled+match records leaf-first; disabled/absent registry no-ops; no-match no-ops; unresolvable input exits 0 silently; already-populated merge stays idempotent · speckit-extension/tests/test_record_living_specs.py

## Phase 3: User Story 1 — Approach card on fast-path (P1)

**Wave 2 — single task:**

- [x] **T004** [US1] In `speckit-extension/nodes/specify/finalize.md`, add a `write-context.py --set approach="<one-line approach>"` call in the fast-path (simple-mode) area alongside the existing intent/expectation writes, so a fast-path run ends with a non-empty `approach` field · speckit-extension/nodes/specify/finalize.md

## Phase 4: User Story 2 — Living-spec chips on fast-path (P1)

**Wave 3 — independent node-body edits (different files):**

- [x] **T005** [P] [US2] In `speckit-extension/nodes/specify/load-living-specs.md`, replace the AI gate-and-decide recording with a single call to `record-living-specs.py --feature-dir <fd> --changed <touched files>`; keep the AI's *reading* of specs for drafting as best-effort prose · speckit-extension/nodes/specify/load-living-specs.md
- [x] **T006** [P] [US2] In `speckit-extension/nodes/specify/finalize.md`, in the fast-path living-spec load, call `record-living-specs.py` with the touched files (only when `livingSpecs.loaded` is empty) instead of asking the AI to gate-and-record · speckit-extension/nodes/specify/finalize.md

**⟶ Wait for Wave 3 to finish, then:**

- [x] **T007** [US2] Regenerate the assembled command bodies (`python3 speckit-extension/scripts/assemble-nodes.py`), then re-bless golden (`capture-golden.py`); confirm `assemble-nodes.py --check` and `check-shape-parity.py` pass · speckit-extension/commands/*.md

## Phase 5: Polish

**Wave 4 — independent (different files):**

- [x] **T008** [P] [US1][US2] Document the deterministic recorder and the fast-path approach write in `docs/capture-and-timing.md` (the fast-path fold section) · docs/capture-and-timing.md
- [x] **T009** [P] [US1][US2] Extend the capture eval so a fast-path fixture asserts a non-empty `approach` and a recorded `livingSpecs.loaded`; run `check_capture.py` on `specs/514-fast-path-fixture` and confirm CI quality-eval fixtures still pass · .claude/skills/eval-speckit-extension/check_capture.py

**⟶ Wait for Wave 4, then final validation:**

- [x] **T010** [US1][US2][US3] Run the deterministic proof (recorder against a tmp dir writes `livingSpecs.loaded`; a fast-path finalize run ends with `approach`), plus `npm run compile && npm test`, the Python unittest suite, `check-shape-parity.py`, and `package-manifest.py --check` — all green · (verification only)

## Dependencies & Execution Order

Setup (none) → Foundational (T001, T002 in Wave 1; T003 after) → US1 (T004) → US2 (T005, T006 in Wave 3; T007 assembles after) → Polish (T008, T009 in Wave 4; T010 validates last). T001 blocks the node-body calls (T005, T006) and the tests (T003). T005/T006 block the golden re-bless (T007).
