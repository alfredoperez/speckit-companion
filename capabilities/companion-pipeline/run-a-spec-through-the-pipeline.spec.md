# Run a spec through the pipeline: Living Spec

## Purpose

A person describes a change and the Companion commands carry it from spec to finished code: specify, plan, tasks, implement, completed. Without this the steps would not know what each other wrote, a run could land on top of finished work, and nothing would say when a spec is done.

## Requirements

### A new run gets a spec folder of its own
<!-- touches: apps/speckit-extension/nodes/specify/resolve-dir*.md, apps/speckit-extension/nodes/auto/resolve-dir.md -->

`speckit.companion.specify` and `speckit.companion.auto` SHALL start new work in the next numbered folder under `specs/`, or in the folder the request names, and point `.specify/feature.json` at it. They SHALL never write into a folder that already holds a feature spec. The later steps work on the folder they are given, or the one `.specify/feature.json` names.

#### Scenario: the pointer still names the last spec
- **WHEN** specify starts and `.specify/feature.json` points at a finished spec
- **THEN** a new `specs/<NNN+1>-<short-name>/` folder is created, the pointer is rewritten to it, and the finished spec is untouched

#### Scenario: the branch variant is in use
- **WHEN** the project runs the variant that puts each spec on a branch and a teammate's remote branch already holds the next number
- **THEN** the run numbers past it, checks out `<NNN>-<short-name>`, and stops instead of carrying uncommitted changes onto the new branch

### Each step writes its own documents and nothing of the next step's
<!-- touches: apps/speckit-extension/nodes/specify/draft-spec*.md, apps/speckit-extension/nodes/specify/quality-checklist*.md, apps/speckit-extension/nodes/plan/**, apps/speckit-extension/nodes/tasks/tasks-doc.md, apps/speckit-extension/nodes/implement/implement-exec.md -->

Specify SHALL write `<short-name>.spec.md` and `checklists/requirements.md`. Plan SHALL write `plan.md` plus `research.md`, `data-model.md` and `contracts/` as the size warrants. Tasks SHALL write `tasks.md`, and implement SHALL build the code and check the tasks off. An exact value the request pins (a route, a test id, a flag, UI copy) SHALL be recorded verbatim in the spec and copied unchanged into the contracts and the code.

#### Scenario: the request pins an identifier
- **WHEN** the description says the button must carry `data-testid="save-draft"`
- **THEN** the spec lists that string under Verbatim Constraints and the plan's contract uses it character for character

#### Scenario: the spec is still ambiguous after one pass
- **WHEN** the quality checklist finds an ambiguity only the developer can settle
- **THEN** the spec keeps at most three `[NEEDS CLARIFICATION: …]` markers and the step finishes without an interactive loop, unless the project chose the blocking checklist, which asks and waits

### Each step names its successor and continues when the host allows
<!-- touches: apps/speckit-extension/nodes/*/handoff.md, apps/speckit-extension/presets/_parts/self-advance.md, apps/speckit-extension/presets/_parts/command-spelling.md -->

The order is fixed: specify, plan, tasks, implement. On a host that keeps acting after a step ends, a step SHALL dispatch the next `speckit.companion.*` command itself, spelled the way the host registered it, and a Companion run SHALL keep dispatching Companion commands instead of the stock ones. On a host that runs one step and stops, the step SHALL finish, leave the run resumable, and the developer triggers the next step.

#### Scenario: an agentic CLI finishes plan
- **WHEN** plan completes on a host that keeps working
- **THEN** it dispatches `speckit.companion.tasks <feature_dir>` in the host's own spelling, for example `/speckit-companion-tasks` on Claude Code

#### Scenario: a one-shot terminal finishes plan
- **WHEN** plan completes on a host that stops after one command
- **THEN** nothing is dispatched, no error is raised, and the next step can be started by hand

### A gated run stops for approval before plan and before tasks
<!-- touches: apps/speckit-extension/workflows/speckit-companion.workflow.yml, apps/speckit-extension/presets/_parts/self-advance.md -->

Run as the `speckit-companion` workflow, or self-advancing on an agentic host, the pipeline SHALL pause at a review gate after specify and after plan, and SHALL name the literal command that continues. A rejected gate aborts the run. Nothing pauses between tasks and implement, and a change sized small enough is not gated at all.

#### Scenario: the spec is approved
- **WHEN** the run stops at the spec review gate and the developer approves
- **THEN** plan runs next

#### Scenario: the plan is rejected
- **WHEN** the developer rejects at the plan review gate
- **THEN** the run aborts and no tasks are generated

### Auto runs every step with no pauses
<!-- touches: apps/speckit-extension/nodes/auto/**, apps/speckit-extension/presets/_parts/unattended.md -->

`speckit.companion.auto` SHALL run specify, plan, tasks and implement in order by invoking the real per-step commands, so an auto run produces the same documents as a manual one. It SHALL mark the run `unattended`, and at every review gate or project checkpoint hook it records the checkpoint and continues instead of asking. Background, review and PR hooks still run.

#### Scenario: a checkpoint hook would normally ask
- **WHEN** a project hook says "Continue / Fix / Stop" and the run is unattended
- **THEN** the checkpoint is recorded and the run continues without a prompt

#### Scenario: the host cannot chain commands
- **WHEN** auto runs on a one-shot terminal
- **THEN** the first step runs, its progress is recorded, and the run stops without error for the developer to continue step by step

### Implement runs the project's checks and finishes the spec
<!-- touches: apps/speckit-extension/nodes/implement/implement-exec.md, apps/speckit-extension/nodes/implement/record-verified.md, apps/speckit-extension/nodes/implement/complete.md, apps/speckit-extension/commands/speckit.companion.mark-complete.md -->

Before it calls the work done, implement SHALL run the test, type-check or build commands the project itself defines, and a failing test the change wrote or invalidated is part of the change. When every task is checked and the checks pass, implement SHALL move the spec to `completed` itself, so nothing follows implement. A spec SHALL NOT be completed over a failing suite the run introduced, and checks that could not be run are recorded as a concern so the spec reads as finished and unverified.

#### Scenario: the run broke an existing test
- **WHEN** the suite fails on a test the change invalidated
- **THEN** the test is fixed in this run, or the spec stays at `implemented` with the reason stated

#### Scenario: the project has no test command
- **WHEN** no runnable check exists
- **THEN** the summary says so, a concern is recorded, and no check is reported as passed

### Completion has one writer and refuses unfinished work
<!-- touches: apps/speckit-extension/commands/speckit.companion.mark-complete.md, apps/speckit-extension/nodes/implement/complete.md, apps/speckit-extension/workflows/speckit-companion.workflow.yml -->

`completed` SHALL be written only through the mark-complete path, which implement's last step and `speckit.companion.mark-complete` share. It SHALL refuse unless the spec is `implemented`, or `implementing` with every task checked, and SHALL leave an already completed or archived spec untouched. `speckit.companion.mark-complete` is the workflow engine's terminal step and the manual recovery command, never a step a run adds for itself.

#### Scenario: tasks are still open
- **WHEN** mark-complete runs on a spec with unchecked tasks
- **THEN** it refuses, reports why, and the status does not change

#### Scenario: it runs twice
- **WHEN** the workflow engine calls mark-complete after implement already completed the spec
- **THEN** nothing changes and the command exits successfully

### Stock spec-kit keeps working beside Companion
<!-- touches: apps/speckit-extension/presets/_parts/speckit-hooks.md, apps/speckit-extension/presets/companion-standard/**, apps/speckit-extension/extension.yml -->

A Companion step SHALL fire the `before_<step>` and `after_<step>` hooks other spec-kit extensions registered in `.specify/extensions.yml`, in the stock output format, skipping disabled hooks, hooks with a condition, and Companion's own capture hooks. A missing or unreadable registry is skipped silently. The stock `/speckit.*` commands stay installed with their stock sections and files, and the `companion-standard` preset adds only timing capture to seven of them.

#### Scenario: the git extension is installed
- **WHEN** `speckit.companion.specify` runs in a project where the git extension registers a `before_specify` hook
- **THEN** that hook is emitted before the spec is drafted, exactly as it would be on a stock `/speckit.specify` run

#### Scenario: Companion's own hook is in the registry
- **WHEN** `.specify/extensions.yml` lists the `companion` extension's `after_plan` hook
- **THEN** a Companion plan run skips it, because the step records its own lifecycle

### A step degrades instead of failing the developer's command
<!-- touches: apps/speckit-extension/presets/_parts/orchestrator.md, apps/speckit-extension/presets/_parts/speckit-hooks.md, apps/speckit-extension/scripts/dispatch-briefs.py, apps/speckit-extension/nodes/**, apps/speckit-extension/commands/speckit.companion.mark-complete.md -->

Everything a step does to record, size, dispatch or hook the run SHALL be best-effort: a missing interpreter, an unreadable configuration or a helper that errors is skipped or warned about once, and the step still does its own work and produces its documents. Only the work the developer asked for can fail a step.

#### Scenario: the project has no Python available
- **WHEN** a step tries to record what it just did
- **THEN** it warns and carries on, and the spec, plan or code it was asked for is still written

#### Scenario: a helper throws
- **WHEN** the fan-out helper cannot read the run record
- **THEN** the step continues and does the work itself

## Uncovered

- `clarify` and `analyze` have no Companion command. The handoff text mentions them and the preset overrides the stock ones, but nothing in the Companion order dispatches them.
- The workflow file and the self-advance text both describe the review gates. Which one is the authority when they disagree is not written down.
