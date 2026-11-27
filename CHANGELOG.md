# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- **A fresh clone reads as built.** The Workflow Builder no longer says a freshly cloned project needs building. <!-- area: pipeline-builder -->
- **The Workflow Builder is redesigned.** Steps read as ==lanes of cards==, with each node's hooks beside it and your own changes marked in color. ([#1069](https://github.com/alfredoperez/speckit-companion/pull/1069)) <!-- area: pipeline-builder -->
- **Add to a lane from its header.** **+ Add to** opens one modal for a hook, a node or a step, each with its own form. ([#1069](https://github.com/alfredoperez/speckit-companion/pull/1069)) <!-- area: pipeline-builder -->
- **Move, replace or remove from a popover.** Places the run would refuse are greyed out with the reason, and a removed node keeps an **Undo**. ([#1069](https://github.com/alfredoperez/speckit-companion/pull/1069)) <!-- area: pipeline-builder -->
- **Attach a skill, instruction or command.** Pick where it runs, then the kind; hooks at one place show their order and run status. ([#1069](https://github.com/alfredoperez/speckit-companion/pull/1069)) <!-- area: pipeline-builder -->
- **A build bar replaces the Build button.** It says what is ==not built yet==, opens a review of the changes, and confirms when the build finishes. ([#1069](https://github.com/alfredoperez/speckit-companion/pull/1069)) <!-- area: pipeline-builder -->
- **Edit a document's sections from its node.** The **Document** row lists each section, lets you pick an alternative, and previews the outline before you save. ([#1069](https://github.com/alfredoperez/speckit-companion/pull/1069)) <!-- area: pipeline-builder -->
- **Switch and create workflows from the header.** The workflow list shows each saved one, and **New workflow…** starts from Shipped, this project or a preset. ([#1069](https://github.com/alfredoperez/speckit-companion/pull/1069)) <!-- area: pipeline-builder -->
- **Stock Spec Kit projects get the board.** Lanes, cards and hooks are drawn from its own commands, and you can add Companion from there. ([#1069](https://github.com/alfredoperez/speckit-companion/pull/1069)) <!-- area: pipeline-builder -->
- **A narrow panel keeps every control.** Lanes stack, popovers open as sheets, and Cancel and Add span the full width. ([#1069](https://github.com/alfredoperez/speckit-companion/pull/1069)) <!-- area: pipeline-builder -->

## [0.41.0] - 2026-11-24

Project health in the sidebar, Spec Kit presets in the Workflow Builder, and open questions you can clarify from the spec header.

### Added
- **The Overview shows when a spec was amended.** The intent card counts the amendments and ==names the last change==. ([#1042](https://github.com/alfredoperez/speckit-companion/pull/1042)) <!-- area: overview -->
- **A project health check in the sidebar.** Project health lists ==the CLI, Companion, constitution and AI agent==, and a click runs the fix. ([#1048](https://github.com/alfredoperez/speckit-companion/pull/1048)) <!-- area: sidebar -->
- **Spec Kit presets in the Workflow Builder.** A panel lists what each installed preset replaces and ==warns when it clashes with Companion==. ([#1044](https://github.com/alfredoperez/speckit-companion/pull/1044)) <!-- area: pipeline-builder -->
- **See a spec's open questions.** The spec header counts the ==open questions left== in the spec, and pressing it runs Clarify. ([#1046](https://github.com/alfredoperez/speckit-companion/pull/1046)) <!-- area: spec-viewer -->
- **Stage times for bugs run in chat.** A bug's page shows ==how long assess, fix and test took== and marks a stage that stopped early. ([#1023](https://github.com/alfredoperez/speckit-companion/pull/1023)) <!-- area: spec-viewer -->

### Fixed
- **Custom workflows open the spec like stock ones.** A workflow's Specification step ==opens the feature spec== and keeps it out of the sub-documents. ([#1062](https://github.com/alfredoperez/speckit-companion/pull/1062)) <!-- area: spec-viewer -->
- **Phases with several files read cleanly.** A phase listing two or more files shows ==one files chip== instead of stray markup. ([#1059](https://github.com/alfredoperez/speckit-companion/pull/1059)) <!-- area: spec-viewer -->

## [0.40.0] - 2026-11-17

Bugs paused at review get their answer from the pane, and task phases take comments again.

### Added
- **Approve or reject a bug paused at review.** A bug waiting at Spec Kit's review gate offers ==Approve and fix and Reject==, each resuming the run in a terminal. ([#1015](https://github.com/alfredoperez/speckit-companion/pull/1015)) <!-- area: sidebar -->
- **Bugs and Ideas know a turned-off extension.** A disabled extension shows ==read only with a way to turn it on==, and a same-name extension from another author is labelled. ([#1015](https://github.com/alfredoperez/speckit-companion/pull/1015)) <!-- area: sidebar -->

### Fixed
- **Task phases and waves take comments again.** Hover a phase or wave header and use ==the plus button==, and the phase stays open. ([#1018](https://github.com/alfredoperez/speckit-companion/pull/1018)) <!-- area: spec-viewer -->
- **Spec titles and task notes stop repeating.** Every tab keeps the spec's own title, and a wave's shared notes show ==once instead of on every task==. ([#1010](https://github.com/alfredoperez/speckit-companion/pull/1010)) <!-- area: spec-viewer -->

