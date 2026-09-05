# A step you add appears in the spec viewer

**Feature Branch**: `603-custom-step-viewer-rail`
**Created**: 2026-09-05
**Status**: Draft
**Issue**: [#633](https://github.com/alfredoperez/speckit-companion/issues/633)

## Overview

A project can add a step of its own to the Companion pipeline from the pipeline builder. The step builds, it gets a real agent command, and a run of it is recorded like any other step. The spec viewer does not show it: the rail still draws the four shipped steps, and the step has no tab of its own.

The two halves never meet because adding a step writes a step directory under the project and stops there, while the viewer builds its rail from the built-in Companion pipeline, which is fixed in code.

This feature makes the pipeline the project actually runs the pipeline the viewer actually draws.

## The decision this feature makes

The issue asks whether adding a step should also write a user-workflow entry into settings, or whether the two are deliberately separate. This spec settles it: **neither**. The step directory a project already writes stays the single place a step is declared, and the viewer reads the Companion pipeline from it. No workflow entry is written into settings, and no copy of the Companion pipeline is created.

Two reasons, both from how the product already behaves:

- Copying Companion into a user-defined workflow would create a second pipeline that must be kept in step with the shipped one forever, and a user-defined pipeline is treated as one that records nothing — so the copy would lose the run history Companion does record.
- A built-in pipeline's name is reserved. A copy would have to take a different name, so the spec would stop reading as a Companion run in every other surface.

## User Scenarios & Testing

### User Story 1 - The step I added shows up in the rail (Priority: P1)

A developer adds a step to their project's Companion pipeline from the builder, edits what it does, and builds. They open a spec. The rail now draws that step in the place they put it, between the two shipped steps it sits between, and the run can move through it like any other step.

**Why this priority**: This is the whole complaint. Without it, a project can build a step it can never see, which reads as the builder being broken.

**Independent Test**: Add a step placed after implement in a sandbox project, build, open any spec in that project, and confirm the rail draws five steps in run order rather than four.

**Acceptance Scenarios**

1. **Given** a project with no step of its own, **When** a spec is opened, **Then** the rail draws exactly the shipped Companion steps, unchanged from today.
2. **Given** a project that added a step placed after `implement`, **When** a spec is opened, **Then** the rail draws that step after implement and before the completion step.
3. **Given** a project that added a step placed after `specify`, **When** a spec is opened, **Then** the rail draws that step between specify and plan.
4. **Given** a project that added a step with no placement, **When** a spec is opened, **Then** the rail is unchanged, because a step launched by hand does not take a turn in the run.
5. **Given** a project that added a step, **When** the sidebar and the viewer footer are read for the same spec, **Then** both describe the same pipeline, because both read the same source.

### User Story 2 - The step's document opens from the rail (Priority: P2)

The developer's added step writes a document. Clicking that step in the rail opens the document it wrote, the same way clicking plan opens the plan.

**Why this priority**: A step in the rail that opens nothing is only half the fix, but the rail being right is what unblocks everything else.

**Independent Test**: Add a step declared to write a named file, run it so the file exists, then click its step in the rail and confirm the file opens.

**Acceptance Scenarios**

1. **Given** an added step declared to write a document, **When** its step is selected in the rail, **Then** that document opens in the viewer.
2. **Given** an added step declared to write a document that has not been produced yet, **When** its step is selected, **Then** the viewer reports the document as not yet produced rather than opening an empty panel or failing.
3. **Given** an added step that writes no document, **When** the rail is drawn, **Then** the step appears as an action with no tab behind it, like implement does today.

### User Story 3 - Moving forward reaches the added step (Priority: P2)

The developer finishes the step before the added one and uses the viewer's forward action. It offers the added step, dispatches the added step's command, and the run records it.

**Why this priority**: The rail showing a step the forward action skips would be a new and more confusing bug than the one being fixed.

**Acceptance Scenarios**

1. **Given** a spec sitting on the step immediately before an added step, **When** the forward action is offered, **Then** it names the added step and dispatches that step's own command.
2. **Given** a run that has recorded the added step, **When** the spec is reopened, **Then** the added step reads as completed and the step after it is the one offered.
3. **Given** a spec recorded before the step was added, **When** it is opened, **Then** it still reads correctly, with the added step showing as not started rather than the run appearing broken.

### User Story 4 - Timing and progress count the added step honestly (Priority: P3)

The added step takes part in the run's timing summary on the same terms as a shipped step: it counts toward phase coverage when it is expected to record a duration, and it is left out when it is not.

**Why this priority**: Correctness of the reported numbers, not of the visible fix. Wrong here is quietly wrong rather than obviously broken.

**Acceptance Scenarios**

1. **Given** a completed run through a pipeline with one added step, **When** the timing summary is read, **Then** the phase count includes the added step.
2. **Given** an added step whose run was never recorded, **When** the timing summary is read, **Then** the run reports partial coverage rather than a guessed duration for that step.

## Edge Cases

- The project's step directory is missing, unreadable, or malformed. The rail falls back to the shipped Companion pipeline rather than rendering empty or failing to open.
- An added step names itself the same as a shipped step. It cannot be created today, and the rail must not draw a duplicate if one exists on disk anyway.
- An added step is placed after a step that does not exist. It is treated as unplaced and left out of the rail.
- Two added steps are placed after the same step. Both appear, in a stable order that does not change between openings.
- A step is removed from the project after specs have run through it. Existing specs that recorded it still open and read correctly.
- A spec whose recorded pipeline is the stock SpecKit one, not Companion. Its rail is unaffected by anything under the project's Companion step directory.
- The workspace has no project step directory at all, which is every project that has not used the builder. Nothing about the rail changes for them.

## Requirements

### Functional Requirements

- **FR-001**: The viewer and the sidebar MUST draw the Companion pipeline as the project actually runs it, including any step the project added, rather than a fixed list of the shipped steps.
- **FR-002**: A project's added step MUST be declared in exactly one place — the step directory the builder already writes — and the system MUST NOT write a workflow entry into user settings to make the step visible.
- **FR-003**: An added step MUST appear in the rail at the position it declares it runs behind, and MUST be omitted from the rail when it declares no position.
- **FR-004**: An added step that declares a document it produces MUST offer that document from the rail; one that declares none MUST render as an action-only step.
- **FR-005**: The viewer's forward action MUST offer and dispatch an added step when it is the next step in the pipeline.
- **FR-006**: Every surface that describes a spec's pipeline — rail, sidebar, footer, timing summary — MUST derive it from one shared resolution, so no two surfaces can disagree about which steps exist.
- **FR-007**: An unreadable, malformed, or absent project step directory MUST fall back to the shipped Companion pipeline, and MUST NOT prevent a spec from opening.
- **FR-008**: A spec recorded against the stock SpecKit pipeline MUST be unaffected by the project's Companion steps.
- **FR-009**: A run's recorded history MUST remain the source of which steps are done; adding a step MUST NOT introduce file-presence as evidence that a step completed.
- **FR-010**: An added step MUST count toward the run's timing phase coverage on the same terms as a shipped step.

## Key Entities

- **Pipeline step** — one turn in a Companion run. Carries a name, a display label, the command it dispatches, the document it produces (or none), and the step it runs behind. The shipped four plus the completion step are the built-in set; a project's added steps join them.
- **Project step directory** — the folder a project's added step lives in, written by the builder. Holds the step's frame, its ordering file, and its authoring nodes. This is where a step's name, label, placement, and produced document are declared.
- **Resolved pipeline** — the ordered list of steps a given spec travels, as every surface sees it. Today it is a fixed list for Companion; after this change it is the shipped list with the project's placed steps spliced in.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A developer who adds a step from the builder sees it in the spec viewer's rail after one build, with no settings file to edit by hand.
- **SC-002**: In a project with one added step placed in the run, the rail, the sidebar, the footer's next-step label, and the timing phase count all report the same number of steps.
- **SC-003**: A project with no added steps renders a rail identical to today's, verified by the existing viewer tests passing unchanged.
- **SC-004**: With the project step directory deleted, corrupted, or absent, every spec still opens and shows the shipped pipeline; zero open failures.
- **SC-005**: Adding a step changes zero lines of the user's settings.

## Assumptions

- The builder's existing step directory format is the declaration format. This feature reads it; it does not change how a step is written.
- Placement is limited to running behind one of the shipped steps, which is what the builder allows today. Placing a step behind another added step is out of scope.
- Reading the project's steps happens where the pipeline is already resolved for a spec, so every surface inherits it without each one being changed.
- A step's display label comes from the same place the builder already puts it; no new label field is introduced.
- The completion step stays terminal — an added step placed after implement runs before completion, not after it.

## Verbatim Constraints

- `.specify/companion/nodes/<step>/` — where an added step is declared. Read from here.
- `_order.yml` — the file inside a step directory that carries its placement.
- `after:` — the key in that file naming the step it runs behind.
- `writes:` — the key naming the document a step produces.
- `speckit.customWorkflows` — the settings key this feature MUST NOT write to.

## ADDED Requirements
<!-- capability: workflows -->

### One resolution produces a spec's pipeline, and it includes the steps the project added

Every surface that describes a spec's pipeline — the viewer rail, the sidebar tree, the footer's next-step label, the dispatch path, and the timing denominator — SHALL obtain its ordered step list from one shared resolution, and no surface SHALL derive its own. For a spec recorded against the Companion pipeline that resolution SHALL be the shipped steps with the project's own steps spliced in, read from the step directories the project already writes; a stock or user-defined pipeline SHALL be returned unchanged. No workflow entry is written into user settings to make a project's step visible, and no copy of a built-in pipeline is created.

A project's step declares where it runs behind one of the shipped four, its label, and the document it produces. It SHALL be placed immediately after the step it names, with the terminal completion step staying last; a step declaring no placement SHALL be omitted from the pipeline and remain launchable by hand. A step directory that is absent, unreadable, malformed, or named the same as a shipped step SHALL be skipped without preventing a spec from opening or stopping the remaining steps being read.

A pipeline carrying a project's step SHALL still be classified built-in, so which steps are done continues to come from the recorded history rather than from a file being present, and the step SHALL record its start, dispatch its own command, and count toward the run's timing phase coverage on the same terms as a shipped step.

#### Scenario: A placed step joins the pipeline

- **WHEN** a project has declared a step that runs behind `implement`, and a Companion spec is opened
- **THEN** every pipeline surface lists that step after implement and before the terminal completion step, the forward action names and dispatches its own command, and its run counts toward the timing phase coverage

#### Scenario: An unreadable step directory falls back

- **WHEN** the project's step directory is absent, unreadable, or malformed
- **THEN** the spec opens on the shipped Companion pipeline, with no error surfaced and no settings written
