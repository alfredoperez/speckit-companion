# Changelog — SpecKit Companion for the GitHub Copilot app

Changes to the **Copilot app canvas** are listed here. It is versioned on its own in `package.json`; the VS Code extension's changelog is at the repo root: [`../../CHANGELOG.md`](../../CHANGELOG.md).

## [Unreleased]

### Fixed

- **New spec keeps a project's timestamp numbering.** The board reads the `feature_numbering` setting newer Spec Kit writes, so the agent gets no sequential folder number. <!-- area: copilot-app -->

## [0.2.0] - 2026-10-13

The board installs as a plugin from this repo, and its buttons run their own steps on every model.

### Changed

- **The board is now packaged as a plugin.** Its files moved one level down, into `com.github.copilot/extensions/speckit-companion/`, so the Copilot app marketplace can install it ==straight from this repo==. ([#918](https://github.com/alfredoperez/speckit-companion/pull/918)) <!-- area: copilot-app -->

### Fixed

- **A button's command runs its own steps on every model.** New spec and the run buttons name the file that holds the command's steps, so an agent that never loaded the command ==reads them before it writes==. ([#913](https://github.com/alfredoperez/speckit-companion/pull/913)) <!-- area: copilot-app; issue: 817 -->
- **Plan cards work on the board.** A `states` block is drawn as a diagram where a click shows that state, and the buttons that did nothing are gone. ([#911](https://github.com/alfredoperez/speckit-companion/pull/911)) <!-- area: copilot-app -->
- **The board unlocks the next step.** A step the agent wrote the document for but never closed in the run record is closed when the turn ends. ([#881](https://github.com/alfredoperez/speckit-companion/pull/881)) <!-- area: copilot-app -->

## [0.1.0] - 2026-09-30

First version.

### Highlights

#### A spec board for the GitHub Copilot app
Open the SpecKit Companion canvas beside the chat to see every spec with its pipeline, task progress and the same Overview the VS Code viewer shows, updating live as the agent works. Buttons run the next step, and New spec asks for a workflow (Companion, Spec Kit or Auto) the way VS Code does. Opening the board tells the agent to wait for your next instruction instead of starting work.
<!-- area: copilot-app; pr: 787 -->
