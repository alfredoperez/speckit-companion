# Tasks — Fast-path lean files (#237)

> Fast-tracked (simple mode). Dependency-ordered; `[P]` marks tasks that can run in parallel.

- [x] **T001** Rewrite the `simple`-mode branch (step 6) in the namespaced command to write three lean files — keep an `Approach` section in `spec.md`, add a `plan.md` pointer, move the `Implementation Tasks` checklist into a real `tasks.md`; update step-6 prose, the Output line, and the lifecycle-fold preamble + speckit-extension/commands/speckit.companion.specify.md
- [x] **T002** Apply the identical step-6 edit to the parity twin so both bodies stay byte-identical below frontmatter + speckit-extension/presets/companion-turbo/commands/speckit.specify.md
- [x] **T003** [P] Update the turbo-folder line and the Complexity fast-path simple-mode description to the 3-lean-files shape (spec.md Approach + plan.md pointer + tasks.md checklist) + docs/template-profiles.md
- [x] **T004** [P] Update the fast-path note to drop the "combined single spec.md" framing where it asserts the simple-mode output shape + docs/capture-and-timing.md
- [x] **T005** Run `check-shape-parity.py` and confirm it exits 0 (both bodies identical) + speckit-extension/scripts/check-shape-parity.py
- [x] **T006** Run `npm run compile` (clean) and `npm test` (green); confirm no unit test asserts the old single-combined-spec.md shape + package.json
