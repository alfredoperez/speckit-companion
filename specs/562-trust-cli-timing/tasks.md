# Tasks: Trust timing from CLI-only runs

Feature: specs/562-trust-cli-timing · Size: normal

## Phase 1: Setup

No setup tasks — the change edits existing modules and their existing test files.

## Phase 2: Foundational (blocks all stories)

The writer-authority tier is the shared primitive every story depends on. It lands on both sides of the parity pair.

**Wave 1 — independent (different files):**
- [x] **T001** [P] [US1] Add `boundaryWriterRank` (instrumented=2 / ai=1 / unknown=0) and re-express the trust gate in `deriveStepHistory` — `explicitStarts` accepts any rank>0 step-level start; `closeIsOwnCompletion`/`closeIsNextStart` require a close of rank>0 that is ≥ the start's rank · src/features/specs/stepHistoryDerivation.ts
- [x] **T002** [P] [US3] Port the same tier into the eval's `_derive_trusted_spans` — replace `TRUSTED_BOUNDARY_BY` with `_boundary_writer_rank` and the close-authority rule · .claude/skills/eval-speckit-extension/check_quality.py

**⟶ Wait for Wave 1 to finish, then:**

## Phase 3: User Story 1 — CLI-only run shows timing coverage (P1)

**Wave 2 — independent (different test files):**
- [x] **T003** [P] [US1] Add a derivation test: four ordered `by:ai` step-level start/complete pairs → all four phases `durationTrusted` and `deriveTimingSummary` reports 4/4 · src/features/specs/__tests__/stepHistoryDerivation.test.ts

**Checkpoint**: A CLI-only `by:ai` run derives trusted timing coverage.

## Phase 4: User Story 2 — a premature AI finish still cannot fake a duration (P1)

- [x] **T004** [US2] Add derivation tests that must stay red on regression: (a) extension start + `ai` step-level complete 100ms later → untrusted; (b) `ai` complete with no start → no measured duration; and keep the existing fast-path-fold and multi-start anomaly cases green · src/features/specs/__tests__/stepHistoryDerivation.test.ts

**Checkpoint**: The masquerade and advance-only shapes remain untrusted under the loosened gate.

## Phase 5: User Story 3 — the Python eval agrees with the viewer (P2)

- [x] **T005** [US3] Add parity tests pinning both directions in the eval: an all-`by:ai` history trusts the same phases; the extension-start + `ai`-close masquerade stays untrusted · speckit-extension/tests/test_check_quality.py

**Checkpoint**: `check_quality.py` draws the identical line to the viewer, pinned on both drift directions.

## Phase 6: Polish

- [x] **T006** [US1] Update `docs/capture-and-timing.md` — the "Timing honesty rider" note now reads: a span is trusted when both boundaries come from a deterministic writer and the close is ≥ the start's authority (a coherent CLI `by:ai` run is trusted; the extension-start + premature-`ai`-close masquerade is not) · docs/capture-and-timing.md
- [x] **T007** [US1] Fold the trust-rule delta into the `specs` living spec at mark-complete (author the `## MODIFIED Requirements` block marked `<!-- capability: specs -->` in spec.md) · specs/562-trust-cli-timing/spec.md
- [x] **T008** [US1] Validate against Success Criteria — `npm run compile && npm test`, `python3 -m unittest discover -s speckit-extension/tests`, `python3 check-shape-parity.py`, and the capture/quality eval · (validation)

## Dependencies & Execution Order

- Phase 2 (T001, T002) is foundational and blocks all tests — the tier must exist before any test exercises it. T001 and T002 are independent files (Wave 1, parallelizable).
- Phase 3 (T003), Phase 4 (T004), Phase 5 (T005) each depend only on their respective Wave-1 file; T003/T004 touch the same test file (serialize), T005 is independent.
- Phase 6 (T006 docs, T007 living-spec delta, T008 validation) runs last; T008 depends on everything.
