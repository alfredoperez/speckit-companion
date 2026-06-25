# Tasks — Fold-back / archive-as-merge (LS·3)

**Issue:** #363

## Phase 1 — Fold script (US1, US2, US3, US4, US5)

- [x] T001 Add a delta parser to `write-context.py`: `parse_spec_deltas(spec_md)` returns ADDED/MODIFIED/REMOVED/RENAMED blocks of OpenSpec requirements (heading + scenarios), honoring the per-block `<!-- capability: <name> -->` marker.
- [x] T002 Add the fold applier `apply_deltas(living_md, deltas)`: append (ADDED), replace-by-heading (MODIFIED), delete (REMOVED), rename heading (RENAMED). Idempotent for ADDED (skip if heading already present).
- [x] T003 Add `fold_living_spec(feature_dir, by)`: resolve target capabilities via the LS·1 resolver (most-specific; marker overrides/adds), read each capability spec, apply deltas, write back, log a per-capability summary, record synced names via `set_living_specs_synced`. No-op when no delta blocks or feature off / no config. Best-effort.
- [x] T004 Add `set_living_specs_synced(feature_dir, names)` mirroring `set_living_specs_loaded` (additive `livingSpecs.synced`, de-duped, never a lifecycle key).
- [x] T005 Wire `--fold-living-spec` into `main()` arg parsing + dispatch + success message.

## Phase 2 — mark-complete wiring (US1)

- [x] T006 Add the fold-back step to `speckit-extension/commands/speckit.companion.mark-complete.md` (after the completion write) and `speckit-extension/nodes/implement/complete.md`.
- [x] T007 Regenerate the golden (`capture-golden.py`) and confirm `check-shape-parity.py` passes.

## Phase 3 — check_living_spec.py (NFR004)

- [x] T008 Add `.claude/skills/eval-speckit-extension/check_living_spec.py` (sibling of `check_capture.py`, same Report/`--json` shape): assert every ADDED present in after, REMOVED gone, MODIFIED changed, RENAMED renamed, count delta correct, idempotency.

## Phase 4 — Tests (US1–US5)

- [x] T009 Extend `speckit-extension/tests/test_living_specs.py`: ADDED appends, MODIFIED replaces, REMOVED deletes, RENAMED renames, write-most-specific, the `<!-- capability -->` marker, no-delta no-op, idempotency, opt-out (enabled:false → untouched), `livingSpecs.synced` not a protected lifecycle key.

## Phase 5 — Bench demo + evidence (NFR004)

- [x] T010 Add LS3 arrange/act helpers to `examples/todo-claude/bench/living-specs/ls-lib.mjs`: bake a sandbox with a real `capabilities/todos/spec.md` + a real feature spec carrying a genuine `## ADDED Requirements` delta; run the real fold script + `check_living_spec.py`; capture before/after + `git diff --no-index`.
- [x] T011 Add the LS3 runner to `ls-demos.mjs` (mode `real+seeded-spec`); produce `evidence/LS3.json` (repo-relative paths only).

## Phase 6 — Docs + version (release hygiene)

- [x] T012 Update `speckit-extension/README.md`, `speckit-extension/CHANGELOG.md`, and bump `speckit-extension/extension.yml` version.

## Phase 7 — Vault status page

- [x] T013 Append an LS·3 section to the vault status page `status.html` and flip the LS·3 row to shipped.
