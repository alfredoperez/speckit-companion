# Tasks: Converge finishes a Companion spec

**Scale note**: about 32 files in three disjoint phases. Phase 3 owns the rebuilt command bodies.

## Phase 1: Setup

None.

## Phase 2: Foundational

None: the three phases own disjoint files.

## Phase 3: User Stories 1 and 2 - implement hands off to converge; auto loops (P1)

Files: `apps/speckit-extension/nodes/implement/complete.md`, `apps/speckit-extension/nodes/implement/handoff.md`, `apps/speckit-extension/nodes/implement/_frame.md`, `apps/speckit-extension/nodes/auto/orchestrate.md`, `apps/speckit-extension/nodes/auto/_frame.md`, `apps/speckit-extension/presets/_parts/self-advance.md`, `apps/speckit-extension/presets/_parts/timing.md`, `apps/speckit-extension/workflows/speckit-companion.workflow.yml`, `apps/speckit-extension/extension.yml`, `apps/speckit-extension/commands/*.md`, `apps/speckit-extension/tests/test_queue_batch.py`

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US1] `complete` node keeps living-spec accounting and closes with `--step implement --advance --by ai --set workflow=companion`; handoff names `speckit.converge` next; frame wording · apps/speckit-extension/nodes/implement/{complete,handoff,_frame}.md
- [x] **T002** [P] [US2] Auto runs converge after implement and repeats implement and converge until a pass appends nothing, three passes at most, then records a concern · apps/speckit-extension/nodes/auto/{orchestrate,_frame}.md
- [x] **T003** [P] [US1] Shared parts: converge, not implement, ends the pipeline · apps/speckit-extension/presets/_parts/{self-advance,timing}.md
- [x] **T004** [P] [US1] Workflow ends on a `speckit.converge` step; command descriptions follow · apps/speckit-extension/workflows/speckit-companion.workflow.yml, apps/speckit-extension/extension.yml

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T005** [US1] Rebuild; fix the pinned "do not complete on red" test wording; build check and shape parity pass · apps/speckit-extension/commands/, apps/speckit-extension/tests/test_queue_batch.py

**Checkpoint**: a Companion run ends at implemented and names converge.

## Phase 4: User Story 3 - converge on a completed spec; doctor and status follow (P2)

Files: `apps/speckit-extension/scripts/write-context.py`, `apps/speckit-extension/scripts/doctor_checks.py`, `apps/speckit-extension/scripts/run_trace.py`, `apps/speckit-extension/scripts/status-context.py`, `apps/speckit-extension/tests/test_custom_steps.py`, `apps/speckit-extension/tests/test_converge_completes.py`, `apps/speckit-extension/tests/test_doctor.py`, `apps/speckit-extension/tests/test_context.py`

### Tests

- [x] **T006** [US3] Converge on a completed spec records its run, stays completed, adds a concern naming open tasks when it appended any; other writes still refused; doctor counts a converge finish as a completion attempt; status shows implemented as next: converge · apps/speckit-extension/tests/{test_custom_steps,test_converge_completes,test_doctor,test_context}.py

### Implementation

**Wave 1 — independent (different files):**

- [x] **T007** [P] [US3] Narrow exception in `update_context` for converge on a completed spec; the converge finish adds the open-task concern · apps/speckit-extension/scripts/write-context.py
- [x] **T008** [P] [US3] `converge-finish` trace op counted in `_COMPLETION_OPS` · apps/speckit-extension/scripts/doctor_checks.py, apps/speckit-extension/scripts/run_trace.py
- [x] **T009** [P] [US3] Implemented with no clean converge reads next: converge · apps/speckit-extension/scripts/status-context.py

**Checkpoint**: converge runs leave a trace on every spec, and the doctor and status read the new end.

## Phase 5: Polish

Files: `apps/speckit-extension/docs/commands.md`, `apps/speckit-extension/docs/node-model.md`, `apps/speckit-extension/README.md`, `apps/website/src/content/docs/docs/steps/index.mdx`, `apps/website/src/content/docs/docs/results/the-overview.mdx`, `apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/public/app.js`, `apps/copilot-canvas/CHANGELOG.md`, `.claude/commands/fix-tickets.md`, `apps/speckit-extension/CHANGELOG.md`

- [x] **T010** [P] The site's Steps page owns the explanation; the other pages link to it or say one line · the files above
- [x] **T011** [P] Canvas next-step hint offers converge after implement · apps/copilot-canvas/.../public/app.js, apps/copilot-canvas/CHANGELOG.md
- [x] **T012** [P] Changelog line · apps/speckit-extension/CHANGELOG.md
- [x] **T013** Run the Python suite, build check, shape parity, emissions, quality gate, manifest gate, `tsc`, and `npm run test:canvas` · repo

## Dependencies & Execution Order

- Phases 3, 4 and 5 own disjoint files and run side by side. Phase 3: wave 1 then T005. Phase 4: T006 then wave 1. T013 runs last.
