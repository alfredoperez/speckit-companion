# Tasks — provider-aware parallelization across the Companion pipeline

Dependency-ordered. `[P]` marks tasks touching different files with no incomplete dependency (safe to fan out across subagents on a capable provider; informational otherwise).

## Foundational

- [x] T001 Create `speckit-extension/presets/_parts/parallel.md` — the capability primer (investigate / mark / execute, plus graceful sequential fallback), in the house tone of `timing.md`. Blocks every `parallel` fence (an unknown part name is a hard error).

## Core work

- [x] T002 [P] Prepend a `parallel` part fence after the `## Outline` lead-in in `speckit-extension/nodes/specify/_frame.md`.
- [x] T003 [P] Prepend a `parallel` part fence after the `## Outline` lead-in in `speckit-extension/nodes/plan/_frame.md`.
- [x] T004 [P] Prepend a `parallel` part fence after the `## Outline` lead-in in `speckit-extension/nodes/tasks/_frame.md`.
- [x] T005 [P] Prepend a `parallel` part fence after the `## Outline` lead-in in `speckit-extension/nodes/implement/_frame.md`.
- [x] T006 [P] Add the parallel fan-out step to `speckit-extension/nodes/plan/gather-context.md`.
- [x] T007 [P] Make `[P]` marking provider-aware in `speckit-extension/nodes/tasks/tasks-doc.md`.
- [x] T008 [P] Upgrade step 2 in `speckit-extension/nodes/implement/implement-exec.md` to fan out `[P]` batches concurrently + name the agent-routing seam.

## Integration

- [x] T009 Run `assemble-nodes.py` to write the four command bodies from the edited nodes/parts (depends on T001–T008).
- [x] T010 Re-bless golden via `capture-golden.py`, then confirm `assemble-nodes.py --check` + `check-shape-parity.py` both pass (depends on T009).

## Polish

- [x] T011 [P] Bump `speckit-extension/extension.yml` `version` 0.9.0 → 0.10.0.
- [x] T012 [P] Document the capability in `speckit-extension/README.md` (user-facing voice).
- [x] T013 [P] Add a `speckit-extension/CHANGELOG.md` entry (user-facing voice, no internal symbol names).
- [x] T014 Final verification: `npm run compile && npm test`, `assemble-nodes.py --check`, `check-shape-parity.py`, and the spec-kit-ext python unittests all green (depends on all).

## Dependencies

- T001 blocks T002–T008 (the fence references the part).
- T002–T008 block T009 (assemble reads the edited nodes).
- T009 blocks T010 (bless after the bodies assemble).
- All block T014.

## Parallel

- T002–T008 are independent different-file edits — on a capable provider, fan them out (one subagent per file); journal each as it finishes.
- T011–T013 are independent docs/version edits — also parallelizable.
- T001, T009, T010, T014 are serial gates.
