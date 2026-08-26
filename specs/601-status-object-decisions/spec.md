# Feature Specification: Status shows the decisions a run actually recorded

**Feature Branch**: `601-status-object-decisions`
**Created**: 2026-08-25
**Status**: Draft
**Input**: Status reports "Decisions: (none recorded)" on real Companion runs even though the run recorded decisions.

## User Scenarios & Testing

### User Story 1 - See the decisions the run recorded (Priority: P1)

A developer finishes planning a feature with the Companion pipeline, which records the choices the run made along the way. Later — after a break, on a resumed session, or when handing the work to someone else — they ask the pipeline where the spec stands. The status report tells them the step, the state, and the decisions that got the spec here. Today that last part is blank on every real run: the report says no decisions were recorded, while the recorded decisions sit untouched in the spec's saved context. The developer either believes the run made no decisions, or has to open the raw context file to find them.

**Why this priority**: This is the whole defect. The recorded reasoning is the most valuable thing status has to show, and it is exactly what goes missing — silently, with a message that reads like a fact rather than a failure.

**Independent Test**: Point the status report at a spec whose saved context holds decisions recorded by a real planning run, and confirm each decision's text appears in the report.

**Acceptance Scenarios**

1. **Given** a spec whose saved context holds decisions recorded by the planning step, **When** the developer asks for status, **Then** the report lists each decision's text under Decisions.
2. **Given** a spec whose saved context holds hand-written plain-text decisions, **When** the developer asks for status, **Then** those decisions still appear exactly as they did before this change.
3. **Given** a spec whose saved context mixes recorded decisions and hand-written ones, **When** the developer asks for status, **Then** every decision appears, in the order it was recorded.
4. **Given** a spec whose saved context holds no decisions at all, **When** the developer asks for status, **Then** the report says none were recorded — the honest answer in that case.

### User Story 2 - A malformed decision never hides the good ones (Priority: P2)

The saved context is written by several producers and can be hand-edited. A single entry that is missing its text, or is not a decision at all, must not blank the section or break the report. The developer still sees every well-formed decision.

**Why this priority**: The defect being fixed is a whole section disappearing. A fix that trades one silent blanking for another is not worth shipping; the report must degrade entry by entry, never all at once.

**Independent Test**: Put a decision entry with no text, and a non-decision entry, into a saved context alongside good decisions, then ask for status and confirm the good ones are listed and the report completes normally.

**Acceptance Scenarios**

1. **Given** a decision entry carrying no decision text, **When** the developer asks for status, **Then** that entry is left out and the remaining decisions are listed.
2. **Given** an entry that is neither a decision nor text, **When** the developer asks for status, **Then** it is left out and the report completes without error.

### User Story 3 - The other recorded lists are checked for the same blind spot (Priority: P3)

The run also records what it verified, what worried it, what it treated as out of scope, and what context it worked from. These are written in the same shape as decisions, so any reader of them could have the same blind spot. Every such reader is audited, and any that shares the defect is fixed in the same pass; readers that already handle both shapes are named as checked so the audit is not repeated later from scratch.

**Why this priority**: It closes the class of bug rather than the one instance, but it delivers nothing on its own if the audit comes back clean.

**Independent Test**: Enumerate the readers of the recorded lists and confirm each one either handles both stored shapes or is fixed to.

**Acceptance Scenarios**

1. **Given** a reader of one of the recorded lists, **When** it is audited, **Then** it either already handles both stored shapes or is changed to handle both.
2. **Given** the audit finds a reader already correct, **When** the work is reported, **Then** that reader is named as checked rather than silently left alone.

## Edge Cases

- The recorded decisions field is absent, empty, or not a list at all.
- A decision's text is present but blank or whitespace-only.
- A decision carries extra fields the reader does not know about.
- A decision is stored as a number rather than text — it must keep rendering exactly as it did before, since a value that used to appear and now does not is the very failure this change exists to remove. A value with no usable text at all (an empty entry, a nested list, a boolean) is skipped on its own without blanking the rest.
- Two decisions carry the same text — the report is a report, not a de-duplicator.

## Requirements

### Functional Requirements

- **FR-001**: The status report MUST list a recorded decision that was captured in the structured form the pipeline writes, showing its decision text.
- **FR-002**: The status report MUST keep listing plain-text decisions exactly as it does today, with no change to how they appear.
- **FR-003**: The status report MUST list every decision from a context that mixes both stored forms, preserving the recorded order.
- **FR-004**: The status report MUST leave out a decision entry that carries no usable text, and MUST still list the remaining decisions.
- **FR-005**: The status report MUST NOT change the shape of its Decisions output beyond making the previously-invisible decisions appear.
- **FR-006**: The supporting detail a decision carries — why it was made, what was rejected — MUST remain reachable for a future verbose report, rather than being discarded on read.
- **FR-007**: Every reader of the run's other recorded lists MUST be audited for the same string-only assumption, and any reader sharing it MUST be fixed in this change.
- **FR-008**: The status report MUST continue to never fail the command that runs it, on any shape of recorded data.

## Key Entities

- **Recorded decision** — one choice a run made. Carries its decision text, and optionally why it was made and what was rejected. Stored either as that structured entry or as a bare line of text.
- **Spec context** — the spec's saved record, holding the recorded decisions alongside the run's other captured lists and its lifecycle history.
- **Status report** — the human summary of where a spec stands: its step, its state, its recorded decisions, and the next action.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A status report on a spec with 8 recorded decisions lists 8 decisions, where it previously listed 0.
- **SC-002**: 100% of previously-rendering plain-text decisions still render, with byte-identical report lines.
- **SC-003**: A context holding one unusable decision entry among good ones still lists every good one, and the report exits successfully.
- **SC-004**: Every reader of the run's recorded lists is accounted for in the report as either fixed or verified correct — none left unexamined.

## Assumptions

- The Decisions section stays one line per decision. Showing the why and the rejected alternative is a separate, opt-in verbose report, not this change.
- The report does not de-duplicate, reorder, or truncate decisions; it shows what was recorded, in the order it was recorded.
- The operator pinned the full specify → plan → tasks → implement pipeline for this change, so it runs in normal mode even though its size classification is small.

## ADDED Requirements
<!-- capability: capture-runtime -->

### A reader of a captured list MUST accept every form its writer stores

Capture writes decisions, verifications, and concerns as entries carrying an identity value plus supporting detail, while hand-authored and pre-coercion contexts carry bare strings for the same fields. Any reader of one of these lists SHALL accept both forms — a non-empty string reads as itself, an entry reads through its identity value, and its supporting detail stays reachable rather than being discarded at the boundary. A reader that recognizes only one form silently drops everything real runs record while continuing to pass on hand-authored fixtures, so its emptiness reads as a fact about the run rather than a defect in the reader. An entry with no usable identity value SHALL be skipped on its own, never taking the rest of the list with it. Widening such a reader MUST NOT change the shape of what it emits — only which entries reach it — because the machine-readable resolution other commands parse is part of that shape. Lists whose writer stores plain strings only are exempt: their readers are correct by construction, and a widened branch there would be unreachable.

#### Scenario: a real run's decisions are read back
- **WHEN** status resolves a spec whose decisions were recorded by the pipeline
- **THEN** every decision appears, in the order it was recorded
- **AND** hand-authored string decisions in the same list appear unchanged alongside them

#### Scenario: one entry in the list is unusable
- **WHEN** a captured list carries an entry with no identity value among well-formed ones
- **THEN** that entry is skipped and the remaining entries are still read
- **AND** the command still exits successfully
