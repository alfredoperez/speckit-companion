# Record a Run — Living Spec

## Purpose

Every spec folder carries one file, `.spec-context.json`, that says what happened while the spec was built: which steps ran and when, which tasks finished, what was decided, checked and worried about. The sidebar, the viewer, the status commands and outside tools all read it, so its shape is a contract and not an implementation detail.

## Requirements

### Each spec folder holds one run record with a fixed core
<!-- touches: apps/vscode/src/core/types/**, apps/speckit-extension/scripts/spec_context.py -->

The run record SHALL be the file `.spec-context.json` in the spec's own folder, and it SHALL always carry `workflow`, `specName`, `branch`, `currentStep`, `status` and `history`. Any other top-level key is allowed and readers SHALL tolerate keys they do not know. `workflow` defaults to `speckit`, and `specName` comes from the spec's title, falling back to a readable form of the folder name.

#### Scenario: the first write lands before the spec has a real title
- **WHEN** a record is first written while the spec still carries the template's placeholder title
- **THEN** the folder-derived name is recorded, and a later write replaces it with the real title once one exists

#### Scenario: someone renamed the spec by hand
- **WHEN** the recorded name is neither a placeholder nor the folder-derived fallback
- **THEN** later writes leave it alone

### History is a log of step and task boundaries
<!-- touches: apps/vscode/src/core/types/**, apps/speckit-extension/scripts/spec_context.py, apps/speckit-extension/scripts/write-context.py, apps/speckit-extension/presets/_parts/timing.md -->

`history` SHALL be a list of entries, each with `step`, `substep` (or null), `kind` (`start` or `complete`), `by` (`extension`, `user`, `cli`, `ai` or `derive`) and `at` (a UTC timestamp), plus `task` on a per-task entry. A given step or substep SHALL be started once and completed once: a repeated start or complete for the same boundary adds nothing. A step SHALL close itself as its last action rather than leaving that to the hook that follows it, because on a provider that can only print the hook for the person to run, a step waiting on it sits open with its next step unreachable.

#### Scenario: the hook after a step is printed instead of run
- **WHEN** a step records its own finish and the editor, the command body or a hook later records the same boundary
- **THEN** history holds one finish, and the run moves on whether or not the hook was ever dispatched

#### Scenario: a task finish is not a step finish
- **WHEN** the first implement task is recorded as complete
- **THEN** the implement step itself still counts as open until its own step-level complete is written

### Step and status move together along one vocabulary
<!-- touches: apps/vscode/src/core/types/**, apps/speckit-extension/scripts/spec_context.py, apps/speckit-extension/scripts/write-context.py -->

`currentStep` SHALL be one of `specify`, `clarify`, `plan`, `tasks`, `analyze`, `implement`, and `status` one of `draft`, `specifying`, `specified`, `planning`, `planned`, `tasking`, `ready-to-implement`, `implementing`, `implemented`, `completed`, `archived`. Finishing a step SHALL set the status that step owns (`specified`, `planned`, `ready-to-implement`, `implemented`); `clarify` and `analyze` record only their finish. Starting a step moves `currentStep` and leaves `status` alone unless the caller names one. A finished spec is expressed in `status`, never as a `currentStep` of `done`.

#### Scenario: a project adds its own step
- **WHEN** a project declares an extra step and a run records its start and finish
- **THEN** both boundaries are journaled and the spec's status is left as it was

#### Scenario: a step name is misspelled
- **WHEN** a capture names a step the project does not have
- **THEN** nothing is written and the message lists the steps that exist

### Each implement task gets one finish entry and a summary
<!-- touches: apps/speckit-extension/scripts/task_sync.py, apps/speckit-extension/commands/speckit.companion.after-implement.md -->

A finished task SHALL be recorded as a single `complete` entry carrying the task id, with an optional one-line summary and file list under `task_summaries.<id>`, and its checkbox in `tasks.md` SHALL be ticked by the recorder. The implement step closes only when every task is both ticked and journaled. After implement, the record is synced from `tasks.md`: every ticked task without an entry gets one, and status lands on `implemented` when all are ticked, otherwise `implementing`.

#### Scenario: a task was ticked but never journaled
- **WHEN** the after-implement sync runs over a `tasks.md` with ticked tasks missing from history
- **THEN** each gets a finish entry, and tasks already journaled are skipped

#### Scenario: a checkbox sits inside a code fence
- **WHEN** `tasks.md` shows checkbox syntax inside a fenced block
- **THEN** it is not counted as a task

### What the run decided, checked and worried about is kept beside the log
<!-- touches: apps/speckit-extension/scripts/capture.py, apps/vscode/src/core/types/** -->

The record SHALL accept `decisions`, `verified`, `concerns`, `expectations`, `context`, `coverage` per requirement, `step_summaries` per step and a size `classification`. Entries may be plain text or objects (`decision`/`why`/`rejected`, `what`/`result`/`command`, `note`/`step`/`kind`). These writes are additive and de-duplicated, so recording the same thing twice leaves one entry, and a coverage or summary update replaces only the parts it supplies.

#### Scenario: a step is re-run
- **WHEN** the same decision text is captured again
- **THEN** `decisions` still holds it once

#### Scenario: a classification carries an unknown verdict
- **WHEN** a classification is submitted with a verdict other than `simple`, `normal` or `oversized`
- **THEN** the call is rejected as a caller error and nothing is written

### A verification can be run rather than claimed
<!-- touches: apps/speckit-extension/scripts/capture.py -->

The recorder SHALL be able to run a named check itself and store what happened: the exit code, the duration, the last few lines of output, and a marker that the outcome was derived. A verification entry without that marker means the agent said so.

#### Scenario: the check fails
- **WHEN** a run-and-record verification exits non-zero
- **THEN** the entry is still written, with the failing exit code

### Timestamps say when the write happened
<!-- touches: apps/speckit-extension/scripts/write-context.py, apps/vscode/src/core/types/** -->

Every boundary SHALL be stamped with the clock at the moment it is written, and a caller that supplies its own time for a finish, a task close or a mark-complete SHALL be refused with nothing written. The one exception is a step start whose dispatch time the dispatcher already knows, which may be supplied. A step's duration counts as trustworthy only when both its start and its finish were stamped by a writer whose clock the run trusts, and the writer that closed the step is trusted at least as far as the one that opened it, so a hand-typed time can never become a measurement and a less trusted hand can never declare an earlier writer's step over.

#### Scenario: an assistant runs a step end to end
- **WHEN** an assistant stamps both the start and the finish of a step through the recorder
- **THEN** the duration is shown as measured, because nothing more trusted was waiting to close it

#### Scenario: an assistant closes a step the editor opened
- **WHEN** the editor stamps a step's start and an assistant stamps its finish
- **THEN** the span is not offered as a measurement, because a finish claimed early would read as a real duration

### A capture finds its spec, or skips without failing the command
<!-- touches: apps/speckit-extension/scripts/spec_context.py, apps/speckit-extension/scripts/write-context.py, apps/speckit-extension/commands/speckit.companion.after-*.md -->

A capture SHALL write to the spec the command is actually working on: the folder it was handed, else the one the environment or the project's active-feature pointer names, else the one the branch's number identifies. It never guesses from the most recently changed folder. When no spec resolves, Python is missing, or the write fails, the capture SHALL warn and let the host command succeed, because a recording problem must never break the person's pipeline.

#### Scenario: the pointer names a folder that is gone
- **WHEN** the active-feature pointer names a directory that no longer exists
- **THEN** the capture says the pointer is stale and falls back to the branch

#### Scenario: a task sync names one spec while the active pointer names another
- **WHEN** a tasks file and an explicit feature directory disagree
- **THEN** nothing is written and the mismatch is reported
