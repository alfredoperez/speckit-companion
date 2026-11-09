# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed
- **The viewer reads cleanly.** Wrapped lines stay with their list item, wide tables ==scroll inside the page==, and Given and Then mark keywords only. ([#0](https://github.com/alfredoperez/speckit-companion/pull/988)) <!-- area: spec-viewer -->
- **The outline and header agree with the page.** The outline marks ==the section you are reading==, file chips stay on one line, and tasks always show as a percentage. ([#0](https://github.com/alfredoperez/speckit-companion/pull/988)) <!-- area: spec-viewer -->

## [0.38.0] - 2026-11-08

Every spec now says what was proven, assumed or only claimed, and Companion lines up with Spec Kit 1.2.5.

### Highlights

#### The Overview shows what backs each claim
It quotes ==your request==, says who decided, marks assumed and weak requirements, flags stale checks, and shows review depth.
<!-- area: spec-viewer; pr: 964, 965, 966, 967, 968; media: request-verbatim, decision-authors, assumed-weak, stale-check, review-depth -->

#### The Overview names the ticket
It shows ==the ticket a spec came from== and the spec it extends, and the specs filter finds that ticket.
<!-- area: spec-viewer; pr: 972; media: source-ticket -->

#### The Bugs pane reads Spec Kit's bugfix runs
Bugs show ==step times and a review pause==, extra reports as tabs, a tracker link, and old reports after a re-assessment.
<!-- area: sidebar; pr: 961, 976; media: bug-times -->

### Added
- **Ideas read your folder and keep their specs.** A `speckit.assessmentsDirectory` setting points at ==your assessments folder==, and a spec made from an idea links back to it. ([#958](https://github.com/alfredoperez/speckit-companion/pull/958), [#973](https://github.com/alfredoperez/speckit-companion/pull/973)) <!-- area: sidebar -->
- **The viewer follows the run.** The overview draws each converge pass and ==the tasks it added==, and a step's new document opens as soon as it lands. ([#944](https://github.com/alfredoperez/speckit-companion/pull/944), [#979](https://github.com/alfredoperez/speckit-companion/pull/979)) <!-- area: overview -->
- **Spec Kit projects are offered Companion.** Opening a Spec Kit project without Companion's extension ==offers to add it==, until you say not for that project. ([#957](https://github.com/alfredoperez/speckit-companion/pull/957)) <!-- area: install -->

### Fixed
- **Upgrade follows Spec Kit's own steps.** Upgrade runs ==`specify self upgrade`, each assistant's upgrade==, then re-adds Companion, and a CLI before 1.2.5 keeps old presets. ([#957](https://github.com/alfredoperez/speckit-companion/pull/957), [#980](https://github.com/alfredoperez/speckit-companion/pull/980)) <!-- area: install -->
- **Answers refine the report in place.** Answering a question on a bug or idea ==edits that one report== instead of re-running the stage. ([#959](https://github.com/alfredoperez/speckit-companion/pull/959)) <!-- area: spec-viewer -->
- **A reinstall keeps your pipeline.** Opening a project after a reinstall or update ==rebuilds its customised pipeline==, so the assistant never runs the shipped default. ([#950](https://github.com/alfredoperez/speckit-companion/pull/950)) <!-- area: pipeline -->
- **Commands match what your project installed.** Companion spells each command ==the way Spec Kit recorded it== for your assistant, so Copilot projects get the dash names on disk. ([#948](https://github.com/alfredoperez/speckit-companion/pull/948), [#956](https://github.com/alfredoperez/speckit-companion/pull/956)) <!-- area: assistants -->
- **Converge is timed without the add-on.** In a project without Companion's Spec Kit extension, ==converge records its start and finish== like every other step. ([#956](https://github.com/alfredoperez/speckit-companion/pull/956)) <!-- area: run-record -->
- **A step works on the spec you clicked.** Terminals Companion opens for a spec carry ==its folder==, so steps stop picking another spec from `feature.json`. ([#946](https://github.com/alfredoperez/speckit-companion/pull/946)) <!-- area: spec-viewer -->

## [0.37.0] - 2026-10-13

A plan that draws what a change touches, and a Workflow Builder that works on plain Spec Kit.

### Highlights

#### A plan draws its blocks
A plan can now carry four kinds of block, and the viewer draws each one as a card: call paths as a tree, a lifecycle as boxes you can click through, a screen as ==a rough wireframe with numbered notes==, and code with a note pinned under the line it explains.
<!-- area: spec-viewer; pr: 898, 904, 905; media: plan-calls, plan-states, plan-screen, plan-code -->

#### The Workflow Builder opens on stock Spec Kit
Renamed from Pipeline Builder, the board now draws a plain Spec Kit project's own workflow and edits ==what Spec Kit owns==: extension hooks, document templates and the constitution command. A decision block opens one row per answer so a verdict skips the steps you choose, and a header chip turns living specs on or off.
<!-- area: pipeline-builder; pr: 883, 888, 889; media: builder-hooks -->

#### Plain Spec Kit stays plain
A project that still carries the retired Companion wrapper around the stock commands is ==cleaned up on the next start==, and the Steering view no longer lists its files.
<!-- area: pipeline; pr: 906 -->

### Added
- **Hover a spec to see its branch.** The sidebar tooltip names ==the branch the work is on==, beside the status and the assistant. ([#895](https://github.com/alfredoperez/speckit-companion/pull/895)) <!-- area: sidebar -->

### Fixed
- **The Run log reads cleanly.** Each task line in the Overview's Run log has ==space between its parts== and a badge for who recorded it. ([#912](https://github.com/alfredoperez/speckit-companion/pull/912)) <!-- area: overview -->
- **Plan cards work on the Copilot board.** A `states` block is drawn as a diagram where ==a click shows that state==, and the buttons that did nothing are gone. ([#911](https://github.com/alfredoperez/speckit-companion/pull/911)) <!-- area: copilot-app -->
- **A file link opens its own file.** A path in a spec opens ==the file it names== at its line, not a same-named file elsewhere. ([#897](https://github.com/alfredoperez/speckit-companion/pull/897)) <!-- area: spec-viewer -->
- **The header and the Tasks tab agree.** The header counts ticked boxes out of every task in `tasks.md`, the same read the tab's percentage uses. ([#882](https://github.com/alfredoperez/speckit-companion/pull/882)) <!-- area: spec-viewer -->
- **A finished task never reads as in progress.** The chip shows only on an open task while the run is still implementing. ([#882](https://github.com/alfredoperez/speckit-companion/pull/882)) <!-- area: spec-viewer -->
- **A line action reaches the line you clicked.** Comments, edits and ticked boxes use the line's place in the file, so Refine names the right section. ([#882](https://github.com/alfredoperez/speckit-companion/pull/882)) <!-- area: spec-viewer -->
- **The Copilot board unlocks the next step.** A step the agent wrote the document for but never closed in the run record is closed when the turn ends. ([#881](https://github.com/alfredoperez/speckit-companion/pull/881)) <!-- area: copilot-app -->
