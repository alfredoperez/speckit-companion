# Changelog — SpecKit Companion spec-kit Extension

All notable changes to the **spec-kit extension** (`id: companion`) are documented here.

> This is **not** the VS Code extension. The spec-kit extension is versioned independently (`extension.yml` `version`); the VS Code GUI's changelog lives at the repo root: [`../CHANGELOG.md`](../CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/); this extension follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.25.0] - 2026-10-13

The plan step draws what a change touches, and plain Spec Kit commands are left exactly as shipped.

### Highlights

#### The plan draws its blocks
One deciding step adds call paths, pinned code, states or screens to the plan ==only when the change needs them==, and checks each one: every file and line resolves, every state is reachable, every screen dot has its note.
<!-- area: pipeline; pr: 875, 905 -->

#### Plain Spec Kit commands stay untouched
Stock runs are recorded through spec-kit's own hooks, so the `/speckit.*` commands are ==exactly what spec-kit ships==, and a terminal run of plain Spec Kit still gets its step times.
<!-- area: pipeline; pr: 906 -->

### Added
- **A risky small change takes the full pipeline.** Sizing asks whether a change is hard to undo or hard to check, and one that is ==never takes the short path==. ([#895](https://github.com/alfredoperez/speckit-companion/pull/895)) <!-- area: pipeline -->
- **A spec that finishes unverified says so.** Completing with nothing verified and no concern explaining why still completes, records =="finished, unverified"== and warns. ([#895](https://github.com/alfredoperez/speckit-companion/pull/895)) <!-- area: run-record -->
- **A run records its working branch.** A step started on another branch than the spec was created on records it, so the viewer ==names the right branch==. ([#895](https://github.com/alfredoperez/speckit-companion/pull/895)) <!-- area: run-record -->
- **The configuration writer sets a verdict's routing.** A verdict's skipped steps and its notice are written together, and removing the entry ==restores the declared routing==. ([#888](https://github.com/alfredoperez/speckit-companion/pull/888)) <!-- area: pipeline-builder -->
- **Living specs travel with the pipeline graph.** The graph carries whether they run, where specs live and ==which capabilities are registered==, so a panel can draw them. ([#888](https://github.com/alfredoperez/speckit-companion/pull/888)) <!-- area: living-specs -->

### Changed
- **Terminal runs of plain SpecKit list no tasks.** The viewer's task list fills ==only when VS Code sends the step==. ([#906](https://github.com/alfredoperez/speckit-companion/pull/906)) <!-- area: run-record -->
- **The plan step records its check.** Closing the plan step records its block check with an exit code, so ==the result is always kept==. ([#905](https://github.com/alfredoperez/speckit-companion/pull/904)) <!-- area: pipeline -->

### Fixed
- **A registry rewrite keeps the chosen layout.** Registering a capability re-emits the registry, which dropped `layout` and sent ==every later adoption back to asking==. ([#888](https://github.com/alfredoperez/speckit-companion/pull/888)) <!-- area: living-specs -->
- **The manual check records its result.** The brownfield preset's click-through step called the recorder with `--concerns`, a flag that does not exist, so the result was dropped. ([#882](https://github.com/alfredoperez/speckit-companion/pull/882)) <!-- area: run-record -->
- **A completed spec names no current task.** Marking a spec complete clears the current task, which had kept naming the last one finished. ([#882](https://github.com/alfredoperez/speckit-companion/pull/882)) <!-- area: run-record -->

## [0.24.0] - 2026-10-03

Spec Kit's converge step now lands in the run record, and a hook moves in one write.

### Highlights

#### Spec Kit's converge step is recorded
Running `/speckit.converge` used to leave no trace in the run record, because converge was not a step it knew. Two new hooks now record when converge starts and finishes, so its time shows beside the other steps. Converge never changes the spec's status, a spec that ran it can still be marked complete, and the status command points at the next task when converge added some.
<!-- area: run-record; pr: 813 -->

### Added
- **A hook moves in one write.** The configuration writer can now move a hook to another place, or up and down among the hooks at one place, as a single change. The hook keeps the text it was written with, every other line of the file stays as it was, and a move to a node or phase the step does not have is refused with nothing written. Before this a move was a removal and then an addition, so an addition that was refused left the hook gone. ([#818](https://github.com/alfredoperez/speckit-companion/pull/818)) <!-- area: pipeline-builder -->

### Fixed
- **The capture and quality evals time a step to its own finish.** They measured a step up to the next step's start, so a spec left idle for an hour between specify and plan reported the wait as specify's time. The step timing line now lists each step's own duration, or says it was not measured, and a finish recorded more than once counts only the first trusted one. A step the editor started and the assistant finished through the recorder now counts as measured. ([#804](https://github.com/alfredoperez/speckit-companion/pull/804)) <!-- area: run-record -->

Older releases are archived in [`apps/website/src/data/changelog-archive-speckit.md`](../website/src/data/changelog-archive-speckit.md), and the full history reads at [speckit-companion.dev/changelog](https://speckit-companion.dev/changelog).
