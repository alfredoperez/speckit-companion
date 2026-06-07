# Tasks: Full Lifecycle Capture

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** Refactor writer + add per-task journaling — `speckit-extension/scripts/write-context.py` | R004, R011, R012
  - **Do**: Extract feature-dir resolution, `_is_more_advanced`/no-backward-clobber guard, and the canonical step/status helpers into importable module-level functions. Add a task-sync mode (e.g. `--tasks-file <tasks.md>` or `--task <id>`) that reads completed task markers (`- [x] **T###**`) and appends one idempotent transition per completed task (sets `currentTask`, never regresses `currentStep`; skips task ids already present in `transitions`). End at `--status implemented` only when all markers are checked.
  - **Verify**: `python3 speckit-extension/scripts/write-context.py --help` shows the new flag; running task-sync twice on the same `tasks.md` appends task transitions once (idempotent), preserves unknown keys, and never shrinks `transitions`.
  - **Leverage**: existing `update_context` / `resolve_feature_dir` / `_is_more_advanced` in the same file.

- [x] **T002** [P] Derive-from-files writer *(depends on T001)* — `speckit-extension/scripts/derive-from-files.py` | R006, R007, R008, R009, R010
  - **Do**: New stdlib-only script importing the shared helpers from `write-context.py`. Scan the resolved `specs/<NNN>-<slug>/` for `spec.md`→specify/specified, `plan.md`→plan/planned, `tasks.md`→tasks/ready-to-implement, all task markers checked→implement/implemented; cross-check git history. Write the same canonical schema with `by: "derive"`, honoring the no-backward-clobber + terminal-status guards. Best-effort: exit 0 on missing python/unresolved dir.
  - **Verify**: Against a temp dir with mixed task markers, reconstructs `ready-to-implement`; all-checked reconstructs `implemented`; running against a spec already at `implemented` leaves it intact.
  - **Leverage**: resolution + guard helpers factored out in T001.

- [x] **T003** [P] Per-step capture command-markdowns *(depends on T001)* — `speckit-extension/commands/speckit.companion.capture-{plan,tasks,implement}.md` | R001, R002, R011
  - **Do**: Three new command-markdowns mirroring `speckit.companion.capture.md`. `capture-plan` → `write-context.py --step plan --status planned --by extension`; `capture-tasks` → `--step tasks --status ready-to-implement --by extension`; `capture-implement` → writer in task-sync mode against `tasks.md`, ending at `--status implemented`. Include the same python3/graceful-degradation preamble.
  - **Verify**: Each file documents the exact invocation and the never-fail-host contract.
  - **Leverage**: `speckit-extension/commands/speckit.companion.capture.md`.

- [x] **T004** [P] Document new hooks + derive fallback *(depends on T001)* — `speckit-extension/docs/commands.md` | R001, R006
  - **Do**: Add `after_plan`/`after_tasks`/`after_implement` rows to the lifecycle table, document the three new commands + their flags, and add a "derive fallback" subsection for `derive-from-files.py`.
  - **Verify**: Table and command list match `extension.yml`; flags match `write-context.py --help`.
  - **Leverage**: existing structure of `commands.md`.

- [x] **T005** [P] Changelog + roadmap *(depends on T001)* — `speckit-extension/CHANGELOG.md`, `speckit-extension/ROADMAP.md` | R001
  - **Do**: Add a CHANGELOG entry for full lifecycle capture + derive fallback. Flip ROADMAP step 2 from `◻ Planned` to `✅ Shipped` with a one-line summary.
  - **Verify**: ROADMAP table renders; step 2 row reflects shipped state.

- [x] **T006** Register commands + hooks *(depends on T002, T003)* — `speckit-extension/extension.yml` | R001, R002, R003
  - **Do**: Add the three new `provides.commands` entries (pointing at the T003 files) and the `after_plan`/`after_tasks`/`after_implement` hooks, each `optional: false`, alongside the existing `after_specify` hook.
  - **Verify**: YAML parses; each new hook references a declared command; `after_specify` is unchanged.
  - **Leverage**: existing `after_specify` block + `provides.commands` shape.

- [x] **T007** [P] Register companion in test fixture *(depends on T006)* — `.specify/extensions.yml` | R005
  - **Do**: Append `companion` entries (`enabled: true`, `optional: false`) under `after_plan`/`after_tasks`/`after_implement`, alongside the existing `git` commit hooks, mirroring the existing `after_specify` companion entry.
  - **Verify**: YAML parses; `git` entries intact; companion present under all four `after_*` events.
  - **Leverage**: the existing `after_specify` companion entry in the same file.

- [x] **T008** [P] Mirror installed companion fixture *(depends on T006)* — `.specify/extensions/companion/**` | R005
  - **Do**: Copy the updated `extension.yml`, `scripts/write-context.py`, the new `scripts/derive-from-files.py`, and the three new `commands/*.md` into `.specify/extensions/companion/` so the fixture is byte-identical to `speckit-extension/`.
  - **Verify**: `diff -r` between the relevant `speckit-extension/` files and `.specify/extensions/companion/` shows no differences.
  - **Leverage**: existing fixture layout under `.specify/extensions/companion/`.

- [x] **T009** Regression test suite *(depends on T002, T007, T008)* — `speckit-extension/tests/test_context.py` | R013, R014, R015
  - **Do**: stdlib `unittest` suite using a temp `specs/_zzz-*/`: append-only transitions, no-backward-clobber (earlier step rejected over later/terminal), unknown-key preservation, per-task idempotency, and a derive round-trip (delete state → `derive-from-files.py` → assert reconstructed step/status within one step; checked-all→implemented, partial→ready-to-implement).
  - **Verify**: `python3 -m unittest discover speckit-extension/tests` passes; no third-party imports.
  - **Leverage**: T001 writer, T002 derive; step-1 probe assertions in `specs/106-speckit-extension-foundation/tasks.md`.
