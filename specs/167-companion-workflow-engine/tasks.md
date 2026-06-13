# Tasks — Companion Workflow Engine

> Spec: [`spec.md`](./spec.md) · Plan: [`plan.md`](./plan.md) · Surface: **spec-kit extension** (`speckit-extension/`) only
> Tasks are ordered by file and dependency, not by story. `[P]` = touches a distinct file with no incomplete dependency (safe to run in parallel).

## Setup

- [x] T001 Create the `speckit-extension/workflows/` directory (the new home for the workflow definition; it does not yet exist).
- [x] T002 Pre-flight re-validation against the installed `specify` CLI (0.9.5.dev0) and record findings inline in `plan.md` Decisions (FR-011): confirm the step registry contains `command`, `gate`, and `switch`/`if`; confirm `specify workflow run|resume|info|add` are present; confirm workflows register via the separate `workflow add` catalog (NOT `extension.yml` `provides`); and resolve the `speckit_version` floor — pin `>=0.9.5` unless an earlier 0.9.x shipping `workflow run`/`resume` is confirmed (resolves the plan's NEEDS CLARIFICATION).

## Foundational (blocking — the YAML references these command names)

- [x] T003 Create the complexity-classify command at `speckit-extension/commands/speckit.companion.classify.md`: a thin step that emits a `size` of `small | normal | oversized` from the ≤5-files / ≤10-tasks heuristic (FR-004, FR-005, plan Decision 4). The thresholds (5 / 10) live in this command body, not a VS Code setting. Output must expose `size` so a `switch` `expression` can read `steps.classify.output.size`.
- [x] T004 Create the terminal completion command at `speckit-extension/commands/speckit.companion.mark-complete.md`: writes `status: completed` to `.spec-context.json` (the AI never hand-writes `completed`; the command does), reusing the existing `write-context.py` path (FR-006, plan Decision 5). Confirm in T002/here that no existing `speckit.companion.*` command already writes `completed` (capture-implement stops at `implemented`).

## Core work

- [x] T005 Author the workflow definition at `speckit-extension/workflows/speckit-companion.workflow.yml`, mirroring the bundled `speckit/workflow.yml` shape (`schema_version: "1.0"`, `workflow` id `speckit-companion`, `requires.speckit_version: ">=0.9.5"` + `integrations.any`, `inputs` `spec`/`integration: auto`/`scope`). Steps (depends on T002 floor, T003 classify name, T004 mark-complete name):
  - `specify` → `command: speckit.companion.specify`, `integration: "{{ inputs.integration }}"` (FR-002).
  - `classify` → dispatches `speckit.companion.classify`, emitting `size` (FR-004).
  - `route` → `type: switch`, `expression: "{{ steps.classify.output.size }}"`, with inline nested step definitions per case (branches are inlined, NOT ID references — plan Decision 1): `small:` folds plan/tasks toward implement; `normal:` and `default:` inline the full `review-plan (gate) → plan → review-tasks (gate) → tasks → implement` sequence; `oversized:` inlines a visible-warning step then the full sequence (MUST NOT silently skip — FR-004). Gates use `options: [approve, reject]`, `on_reject: abort` (FR-003).
  - `implement` → `command: speckit.companion.implement` (FR-002).
  - `mark-complete` → terminal `command: speckit.companion.mark-complete` (FR-006).

## Integration

- [x] T006 Edit `speckit-extension/extension.yml`: add `speckit.companion.classify` and `speckit.companion.mark-complete` to `provides.commands` (or the installer skips them); raise `requires.speckit_version` from `>=0.8.5` to `>=0.9.5` (FR-008, value from T002); bump `extension.version`. Do NOT add a `provides.workflows` block — unsupported by the installed schema (FR-007 reconciled, plan Decision 2).
- [x] T007 Register the workflow in the engine catalog: `specify workflow add speckit-extension/workflows/speckit-companion.workflow.yml` (writes `.specify/workflows/workflow-registry.json`), so it is discoverable by `specify workflow run speckit-companion` (FR-007 reconciled).

## Polish — docs (same change, FR-012) and validation

- [x] T008 [P] Update `speckit-extension/README.md`: add a "Companion workflow" section covering `specify workflow run`/`add`/`resume`; retire the `complexityFastPath` setting copy in favor of the YAML routing node.
- [x] T009 [P] Add a `speckit-extension/CHANGELOG.md` entry (user-facing voice; no internal file/symbol names) and confirm it matches the `extension.version` bumped in T006.
- [x] T010 [P] Update `docs/template-profiles.md`: replace the `complexityFastPath` fast-path description with the workflow routing-node model.
- [x] T011 [P] Update `docs/capture-and-timing.md`: describe the `workflow run`/`resume` capture path (each step still captures into `.spec-context.json`; implement still journals per-task finishes — FR-009).
- [x] T012 [P] Update root `CLAUDE.md` where the dual-extension / capture model is described to reflect the new Companion workflow. Do NOT touch root `README.md`, root `CHANGELOG.md`, or `package.json` (FR-012, spec-kit-extension-only change).
- [x] T013 Validate the YAML: `specify workflow info speckit-extension/workflows/speckit-companion.workflow.yml` reports zero validation errors (SC-007). Depends on T005/T006.
- [ ] T014 Live end-to-end check: `specify workflow run speckit-companion` walks specify → plan → tasks → implement → mark-complete pausing at each gate (SC-001), then `specify workflow resume <run_id>` resumes a forced-pause run from the exact node with no repeated/skipped step (SC-002).
- [ ] T015 Route verification across one fixture per branch (SC-003): `small` folds plan/tasks toward implement; `normal` runs all four phases; `oversized` prints a warning and still runs all four (3/3 route correctly, 0 silent skips).
- [x] T016 Additive-only diff check (SC-005): confirm the stock `speckit` workflow, its commands, and all other installed extension files are byte-for-byte unchanged — the diff shows only the new files plus the extension's own README/CHANGELOG/version/docs.
- [ ] T017 Run the capture eval `/eval-speckit-extension` for a full Companion workflow run (SC-006, FR-013): `.spec-context.json` records each step with real (non-backfilled) timing, implement journals per-task finishes, and the run terminates at `status: completed` (SC-004).

## Dependencies

- **T002 (pre-flight)** gates the `speckit_version` floor used in T005/T006 and the schema fields the YAML uses.
- **T003 (classify)** and **T004 (mark-complete)** must exist before **T005** — the YAML references those command names.
- **T005 (YAML)** → **T006 (register commands + floor + version)** → **T007 (catalog add)** are sequential on the same wiring.
- **T013–T017 (validation)** all require T005–T007 complete; T016 also implicitly requires every authored file to be in place.

## Parallel

- **T008, T009, T010, T011, T012** are all docs in distinct files with no shared dependency once T005–T007 land — run together.
- **T003 and T004** are distinct command files with no interdependency — they can be authored in parallel before T005.

## Validation status

Static + structural acceptance is complete and green: **T013** (engine validator + `workflow info` both report **zero errors**, SC-007), **T007** (`specify workflow add` installs it; `workflow list`/`info` discover it; runnable by ID — workspace catalog pollution reverted, the shipped deliverable is the file under `speckit-extension/workflows/`), **T016** (additive-only diff — stock `speckit` workflow, `.claude/`, and `.specify/` are unchanged), plus the 46-test `speckit-extension` unittest suite and the `--mark-complete` `implemented → completed` promotion verified directly.

**T014, T015, T017** are live, interactive acceptance checks deferred to a manual run — each dispatches the **real** AI pipeline (`specify workflow run speckit-companion` launches the integration CLI to author a whole spec/plan/tasks/implementation) and the review **gates pause** under a non-TTY (`PAUSED`, resumable), so they can't complete end-to-end unattended; **T017** additionally runs the user-invoked `/eval-speckit-extension` skill. Mechanics verified statically from the engine source: gates pause→resume from the exact node (`gate`/`engine.resume`); the `switch` falls through to its **full-pipeline `default`** when the classify `size` isn't captured (never a silent skip); `mark-complete` lands `status: completed`.
