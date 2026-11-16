# Changelog — SpecKit Companion spec-kit Extension

All notable changes to the **spec-kit extension** (`id: companion`) are documented here.

> This is **not** the VS Code extension. The spec-kit extension is versioned independently (`extension.yml` `version`); the VS Code GUI's changelog lives at the repo root: [`../CHANGELOG.md`](../CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/); this extension follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Name the spec number yourself.** Say "spec 671" to auto or specify and the folder takes ==the number you named==. ([#1016](https://github.com/alfredoperez/speckit-companion/pull/1016)) <!-- area: pipeline -->

### Changed
- **Small waves stay with the main agent.** Foundational work goes to workers only across five files or more, ==two tasks each== at least. ([#1016](https://github.com/alfredoperez/speckit-companion/pull/1016)) <!-- area: pipeline -->
- **Commit prompts wait for converge.** Implement holds an optional commit or pull request hook until ==converge has finished== building. ([#1016](https://github.com/alfredoperez/speckit-companion/pull/1016)) <!-- area: pipeline -->

### Fixed
- **Runs work from a worktree.** Plan's readers read ==the checkout you are in==, and specify cuts no second branch when one exists. ([#1016](https://github.com/alfredoperez/speckit-companion/pull/1016)) <!-- area: pipeline -->
- **Receipts stay current after a changelog line.** A changelog edit after the checks ran ==keeps them current== in the pull request. ([#1016](https://github.com/alfredoperez/speckit-companion/pull/1016)) <!-- area: run-record -->
- **A finished spec reads Converge.** A spec that converge completed shows ==converge as its step==, even when converge built a task. ([#1016](https://github.com/alfredoperez/speckit-companion/pull/1016)) <!-- area: run-record -->
- **The plan check accepts files the plan creates.** Mark a new file once and ==every call path naming it== passes. ([#1016](https://github.com/alfredoperez/speckit-companion/pull/1016)) <!-- area: pipeline -->

## [0.27.0] - 2026-11-12

Hands-off runs cost less and finish at Completed, they also run on Spec Kit's workflow engine, and living specs are retired.

### Added
- **Hands-off runs on spec-kit's workflow engine.** `specify workflow run` routes on the recorded size, and ==each review gate resumes headless==. ([#1006](https://github.com/alfredoperez/speckit-companion/pull/1006)) <!-- area: pipeline -->
- **Corner cuts show up as concerns.** A skipped test, a suppression, an empty stub or a lower coverage bar is ==recorded with its file and line==, never blocking. ([#1005](https://github.com/alfredoperez/speckit-companion/pull/1005)) <!-- area: run-record -->
- **The doctor flags retired living-spec settings.** It prints ==one line== when a leftover living-specs setting is present, and notes a constitution that still names flow-back. ([#1008](https://github.com/alfredoperez/speckit-companion/pull/1008)) <!-- area: run-record -->

### Changed
- **Hands-off runs cost less.** An auto run makes ==fewer bookkeeping calls== and carries fewer instructions, closing the gap to stock on harder work. ([#1000](https://github.com/alfredoperez/speckit-companion/pull/1000)) <!-- area: pipeline -->
- **Size is decided before the spec.** A change you understand, with nothing risky in it, ==goes straight to implement== whatever its file count. ([#1000](https://github.com/alfredoperez/speckit-companion/pull/1000)) <!-- area: pipeline -->
- **Every requirement gets a test task.** The task list plans one test per requirement, checked ==through the screen or API== in the condition it names. ([#1000](https://github.com/alfredoperez/speckit-companion/pull/1000)) <!-- area: pipeline -->
- **No more checklist file.** Specify checks the spec once and fixes it in place, without writing ==checklists/requirements.md==. ([#1000](https://github.com/alfredoperez/speckit-companion/pull/1000)) <!-- area: pipeline -->
- **Task times come per wave.** A wave of tasks closes in one step, so the viewer shows ==one time per wave==. ([#1000](https://github.com/alfredoperez/speckit-companion/pull/1000)) <!-- area: run-record -->

### Removed
- **Living specs are retired.** The seven living commands left too, and ==each change keeps one folder==; the [loss list](https://github.com/alfredoperez/speckit-companion/blob/main/specs/669-retire-living-specs/loss-list.md) says what went. ([#1008](https://github.com/alfredoperez/speckit-companion/pull/1008)) <!-- area: living-specs -->

### Fixed
- **Receipts catch every code edit.** A check reads ==out of date== even when the edit lands in the same second as the commit. ([#1003](https://github.com/alfredoperez/speckit-companion/pull/1003)) <!-- area: run-record -->
- **Specs finish at Completed.** A run ==no longer stops at Implemented== when converge adds and builds work or closes without its hook. ([#1000](https://github.com/alfredoperez/speckit-companion/pull/1000)) <!-- area: pipeline -->

## [0.26.0] - 2026-11-08

Companion lines up with Spec Kit 1.2.5, and every spec records what was proven, assumed or only claimed.

### Added
- **Doctor checks agents and numbers; status is scripted.** It flags ==missing Companion commands==, a missing `specify` CLI and shared spec numbers, and status prints the record on any console. ([#951](https://github.com/alfredoperez/speckit-companion/pull/951), [#971](https://github.com/alfredoperez/speckit-companion/pull/971), [#975](https://github.com/alfredoperez/speckit-companion/pull/975)) <!-- area: install -->
- **A spec keeps its ticket, request and assumptions.** It keeps ==your request verbatim==, decision authors, assumptions, each check's commit, a risk tier, mutation results, and PR receipts. ([#945](https://github.com/alfredoperez/speckit-companion/pull/945), [#964](https://github.com/alfredoperez/speckit-companion/pull/964), [#965](https://github.com/alfredoperez/speckit-companion/pull/965), [#966](https://github.com/alfredoperez/speckit-companion/pull/966), [#967](https://github.com/alfredoperez/speckit-companion/pull/967), [#968](https://github.com/alfredoperez/speckit-companion/pull/968), [#969](https://github.com/alfredoperez/speckit-companion/pull/969)) <!-- area: run-record -->
- **Step times from the agent itself.** Typing a step command records its start, and a turn closes the step only when its document is really written. ([#939](https://github.com/alfredoperez/speckit-companion/pull/939)) <!-- area: run-record -->

### Changed
- **Only a clean converge completes a spec.** A converge that adds no task completes the spec, ==each pass records the tasks it added==, and auto stops after three. ([#940](https://github.com/alfredoperez/speckit-companion/pull/940), [#942](https://github.com/alfredoperez/speckit-companion/pull/942), [#944](https://github.com/alfredoperez/speckit-companion/pull/944)) <!-- area: pipeline -->
- **New specs are `spec.md`.** Companion writes new specs as `spec.md`, so stock converge, analyze and clarify find them, and older named specs still open. ([#941](https://github.com/alfredoperez/speckit-companion/pull/941)) <!-- area: pipeline -->

### Fixed
- **No stray `.gitignore` when the trace is ignored.** The run trace writes its per-spec `.gitignore` only when ==no existing git rule== covers `.trace.jsonl`, as its docstring said. ([#962](https://github.com/alfredoperez/speckit-companion/pull/962)) <!-- area: run-record -->
- **Two specs never share a number.** One step picks the next folder ==under a lock== and follows your `feature_numbering`, timestamp or sequential. ([#954](https://github.com/alfredoperez/speckit-companion/pull/954)) <!-- area: pipeline -->
- **Copilot gets the built pipeline.** A build refreshes the skills ==in `.github/skills/`== too, so Copilot runs the project's pipeline. ([#950](https://github.com/alfredoperez/speckit-companion/pull/950)) <!-- area: pipeline -->
- **Monorepo projects record their runs.** The writer finds the project ==the way Spec Kit does==, from the nearest `.specify/` up, and the feature pointer outranks the label. ([#949](https://github.com/alfredoperez/speckit-companion/pull/949)) <!-- area: run-record -->
- **Hook pages are one line each.** Each hook that records a plain spec-kit step runs one command, and a broken `.specify/extensions.yml` is reported, not skipped. ([#938](https://github.com/alfredoperez/speckit-companion/pull/938)) <!-- area: run-record -->
- **Your team's templates shape Companion runs too.** Template overrides and presets shape Companion runs on ==Spec Kit 1.2.5== or newer, without touching stock runs. ([#937](https://github.com/alfredoperez/speckit-companion/pull/937), [#980](https://github.com/alfredoperez/speckit-companion/pull/980)) <!-- area: pipeline -->
- **The run record stays whole.** A small spec's plan and tasks land in one write, a status never moves back, and a damaged record is ==kept aside==. ([#936](https://github.com/alfredoperez/speckit-companion/pull/936), [#970](https://github.com/alfredoperez/speckit-companion/pull/970)) <!-- area: run-record -->

