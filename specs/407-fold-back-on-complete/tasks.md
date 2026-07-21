# Tasks — Fold changes back into every living spec on completion

## Phase 1 — Parser (US2)

- [x] T001 Extend `parse_spec_deltas` in `speckit-extension/scripts/spec_deltas.py` with a parallel `unit_caps` map recording each requirement unit's block marker.
- [x] T002 Add parser tests: two same-verb blocks marked for different capabilities keep distinct `unit_caps`; unmarked records `None`; alignment across all verbs.

## Phase 2 — Fold routing (US1, US2, US3)

- [x] T003 Add `_deltas_for(deltas, cap_name, is_default)` to `speckit-extension/scripts/living_spec_fold.py`.
- [x] T004 Have `_resolve_fold_targets` return the changed-files-matched default name alongside the targets.
- [x] T005 Route the per-capability filtered deltas through `apply_deltas` in `fold_living_spec`; base the skip-reason log on the filtered set.
- [x] T006 Add fold routing tests: two marked blocks route apart; unmarked folds to default only; single unmarked unchanged + idempotent; marker writes an untouched capability.

## Phase 3 — Authoring step (US1)

- [x] T007 Add the delta-authoring instruction to `speckit-extension/nodes/implement/complete.md` before the fold call.
- [x] T008 Mirror the instruction into `speckit-extension/commands/speckit.companion.mark-complete.md`.
- [x] T009 Reassemble the implement command body and re-bless the golden.

## Phase 4 — Docs & verification

- [x] T010 Update `speckit-extension/README.md`, `speckit-extension/CHANGELOG.md [Unreleased]`, `docs/template-profiles.md`, `docs/capture-and-timing.md`.
- [x] T011 Run `npm run compile && npm test`, `pytest tests/`, shape-parity, node-assembly `--check`.
