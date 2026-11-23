# Changelog — SpecKit Companion spec-kit Extension

All notable changes to the **spec-kit extension** (`id: companion`) are documented here.

> This is **not** the VS Code extension. The spec-kit extension is versioned independently (`extension.yml` `version`); the VS Code GUI's changelog lives at the repo root: [`../CHANGELOG.md`](../CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/); this extension follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Bug runs typed in chat leave a record.** Assess, fix and test each record ==their start, finish and outcome== in the bug's own folder. ([#1023](https://github.com/alfredoperez/speckit-companion/pull/1023)) <!-- area: run-record -->
- **Doctor checks plugin freshness.** It flags each Claude Code plugin your Companion config or project nodes call that is ==behind its marketplace==, naming both versions. ([#1004](https://github.com/alfredoperez/speckit-companion/pull/1004)) <!-- area: install -->

### Changed
- **Plan writes only the design docs needed.** A data model is written only for ==a new entity==, and contracts only for a new or changed API. ([#1004](https://github.com/alfredoperez/speckit-companion/pull/1004)) <!-- area: pipeline -->

### Fixed
- **Wave times stay honest when tasks close late.** Tasks closed together share ==one time== instead of each showing zero, and each close names the next wave to close. ([#1019](https://github.com/alfredoperez/speckit-companion/issues/1019)) <!-- area: run-record -->

## [0.28.0] - 2026-11-17

Runs work from a worktree, take the spec number you name, and keep small waves with the main agent.

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
