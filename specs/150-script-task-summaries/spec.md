# Feature Specification: Script-written task_summaries + live implement percentage label

**Feature Branch**: `150-script-task-summaries`
**Created**: 2026-06-11
**Status**: Draft
**Input**: GitHub issue #256 — Capture: write task_summaries from the script + live implement %

## Overview

The spec-viewer Activity panel's Tasks card lists per-task summaries by reading the
`task_summaries` map from a spec's `.spec-context.json`
(`stateDerivation.ts` → `pickRecord('task_summaries')` → `TasksCard`). Today that map
is **hand-authored by the assistant editing `.spec-context.json`** during implement.
Turbo runs invoke `write-context.py --task <id> --kind complete`, which only appends a
**history finish event** (`journal_task_finish`) — it never writes `task_summaries`. So
when the assistant skips the manual edit (as recent turbo runs did), the field is absent
and the panel shows no tasks for that spec (specs 143–147), while a spec whose summaries
were authored by hand (spec 138) lists them.

Separately, the implement step's `NN%` pill (`StepTab.tsx`) is computed live from
counting `- [x]` checkboxes in `tasks.md` (`phaseCalculation.ts` `calculateTaskCompletion`,
file-watched) — it is independent of capture. It currently renders as a fixed-color
purple badge that does not communicate progress toward completion by color.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tasks appear in the Activity panel for turbo runs (Priority: P1)

As a developer running a spec through the turbo implement pipeline, I want each finished
task to show up in the Activity panel's Tasks card, so that I can see what was done
without hand-authoring `task_summaries`.

**Why this priority**: This is the core defect — recent specs show an empty Tasks panel.
Writing `task_summaries` from the same script call that already journals the finish makes
the panel reliable regardless of assistant behavior.

**Independent Test**: Run `write-context.py --task T001 --kind complete --did "..." --files "a.ts,b.ts"`
against a fresh feature dir and confirm `.spec-context.json` gains a `task_summaries.T001`
entry of shape `{status, did, files}` AND a history finish event for T001.

**Acceptance Scenarios**:

1. **Given** a feature dir with no `task_summaries`, **When** the script runs with
   `--task T001 --kind complete --did "Added X" --files "src/a.ts,src/b.ts"`, **Then**
   `.spec-context.json` has `task_summaries.T001 = {status: "DONE", did: "Added X", files: ["src/a.ts","src/b.ts"]}`
   and a single history finish entry `{step:"implement", task:"T001", kind:"complete"}`.
2. **Given** `task_summaries.T001` already exists, **When** the same task is journaled
   again, **Then** the history finish stays single (idempotent) and the summary is not
   duplicated into a second key.
3. **Given** a turbo spec run to completion, **When** the Activity panel renders, **Then**
   the Tasks card lists every task (parity with spec 138).

### User Story 2 - Implement percentage communicates progress by color (Priority: P2)

As a developer watching the implement step run, I want the live percentage label to shift
color toward a success/goal color as it nears 100%, so that progress is legible at a glance.

**Why this priority**: A purely numeric pill is harder to read at a glance; a color ramp
makes "almost done" visible. The percentage is already live and file-watched, so this is a
presentation change only.

**Independent Test**: Render the implement StepTab at 10%, 50%, and 95% completion and
confirm the label color ramps from the in-progress color toward the success color.

**Acceptance Scenarios**:

1. **Given** implement is in flight at 20%, **When** the tab renders, **Then** the
   percentage label reads `20%` in a low-progress color.
2. **Given** `tasks.md` boxes are checked to 95%, **When** the file watcher fires, **Then**
   the label advances to `95%` and its color has shifted toward the success/goal color.
3. **Given** the percentage advances live, **Then** no capture/`.spec-context.json` write is
   required for the label to update (it reads `tasks.md` directly).

## Requirements *(mandatory)*

- **FR-001**: `write-context.py` MUST accept `--did <text>` and `--files <comma-list>` and,
  when invoked with `--task <id> --kind complete`, write a `task_summaries.<id>` entry of
  shape `{ "status": "DONE", "did"?: <text>, "files"?: [<paths>] }` matching the
  `TaskSummary` type the Activity panel reader consumes.
- **FR-002**: The same call MUST still append the existing history finish event
  (`journal_task_finish` behavior), with no regression to idempotency, the
  cross-step-terminal guard, or `currentTask`/`status` bookkeeping.
- **FR-003**: Writing `task_summaries` MUST be idempotent and non-destructive: re-journaling
  a task updates its single keyed entry (no duplicate keys), and unknown/other
  `task_summaries` keys are preserved.
- **FR-004**: The implement command body (the shared timing partial embedded verbatim in all
  command bodies) MUST instruct the assistant to journal each task via the script flag
  (`--task --did --files`) the moment it finishes — one call per task, NOT a hand-authored
  `task_summaries` edit and NOT a batched end-of-step dump.
- **FR-005**: The implement `NN%` label MUST be a right-aligned label whose color shifts
  toward the success/goal color as it approaches 100%, driven by the live
  `taskCompletionPercent` already computed from `tasks.md`.

## Success Criteria *(mandatory)*

- **SC-001**: A new spec run through implement journals each task into `task_summaries` via
  the script; the Activity panel lists the tasks (parity with spec 138).
- **SC-002**: The implement step shows a live percentage label that advances as `tasks.md`
  boxes are checked, with color shifting toward the goal color.
- **SC-003**: No regression to the history `finish` events or the `implemented` close (#244);
  `check-shape-parity.py` and the Python lifecycle tests pass.
