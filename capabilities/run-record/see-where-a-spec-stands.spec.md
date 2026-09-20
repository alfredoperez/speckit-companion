# See Where a Spec Stands — Living Spec

## Purpose

A person coming back to a spec, or an assistant asked to carry on, needs one answer: where is this spec and what comes next. The status and resume commands read the run record to give it, fall back to the files on disk when the record is missing or wrong, and the editor tidies a record that contradicts itself so every surface tells the same story.

## Requirements

### Status reports the step, the status, the decisions and the next action
<!-- touches: apps/speckit-extension/scripts/status-context.py, apps/speckit-extension/commands/speckit.companion.status.md -->

The status command SHALL print the spec's name, its current step and status, the decisions recorded so far, and the next action with the command that performs it. It resolves the spec the same way a capture does, and it never writes the record. Decisions recorded as plain text and as objects are both shown.

#### Scenario: no decisions were recorded
- **WHEN** status runs on a record without decisions
- **THEN** it prints `Decisions: (none recorded)`

#### Scenario: there is nothing to report
- **WHEN** the spec folder has no record and no spec, plan or tasks file
- **THEN** status says there is nothing to summarize and the command still succeeds

### A missing or broken record is read from the files instead
<!-- touches: apps/speckit-extension/scripts/status-context.py, apps/speckit-extension/scripts/derive-from-files.py -->

When the record is absent, unparseable or has no current step, the position SHALL be inferred from the spec folder: a spec file means `specify`/`specified`, a plan means `plan`/`planned`, a task list means `tasks`/`ready-to-implement`, and a task list with every task ticked means `implement`/`implemented`. The output is marked `source: derived`.

#### Scenario: hooks never fired
- **WHEN** a folder holds a spec and a plan but no record
- **THEN** status reports `plan` / `planned` with `source: derived`

### The files win when the record contradicts them
<!-- touches: apps/speckit-extension/scripts/status-context.py -->

When a record exists but names a step whose document is missing, or the folder holds a later document than the record knows about, status SHALL report the position the files show. A record that is merely further along within a step whose document exists is believed, because files cannot show work in progress.

#### Scenario: the record lags the files
- **WHEN** the record says `specify` and a task list exists
- **THEN** status reports `tasks` with `source: derived`

#### Scenario: implement is under way
- **WHEN** the record says `implementing` and the task list has unticked tasks
- **THEN** the record's position is kept

### The next action follows the spec's own workflow
<!-- touches: apps/speckit-extension/scripts/status-context.py -->

The next action SHALL be: the next step's command when the current step is finished, the current step's command when it is still in progress, the next unticked task when inside implement, and "Pipeline complete" when the spec is `implemented`, `completed` or `archived` or has no tasks left. The command offered belongs to the workflow the record names, so a Companion spec continues on Companion commands and a stock spec on stock ones.

#### Scenario: a Companion spec finished planning
- **WHEN** the record has `workflow: companion` and status `planned`
- **THEN** the next command is the Companion tasks command

### Resume dispatches the next command and carries the decisions along
<!-- touches: apps/speckit-extension/commands/speckit.companion.resume.md, apps/speckit-extension/scripts/status-context.py -->

Resume SHALL read the same position status reports, taken from the machine-readable line status prints last, and dispatch the next command with the recorded decisions stated as in-scope context. Inside implement it continues at the next unticked task. Resume writes nothing itself: the dispatched command's own capture records what happens.

#### Scenario: the pipeline is already complete
- **WHEN** the resolution says the spec is complete, or that there is nothing on disk
- **THEN** resume says so and dispatches nothing

### A record can be rebuilt from the files
<!-- touches: apps/speckit-extension/scripts/derive-from-files.py -->

A record SHALL be reconstructable from the spec folder when hooks never ran: the inferred step and status are written, entries are stamped `by: derive`, and every ticked task gets a finish entry. Rebuilding never moves a spec backward and running it twice adds nothing.

#### Scenario: the record is already further along
- **WHEN** a rebuild infers `plan` for a spec recorded at `implement`
- **THEN** nothing is written

### The editor repairs a record that contradicts itself
<!-- touches: apps/vscode/src/features/specs/specContextReconciler.ts -->

On reading a record the editor SHALL repair an unrecognised status from what history shows, move `currentStep` back to the step that owns a completed status, and settle a lagging in-progress status once history shows the step complete. It never does that last step for implement, where finishing stays a deliberate action, and it never invents history entries. When `currentStep` does not match the last history entry it logs a warning instead.

#### Scenario: a record claims planning began when only specify ran
- **WHEN** a record reads `currentStep: plan` with `status: specified`
- **THEN** `currentStep` is set back to `specify`

### Records written by older versions still open
<!-- touches: apps/vscode/src/features/specs/specContextReader.ts, apps/speckit-extension/scripts/spec_context.py -->

Readers SHALL accept older shapes: a `transitions` log in place of `history`, entries with no `kind` (inferred from their legacy `from` field), the statuses `active` and `tasks-done`, a file holding only a status, and the retired `profile: turbo` as meaning the Companion workflow. One unreadable record SHALL NOT stop the editor from listing the other specs.

#### Scenario: a record holds only a status
- **WHEN** the file is `{ "status": "completed" }`
- **THEN** it loads as a completed spec with an empty history

#### Scenario: one record in the workspace is corrupt
- **WHEN** the spec list renders and one record does not parse
- **THEN** that spec shows without run data and the rest render normally
