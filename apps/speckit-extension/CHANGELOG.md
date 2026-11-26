# Changelog — SpecKit Companion spec-kit Extension

All notable changes to the **spec-kit extension** (`id: companion`) are documented here.

> This is **not** the VS Code extension. The spec-kit extension is versioned independently (`extension.yml` `version`); the VS Code GUI's changelog lives at the repo root: [`../CHANGELOG.md`](../CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/); this extension follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Hooks record when they run.** The builder shows ==each hook's last run== and flags a skill hook that points at a skill you don't have. ([#1069](https://github.com/alfredoperez/speckit-companion/pull/1069)) <!-- area: pipeline-builder -->

## [0.29.0] - 2026-11-24

Amend a spec after work starts, settle open questions before plan, and have implement check every requirement.

### Added
- **Amend a spec after work has started.** The amend command edits the spec in place, records the change, and ==replans only when requirements changed==. ([#1042](https://github.com/alfredoperez/speckit-companion/pull/1042)) <!-- area: pipeline -->
- **Bug runs typed in chat leave a record.** Assess, fix and test each record ==their start, finish and outcome== in the bug's own folder. ([#1023](https://github.com/alfredoperez/speckit-companion/pull/1023)) <!-- area: run-record -->
- **Doctor checks plugin freshness.** It flags each Claude Code plugin your Companion config or project nodes call that is ==behind its marketplace==, naming both versions. ([#1004](https://github.com/alfredoperez/speckit-companion/pull/1004)) <!-- area: install -->

### Changed
- **Implement checks the requirements by default.** Above simple size, a worker that never saw the plan calls each requirement ==met, missing or at risk==. ([#1038](https://github.com/alfredoperez/speckit-companion/pull/1038)) <!-- area: pipeline -->
- **Specify asks its open questions before plan.** Auto assumes an answer and ==records a concern for each==, and every spec states its non-goals and verification plan. ([#1037](https://github.com/alfredoperez/speckit-companion/pull/1037)) <!-- area: pipeline -->
- **Plan writes only the design docs needed.** A data model is written only for ==a new entity==, and contracts only for a new or changed API. ([#1004](https://github.com/alfredoperez/speckit-companion/pull/1004)) <!-- area: pipeline -->

### Fixed
- **Wave times stay honest when tasks close late.** Tasks closed together share ==one time== instead of each showing zero, and each close names the next wave to close. ([#1019](https://github.com/alfredoperez/speckit-companion/issues/1019)) <!-- area: run-record -->
- **Plan blocks work on an installed extension.** Picking call paths, code pins, states or screens in the plan step ==finds its guides== instead of crashing. ([#1039](https://github.com/alfredoperez/speckit-companion/pull/1039)) <!-- area: install -->

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

