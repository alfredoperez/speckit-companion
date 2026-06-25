# Tasks — Living Specs end-to-end validation gate (LS·4)

**Issue:** #364 · **Spec:** `specs/359-living-specs-e2e-gate/spec.md` · **Plan:** `plan.md`

## Phase 1 — Accumulation fixture (US1)

- [x] **T001** Add `bakeLs4Repo` to `ls-lib.mjs`: one `todos` capability + real living spec, feature A spec (no delta block), feature B spec (real `## ADDED Requirements` delta), finished `.spec-context.json` per feature, `src/todos/**` change on a feature branch so the fold's merge-base diff is in scope.
- [x] **T002** Add a `capabilitiesTree` helper to `ls-lib.mjs` that lists `capabilities/**` files (relative) for the opt-out file-tree diff.

## Phase 2 — Opt-out fixture (US2)

- [x] **T003** Add `bakeLs4OptOutRepo` to `ls-lib.mjs`: same shape, `enabled: false`, the delta feature present.

## Phase 3 — Demo runner (US1, US2, US3)

- [x] **T004** Add `runLs4()` to `ls-demos.mjs`: read living spec before → fold A → read after-A → fold B → read after-B; build real unified diffs (before→after-A, before→after-B).
- [x] **T005** Add accumulation assertions: after-A == before (no-op); after-B contains B's requirement; after-B still contains the original requirement (no clobber); monotonic growth.
- [x] **T006** Add opt-out act/assert: snapshot capability-spec bytes + `capabilities/**` tree before/after a fold on the disabled repo; assert byte-equality, empty tree diff, no `livingSpecs.synced`.
- [x] **T007** Assemble `LS4.json` evidence with honest per-run `mode` (`real+seeded-spec` accumulation, `deterministic` opt-out), `runPytest` green assertion, and `verdict`. Register `LS4` in `RUNNERS`.

## Phase 4 — Run, verify, document (US3)

- [x] **T008** Run `node ls-demos.mjs LS4` → confirm verdict `PASS`; confirm `LS4.json` + history row written, repo-relative paths only.
- [x] **T009** Append the LS·4 section to the vault status page, flip the LS·4 row to shipped, bump the shipped count to 4/8.
- [x] **T010** Verify green: `npm run compile && npm test`; `pytest speckit-extension/tests/ -q`; `check-shape-parity.py`; `check_capture.py` unchanged.
