# Feature Specification: Close the implement step when all tasks are checked

## Overview

A spec driven through specify → plan → tasks → implement finishes writing code but its status stays `implementing` forever, because the closing implement transition is never recorded in `.spec-context.json` `history[]`. This feature makes the always-on extension write the terminal `implemented` status (and a closing step-level implement transition) the moment a spec's `tasks.md` reaches 100% completion, independent of which driving mode (stock, companion-logging, companion-standard, companion-turbo, companion-fast-path) produced the run.

## Functional Requirements

- **FR-001** The extension MUST record a closing implement transition into `.spec-context.json` `history[]` when a watched `tasks.md` transitions to all-tasks-checked, so the derived viewer state advances off `implementing`.
- **FR-002** The terminal status written MUST be `implemented` — never `completed` (the `completed` gate stays a user Mark-Completed action).
- **FR-003** The closing transition MUST be a step-level implement complete entry (`step: "implement"`, `substep: null`, no `task`, `kind: "complete"`), so `deriveStepHistory` reads the implement step as completed.
- **FR-004** The close MUST fire regardless of driving mode — it MUST NOT depend on a companion hook, preset, or a terminal-close event. It triggers off the always-on `tasks.md` file watcher that runs for every mode.
- **FR-005** The close MUST be idempotent: a `tasks.md` saved again while already at 100% MUST NOT append a second closing transition nor regress an already-terminal spec.
- **FR-006** A genuinely mid-flight spec (any task still unchecked) MUST NOT be closed — its status stays in-progress (`implementing` / the prior step status).
- **FR-007** A spec already in a terminal status (`implemented`, `completed`, `archived`) MUST NOT be re-closed or dragged backward by a later `tasks.md` save.
- **FR-008** Fast-path's deliberate pause at `tasks` / `ready-to-implement` MUST be preserved — a fast-path spec that has not yet started implement (no implement step in `history[]`, status not `implementing`) MUST NOT be auto-closed when its `tasks.md` already has all boxes checked; the close only applies to a spec whose implement step is underway.
- **FR-009** A `tasks.md` with zero task markers MUST NOT trigger a close (0/0 is not "all done").
- **FR-010** The auto-close MUST be best-effort: a write failure MUST be logged-and-swallowed and MUST NOT block the watcher or other extension behavior.

## Success Criteria

- **SC-001** After implement finishes with every task checked, the spec's `status` reads `implemented` and `history[]` contains exactly one step-level implement complete entry — verifiable in 100% of completed runs across all five driving modes.
- **SC-002** Re-saving a fully-checked `tasks.md` adds zero additional `history[]` entries (idempotent).
- **SC-003** A `tasks.md` with at least one unchecked task leaves the spec status unchanged (no false close) in 100% of cases.
- **SC-004** A fast-path spec paused at `ready-to-implement` with a fully-checked `tasks.md` but no implement underway is not auto-closed.
- **SC-005** All existing compile, unit-test, capture-eval, and shape-parity checks remain green.

## Assumptions

- The shared, mode-agnostic surface is the always-on `tasks.md` file watcher (`setupTasksWatcher`), which already parses task completion for every spec regardless of preset.
- "Implement is underway" is detected from the spec's recorded state: `currentStep === "implement"` OR `status === "implementing"` OR an implement entry already exists in `history[]`. This distinguishes a real implement run from a fast-path spec parked at `ready-to-implement`.
- The terminal write reuses the existing `completeStep(specDir, "implement", "extension")` lifecycle helper, which already writes the step-level complete entry and derives the `implemented` status — so the close shares one code path with the terminal-close tracker and the Python hook.
- Idempotency and no-backward-clobber are enforced by checking the recorded history/status before writing (the same guards the existing lifecycle writer relies on).
