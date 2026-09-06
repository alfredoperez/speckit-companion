# Tasks: A hook anchored to a name that means two things is drawn once

- [x] **T001** Add a shared precedence helper that resolves one hook's anchor to its winning boundary kind (step, node, phase), matching the order `insert_hooks` already splices in + speckit-extension/scripts/hook_render.py
- [x] **T002** Have `insert_hooks` use the helper instead of its inline node-then-phase loop, so there is one definition and no drift + speckit-extension/scripts/hook_render.py
- [x] **T003** In `build_graph`, resolve each step's hooks to a winning boundary once and key the step, phase, and node hook lists off that resolution instead of re-testing `anchor ==` in three places + speckit-extension/scripts/pipeline-graph.py
- [x] **T004** Keep the parked-hook tally reading the same resolution, so a parked ambiguous hook counts once + speckit-extension/scripts/pipeline-graph.py
- [x] **T005** Test: a hook anchored to `orchestrate` on the `auto` step is emitted exactly once, on the boundary the built body puts it at + speckit-extension/tests/test_pipeline_graph.py
- [x] **T006** [P] Test: unambiguous hooks, an anchor matching nothing, and parked hooks are unchanged + speckit-extension/tests/test_pipeline_graph.py
