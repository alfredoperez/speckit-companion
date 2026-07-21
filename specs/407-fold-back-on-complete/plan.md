# Implementation Plan — Fold changes back into every living spec on completion

## Technical Context

- **Language:** Python 3 (stdlib only) for the fold scripts; Markdown for the command/node bodies.
- **Touched capabilities:** `capture-runtime` (`speckit-extension/scripts/**`), `companion-commands` (`speckit-extension/nodes/**`, `speckit-extension/commands/**`).
- **Storage:** `.spec-context.json` per feature dir; capability specs under `capabilities/<name>/spec.md` or the configured colocated path.

## Design

Three seams, verified against the current code:

1. **Parser (`spec_deltas.py`).** `parse_spec_deltas` collapsed each verb's marker to one capability (last-write-wins). Add a parallel `unit_caps: {verb: [cap|None per unit]}` recording each requirement unit's block marker, keeping the existing lists and `markers` for compatibility.

2. **Fold routing (`living_spec_fold.py`).** `_resolve_fold_targets` fanned targets out but `fold_living_spec` applied the full delta set to every target. Add `_deltas_for(deltas, cap_name, is_default)` that keeps only the units marked for a capability (plus unmarked units when it is the changed-files-matched default), have `_resolve_fold_targets` return that default name, and apply the filtered subset per target. Preserve `apply_deltas` idempotency and rename-cycle handling untouched.

3. **Authoring step (`nodes/implement/complete.md`, `commands/speckit.companion.mark-complete.md`).** Before the `--fold-living-spec` call, instruct the AI to author one marked delta block per loaded+changed capability. Reassemble the implement command and re-bless the golden.

## Constitution Check

No new dependencies, no new runtime surfaces, best-effort and idempotent preserved. The extension embeds the authoring instruction in the command text it dispatches; no `.claude/**` or `.specify/**` changes.

## Testing

- Parser: distinct per-unit capabilities across two same-verb blocks.
- Fold: two marked blocks route apart; unmarked block folds into default only; single unmarked block unchanged + idempotent; marker writes a capability the change did not touch.
- Full `pytest tests/`, `npm test`, shape-parity, node-assembly `--check`.
