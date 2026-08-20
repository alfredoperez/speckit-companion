# Feature Specification: Footer next step matches the pending step

**Feature Branch**: `fix/582-footer-next-step`
**Created**: 2026-08-19
**Status**: Draft
**Issue**: [#582](https://github.com/alfredoperez/speckit-companion/issues/582)

## User Scenarios & Testing

### User Story 1 - A freshly specified Companion spec offers Plan next (Priority: P1)

A developer runs the SpecKit Companion specify step on a new feature. The spec directory now holds the specification and its quality checklist, and nothing else. They open the spec in the viewer to keep going. The footer should invite them into the planning step, because planning is genuinely the next thing that has not happened yet.

**Why this priority**: This is the reported defect and it silently destroys work — the footer's forward button runs the task-generation step, so the developer ends up with a task list built from a specification that was never planned. Every other story in this feature is a guard around this one.

**Independent Test**: Take a spec whose recorded run shows only the specification step finished, with the specification document and its checklist on disk. Open it in the viewer. The footer must name the planning step, and pressing the forward button must run the planning step.

**Acceptance Scenarios**:

1. **Given** a spec on the SpecKit Companion workflow whose recorded run shows the specification step complete, and whose directory holds only the specification document and the specification quality checklist, **When** the developer opens it in the viewer, **Then** the footer reads "Next: Plan" and offers a Plan button.
2. **Given** that same spec, **When** the developer presses the footer's forward button, **Then** the planning step is dispatched, not the task-generation step.
3. **Given** that same spec, **When** the viewer renders, **Then** the step the footer names as next is the same step the stepper shows as pending.

### User Story 2 - The quality checklist is never mistaken for planning output (Priority: P2)

A step that files its output into its own sub-folder — the specification step's quality checklist is the everyday case — must not have that output counted as evidence that a *later* step produced something. Otherwise merely finishing one step appears to finish the next.

**Why this priority**: This is the second, independent half of the defect. Fixing only the workflow-classification half would leave the same trap armed for any workflow the extension still reconstructs from files.

**Independent Test**: For a workflow whose progression is reconstructed from files on disk, place a document inside an earlier step's sub-folder and nothing else. No later step may read as having produced output.

**Acceptance Scenarios**:

1. **Given** a spec where the only document beyond the specification lives inside a folder that the specification step already claims, **When** the extension decides whether a later step has produced output, **Then** that document is not counted for the later step.
2. **Given** a spec where a genuinely unclaimed document sits loose in the spec directory, **When** the extension makes the same decision, **Then** that document still counts for the step that accepts related documents.

### User Story 3 - Workflows the developer wrote themselves keep advancing (Priority: P2)

A developer who wires their own pipeline into the extension has commands that only write documents; nothing records progress for them. The extension reconstructs where those runs stand by looking at what is on disk. That reconstruction must survive this fix untouched.

**Why this priority**: The fix narrows when the reconstruction runs. Narrowing it too far would strand every developer-authored pipeline at its first step — a worse regression than the bug being fixed.

**Independent Test**: Run the progression reconstruction against a pipeline whose step names do not all belong to the built-in set. It must still advance to the furthest step with output on disk.

**Acceptance Scenarios**:

1. **Given** a developer-authored pipeline with step names outside the built-in lifecycle set, **When** its documents appear on disk ahead of the recorded position, **Then** the extension still advances the run to the furthest produced step.
2. **Given** any pipeline that the extension treats as developer-authored today, **When** this fix ships, **Then** it is still treated as developer-authored.

## Edge Cases

- A spec whose recorded run is genuinely empty (a stub written when the workflow was first chosen) must still surface a forward action for its entry step.
- A developer-authored pipeline whose step names happen to match a built-in pipeline exactly is indistinguishable from that built-in and is treated as built-in — an accepted, pre-existing limitation, not a regression.
- A step that declares both a sub-folder and an appetite for related documents must not be starved: its own sub-folder still counts as its own output.
- A spec already past planning must not be dragged backwards by any of this.

## Requirements

### Functional Requirements

- **FR-001**: The extension MUST NOT reconstruct progression from files for a spec running a workflow the extension ships built in, including the SpecKit Companion workflow with its terminal completion step.
- **FR-002**: A document filed under a folder that any step of the workflow claims as its own MUST NOT count as a related document for a different step.
- **FR-003**: The step the footer names as the next action MUST be the same step the stepper renders as pending, for every spec on a built-in workflow.
- **FR-004**: Every workflow the extension treats as developer-authored before this change MUST still be treated as developer-authored after it, and MUST still receive file-driven progression.
- **FR-005**: The project MUST carry an automated regression test that reproduces the reported state — specification step complete, specification document and quality checklist on disk, SpecKit Companion workflow — and asserts the footer offers the planning step.
- **FR-006**: Neither shipped product MUST contain a "shorts" command, skill, or asset; the short-form video tooling is personal and stays outside both distributions.
- **FR-007**: The recorded-progress capture flow MUST be shown working from a genuinely fresh install — the SpecKit command-line tool installed and initialized into a clean sandbox, its constitution step run, and the companion spec-kit extension installed through its own installer rather than copied from an existing installation.

## Key Entities

- **Workflow** — an ordered list of named steps a spec runs through. Some ship with the extension; others are written by the developer. Each step may name a document it produces, extra documents that also count, and a folder whose contents belong to it.
- **Recorded run** — the spec's own log of which steps started and finished. This is the single source of truth for where a spec stands.
- **Reconstructed progression** — a stand-in run the extension infers from documents on disk, for pipelines that never record anything. It is a fallback and must never override a real recorded run.
- **Related document** — a document in the spec directory that no step claims by name; some steps accept these as evidence of their own output.

## Success Criteria

### Measurable Outcomes

- **SC-001**: On a freshly specified SpecKit Companion spec, the footer names the planning step in 100% of renders; the task-generation step is offered in 0%.
- **SC-002**: The footer's named next step and the stepper's pending step agree on 100% of specs running a built-in workflow.
- **SC-003**: The set of workflows treated as developer-authored is unchanged — 0 workflows move from developer-authored to built-in other than the two the extension ships.
- **SC-004**: A regression test covering the reported state fails before the fix and passes after it.
- **SC-005**: A text search for "shorts" across both distributions returns 0 matches.
- **SC-006**: A sandbox initialized from scratch reaches a recorded run with a readable current step and status, with no files copied from an existing installation.

## Assumptions

- Matching a workflow's step-name sequence against the two built-in pipelines is sufficient to recognize them; the extension does not need the workflow's own name plumbed through to the two places that reconstruct progression.
- The fix must be strictly additive: a workflow considered developer-authored today may not become built-in, so the existing "any step name outside the lifecycle set" rule stays as the fallback and the built-in match is layered in front of it.
- The sandbox for the fresh-install check lives under the repository's examples directory and is disposable.

## Verbatim Constraints

- `isCustomWorkflow` — the classification function that must exempt built-in workflows.
- `relatedDocsPresent` — the function whose claimed set must include each step's sub-folder contents.
- `src/features/specs/customWorkflowProgress.ts` — the module holding both defects.
- `mark-complete` — the SpecKit Companion workflow's terminal step name, the one outside the lifecycle set.
- `checklists/requirements.md` — the specification quality checklist path that is currently miscounted.
- `approve:Plan` — the footer action the regression test must assert.

## MODIFIED Requirements
<!-- capability: specs -->

### A workflow that records nothing still shows progress

Workflows the user defines themselves run commands that write documents but never touch the state record, which would strand them at their first step forever. For those workflows only, progression SHALL be reconstructed from the one signal they do leave — their step outputs on disk — and only ever *forward* of what the record already says. Workflows that do record their own progress MUST be left entirely alone.

A workflow the product ships is recognized by its own step sequence, not by whether every step name belongs to the lifecycle set. A built-in pipeline that ends in a step outside that set MUST still be recognized as built-in and MUST NOT be reconstructed from disk. Recognition may only ever move a workflow from user-defined to built-in — never the reverse — so nothing that reconstructs progression today stops doing so.

A step may claim a whole folder as its own output. Everything inside a claimed folder belongs to the step that claims it and MUST NOT count as loose evidence for any other step.

#### Scenario: a user's workflow has produced its third step's output
- **WHEN** the record still says step one
- **THEN** a reconstructed progression advances it to the third step so the forward action appears
- **AND** the built-in pipelines are untouched by this path

#### Scenario: the record is already at or ahead of what disk shows
- **WHEN** reconstruction runs
- **THEN** the real record wins and nothing is rewritten

#### Scenario: a built-in pipeline ends in a step outside the lifecycle set
- **WHEN** the reader opens a spec running that pipeline
- **THEN** no progression is reconstructed from disk
- **AND** the forward action names the same step the step strip shows as pending

#### Scenario: only a claimed folder's document is present
- **WHEN** the sole document beyond the specification lives in a folder an earlier step claims
- **THEN** no later step reads as having produced output
- **AND** a document loose in the spec directory still counts as before
