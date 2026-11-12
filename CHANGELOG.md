# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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

