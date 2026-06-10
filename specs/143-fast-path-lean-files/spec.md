# Fast-path lean files — reconcile file-driven views (#237)

## Overview

After a fast-tracked ("simple") turbo spec, plan and tasks content is folded into `spec.md` and recorded in history as `substep: fast-path`, but no `plan.md` / `tasks.md` files are written. The top stepper and the sidebar key off file presence, so they read "Plan not created" / "Tasks 0% / not created" even though the history-driven panels correctly show the fast-path fold. This change makes the simple-mode command pass emit two lightweight files — a `plan.md` pointer to the spec's Approach and a `tasks.md` carrying the real task checklist — so the file-driven and history-driven views agree, and implement progress reflects the real task count.

## Functional Requirements

- **FR-001**: The `simple`-mode branch MUST write `<feature_directory>/plan.md` as a short pointer to the `spec.md` **Approach** section (the approach content lives in `spec.md`; `plan.md` references it rather than duplicating it).
- **FR-002**: The `simple`-mode branch MUST write `<feature_directory>/tasks.md` containing the real, dependency-ordered task checklist as `- [ ] **T001** [P?] <description> + <path>` lines — not a pointer — so implement progress counts the actual tasks.
- **FR-003**: The task checklist MUST live only in `tasks.md`; `spec.md` MUST NOT carry a second copy of the `Implementation Tasks` list, to avoid drift. `spec.md` retains its **Approach** section (the plan source-of-truth that `plan.md` points to).
- **FR-004**: The lifecycle fold MUST stay unchanged — the four `--substep fast-path` `write-context.py` calls (plan start/complete, tasks start/complete with `--status ready-to-implement`) still run, in order, after the specify completion.
- **FR-005**: The edit MUST be applied identically to both `speckit-extension/commands/speckit.companion.specify.md` and `speckit-extension/presets/companion-turbo/commands/speckit.specify.md` so `check-shape-parity.py` stays green.
- **FR-006**: A `normal` (non-fast-tracked) spec MUST be unchanged — its specify run still writes `spec.md` only, with no Approach / Implementation Tasks / lifecycle fold, and plan/tasks come from their own command runs.
- **FR-007**: The classification / lifecycle-fold contract docs (`docs/template-profiles.md`, and any companion contract text) MUST describe the new simple-mode output as three lean files (`spec.md` + `plan.md` pointer + `tasks.md`) rather than a single combined `spec.md`.

## Success Criteria

- **SC-001**: After a fast-tracked spec, the plan and tasks steps read done / fast-tracked in both the top stepper and the sidebar — zero "not created" labels.
- **SC-002**: Implement progress shows the real number of tasks (N of N), never 0 of 0, for a fast-tracked spec with N tasks.
- **SC-003**: Opening `plan.md` shows the approach pointer and opening `tasks.md` shows the task list — neither is a dead link.
- **SC-004**: `python3 speckit-extension/scripts/check-shape-parity.py` exits 0 (both command bodies identical).
- **SC-005**: A normal spec's specify output is byte-for-byte the same as before this change (single `spec.md`, four sections, no fold).
- **SC-006**: `npm run compile` is clean and `npm test` is green.

## Assumptions

- `plan.md` as a pointer is acceptable because plan content carries no progress metric; `tasks.md` must be the real checklist because implement progress counts checkboxes (a pointer would read 0/0).
- The Approach content remains authored into `spec.md` (the human-readable spec stays complete); `plan.md` is a thin pointer to that section, matching the issue's decided approach.
- The viewer code (`phaseCalculation.ts`, sidebar) needs no change — it already derives plan/tasks state from `doc.exists`; writing the files is sufficient to reconcile.
- `derive-from-files.py` already keys off file presence and `parse_task_markers`, so it benefits automatically once the files exist — no script change required.

## Approach

Files to touch (the plan content, inline — `plan.md` points here):

- `speckit-extension/commands/speckit.companion.specify.md` — rewrite the `simple`-mode branch (step 6) so it writes three lean files: keep an **Approach** section in `spec.md`, add a `plan.md` pointer to that Approach, and move the **Implementation Tasks** checklist into a real `tasks.md`. Update the step-6 prose, the **Output** line, and the lifecycle-fold preamble to describe the 3-file shape.
- `speckit-extension/presets/companion-turbo/commands/speckit.specify.md` — apply the identical edit (parity twin). Bodies must stay byte-identical below the frontmatter.
- `docs/template-profiles.md` — update the turbo-folder line and the **Complexity fast-path** `simple`-mode description from "combined single `spec.md`" to "three lean files: `spec.md` (Approach kept) + `plan.md` pointer + `tasks.md` checklist".
- `docs/capture-and-timing.md` — touch the fast-path note if it asserts the single-combined-`spec.md` shape, so the contract text matches.

Dependencies / notes:

- No TypeScript or webview change — the file-driven stepper/sidebar (`phaseCalculation.ts`) already derives plan/tasks state from `doc.exists`; writing the files reconciles the views with zero viewer code.
- The lifecycle fold (four `--substep fast-path` `write-context.py` calls, last carrying `--status ready-to-implement`) is unchanged.
- The task checklist lives only in `tasks.md` (not duplicated in `spec.md`) to avoid drift; `spec.md` keeps the Approach as the plan source-of-truth.
- Verify with `check-shape-parity.py`, `npm run compile`, `npm test`.
