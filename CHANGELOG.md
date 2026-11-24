# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **A project health check in the sidebar.** Project health lists ==the CLI, Companion, constitution and AI agent==, and a click runs the fix. ([#1048](https://github.com/alfredoperez/speckit-companion/pull/1048)) <!-- area: sidebar -->
- **Spec Kit presets in the Workflow Builder.** A panel lists what each installed preset replaces and ==warns when it clashes with Companion==. ([#1044](https://github.com/alfredoperez/speckit-companion/pull/1044)) <!-- area: pipeline-builder -->
- **See a spec's open questions.** The spec header counts the ==open questions left== in the spec, and pressing it runs Clarify. ([#1046](https://github.com/alfredoperez/speckit-companion/pull/1046)) <!-- area: spec-viewer -->
- **Stage times for bugs run in chat.** A bug's page shows ==how long assess, fix and test took== and marks a stage that stopped early. ([#1023](https://github.com/alfredoperez/speckit-companion/pull/1023)) <!-- area: spec-viewer -->

### Fixed
- **Custom workflows open the spec like stock ones.** A workflow's Specification step ==opens the feature spec== and keeps it out of the sub-documents. ([#PRNUM](https://github.com/alfredoperez/speckit-companion/pull/PRNUM)) <!-- area: spec-viewer -->
- **Phases with several files read cleanly.** A phase listing two or more files shows ==one files chip== instead of stray markup. ([#1059](https://github.com/alfredoperez/speckit-companion/pull/1059)) <!-- area: spec-viewer -->

## [0.40.0] - 2026-11-17

Bugs paused at review get their answer from the pane, and task phases take comments again.

### Added
- **Approve or reject a bug paused at review.** A bug waiting at Spec Kit's review gate offers ==Approve and fix and Reject==, each resuming the run in a terminal. ([#1015](https://github.com/alfredoperez/speckit-companion/pull/1015)) <!-- area: sidebar -->
- **Bugs and Ideas know a turned-off extension.** A disabled extension shows ==read only with a way to turn it on==, and a same-name extension from another author is labelled. ([#1015](https://github.com/alfredoperez/speckit-companion/pull/1015)) <!-- area: sidebar -->

### Fixed
- **Task phases and waves take comments again.** Hover a phase or wave header and use ==the plus button==, and the phase stays open. ([#1018](https://github.com/alfredoperez/speckit-companion/pull/1018)) <!-- area: spec-viewer -->
- **Spec titles and task notes stop repeating.** Every tab keeps the spec's own title, and a wave's shared notes show ==once instead of on every task==. ([#1010](https://github.com/alfredoperez/speckit-companion/pull/1010)) <!-- area: spec-viewer -->

## [0.39.0] - 2026-11-12

Spec documents get a new look, and the Living Specs view is retired.

### Highlights

#### A new look for spec documents
Specs, plans, tasks and research read as ==cards and meters== with clickable ids, and each story shows how far it got.
<!-- area: spec-viewer; pr: 999; media: spec-cards, task-progress, research-decisions -->

### Removed
- **Living Specs view and commands are gone.** The status bar item left too, and older specs still show ==their living specs card==. ([#1008](https://github.com/alfredoperez/speckit-companion/pull/1008)) <!-- area: living-specs -->

### Fixed
- **Create GitHub issues works on Spec Kit 1.4.** It sends the command from Spec Kit's ==github extension== when that extension is installed. ([#1001](https://github.com/alfredoperez/speckit-companion/pull/1001)) <!-- area: spec-viewer -->
- **The viewer reads cleanly.** Wrapped lines stay with their list item, wide tables ==scroll inside the page==, and Given and Then mark keywords only. ([#988](https://github.com/alfredoperez/speckit-companion/pull/988)) <!-- area: spec-viewer -->
- **The outline and header agree with the page.** The outline marks ==the section you are reading==, file chips stay on one line, and tasks always show as a percentage. ([#988](https://github.com/alfredoperez/speckit-companion/pull/988)) <!-- area: spec-viewer -->
