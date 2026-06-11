# Tasks: Script-written task_summaries + live implement percentage label

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Dependency-ordered. Tasks marked `[P]` touch different files and may run in parallel.

## Phase 1: Capture — write task_summaries from the script (P1)

- [x] **T001** Add a `task_summaries` upsert helper + `--did`/`--files` CLI flags to
  `speckit-extension/scripts/write-context.py`, and wire the `--task --kind complete` branch
  to write `task_summaries.<id> = {status:"DONE", did?, files?}` (preserving existing keys)
  while still appending the history finish event via `journal_task_finish`.
- [x] **T002** Add a Python test in `speckit-extension/tests/test_context.py` proving the
  `--task` path writes a well-formed `task_summaries` entry (status/did/files), keeps the
  single history finish event, is idempotent, and preserves unrelated `task_summaries` keys.

## Phase 2: Command body — call the script instead of hand-editing (P1)

- [x] **T003** Update `speckit-extension/presets/_shared/timing-partial.md` so the implement
  rule journals each task via `write-context.py --task <id> --kind complete --did "…" --files "…"`
  (one call per task as it finishes, no hand-authored `task_summaries` edit, not batched), and
  propagate the identical timing block verbatim to every command body that embeds it so
  `check-shape-parity.py` stays green.

## Phase 3: UI — live color-shifting implement percentage label (P2)

- [x] **T004** Restyle the implement `%` indicator in
  `webview/src/spec-viewer/components/StepTab.tsx` +
  `webview/styles/spec-viewer/_navigation.css` into a right-aligned label whose color ramps
  toward the success/goal color as `taskCompletionPercent` approaches 100%, driven by the live
  value (no capture dependency).

## Phase 4: Verify

- [x] **T005** Run `npm run compile && npm test`,
  `python3 speckit-extension/scripts/check-shape-parity.py`, and
  `python3 -m unittest discover speckit-extension/tests`; verify the `task_summaries` shape
  against `specs/138-harden-capture-shape`. Fix any failures.
