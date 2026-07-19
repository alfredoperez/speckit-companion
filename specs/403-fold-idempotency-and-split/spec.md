# Repeatable folding, and a context script small enough to reason about

**Feature branch**: `403-fold-idempotency-and-split`
**Issues**: #465 (correctness), #458 (structure)
**Status**: draft

## Overview

Two connected changes to the spec-kit extension's context-writing script, done in that order. First a correctness fix: folding the same set of spec changes into a living spec twice must leave the document untouched, and today it doesn't — one shape of fold appends a duplicate section on every single fold, forever. Second a structural change: the script that holds that fold logic has grown to 1860 lines and about sixty definitions, which is why the bug went unfound for so long and why our own tooling gave up trying to describe it. Splitting it into focused files makes the next bug findable, and fixes a second one the size caused directly — two capture flags in one call silently record only the first.

The order is deliberate. A small fix travels cleanly with its function through a move; refactoring around a known corruption bug does not.

## User Scenarios & Testing

### User Story 1 - Folding the same change twice leaves the living spec alone (Priority: P1)

A developer finishes a feature whose spec both adds a requirement section and renames or edits that same section. The fold-back step writes those changes into the project's living spec. Later the step runs again — a re-run, a resumed pipeline, a repeated command. The living spec should be exactly as it was after the first fold. Today it is not: with an add-and-rename pair the living spec gains another copy of the requirement on every fold, growing without limit; with an add-and-edit pair the section's body flips between two versions on every fold.

**Why this priority**: this is silent data corruption of a document the team treats as durable, and it is unbounded. Nothing else in this feature matters if the fold is still eating specs.

**Independent Test**: apply a delta set that both adds and renames the same requirement heading to a living spec five times in a row; the number of requirement headings must be the same after the first fold as after the fifth, and the document text must be unchanged from the second fold onward.

**Acceptance Scenarios**:

1. **Given** a delta set that adds requirement "Alpha" and renames "Alpha" to "Alpha Renamed", **When** the fold runs against an empty living spec and then runs again on its own output, **Then** the second run changes nothing and the document holds exactly one requirement.
2. **Given** that same delta set, **When** the fold runs five times in a row, **Then** the requirement heading count never grows.
3. **Given** a delta set that adds requirement "Alpha" with one body and edits "Alpha" with a different body, **When** the fold runs and then runs again on its own output, **Then** the second run changes nothing and the section carries the edited body.
4. **Given** any ordered pair of two different change verbs aimed at the same requirement heading, **When** the fold runs and then runs again on its own output, **Then** the second run changes nothing.
5. **Given** any ordered triple of three different change verbs aimed at the same requirement heading, **When** the fold runs and then runs again on its own output, **Then** the second run changes nothing.
6. **Given** a delta set whose verbs target headings that do not overlap, **When** the fold runs twice, **Then** the behavior is unchanged from today — these already work and must keep working.

### User Story 2 - Two pieces of captured information in one call both get recorded (Priority: P1)

A command body records a decision and a verification in a single call to the context writer. Today the writer records the decision, prints "Recorded 1 decision(s)", drops the verification on the floor, and exits successfully — so the caller has no signal that half its data vanished. Every flag passed in one call must be honoured.

**Why this priority**: silent data loss with a success exit code. A caller cannot detect it, so it never gets reported.

**Independent Test**: run the writer once with both a decision flag and a verification flag; read the resulting context file and confirm both are present.

**Acceptance Scenarios**:

1. **Given** a spec with an existing context file, **When** the writer is called once with both a decision and a verification, **Then** both are recorded and both are reported in the output.
2. **Given** the same call, **When** it completes, **Then** it exits successfully — the fix adds data, it does not add a failure mode.

### User Story 3 - The context script is small enough to read, spec, and debug (Priority: P2)

A developer opening the context-writing script to understand the fold-back step, or to write an accurate living spec for it, can find the relevant code by filename instead of scrolling past a dozen unrelated responsibilities. The script is split along the seams already visible in its function names: delta parsing, living-spec folding, task syncing, and capture each get their own file, and the original keeps the command line, the lifecycle, and the file-writing core.

**Why this priority**: it is the durable fix for how the P1 bugs were able to hide, but the P1 fixes stand on their own and must land first.

**Independent Test**: after the split, each new file can be read end to end in one sitting, and the command line behaves identically to before — same flags, same output, same exit codes.

**Acceptance Scenarios**:

1. **Given** the split is complete, **When** every existing command, hook, and script that calls the context writer runs, **Then** none of them needed editing.
2. **Given** the split is complete, **When** the packaging check runs, **Then** it passes — the new files are in the runtime packing list and the release archive is complete.
3. **Given** the split is complete, **When** the shape-parity and command-assembly checks run, **Then** they pass.
4. **Given** the split is complete, **When** the existing test suite runs, **Then** it passes without weakening any assertion.

## Edge Cases

- A rename chain — "A" renamed to "B" and "B" renamed to "C" in one delta set — must resolve to a single final heading and must not loop forever on a cycle ("A" to "B", "B" to "A").
- A delta set that adds a requirement whose heading is also the target of a rename, rather than its source.
- A delta set that adds and removes the same heading. This already behaves consistently today and must not change.
- A living spec that does not exist yet, so the fold creates it from a scaffold, must be idempotent from the very first fold.
- A delta set that names the same heading twice under the same verb.
- Folding into a living spec where the target heading appears more than once already (a document previously corrupted by this bug) — the fix must not crash, and re-folding must stop making it worse.
- A caller passing two flags of the same kind plus a third of a different kind in one call.
- A caller passing no recognised flag at all must keep its current behavior.

## Requirements

### Functional Requirements

- **FR-001**: Applying a set of requirement changes to a living spec and then applying the same set again to the result MUST leave the document byte-for-byte unchanged.
- **FR-002**: FR-001 MUST hold for every ordered pair of two distinct change verbs targeting the same requirement heading, with distinct body text per verb.
- **FR-003**: FR-001 MUST hold for every ordered triple of three distinct change verbs targeting the same requirement heading, with distinct body text per verb.
- **FR-004**: Repeatedly applying a delta set that both adds and renames the same heading MUST NOT increase the number of requirement headings in the living spec on any application after the first.
- **FR-005**: When one delta set both adds a requirement and renames that same requirement, the resulting living spec MUST hold the requirement once, under its renamed heading.
- **FR-006**: When one delta set both adds a requirement and edits that same requirement, the resulting living spec MUST hold the requirement once, carrying the edited body.
- **FR-007**: Rename targets MUST be resolved through chained renames, and a rename cycle MUST terminate rather than loop.
- **FR-008**: Fold behavior for delta sets whose verbs target non-overlapping headings MUST be unchanged.
- **FR-009**: The context writer MUST act on every recognised flag it is given in a single invocation, rather than only the first one it matches.
- **FR-010**: The context writer MUST report each kind of data it recorded in an invocation that carried several.
- **FR-011**: Delta parsing and its grammar MUST live in their own module with no file access.
- **FR-012**: The living-spec fold-back step and its helpers MUST live in their own module.
- **FR-013**: Task syncing, task-marker parsing, and checkbox writing MUST live in their own module.
- **FR-014**: Decision, verification, concern, expectation, coverage, step-summary, classification, and capture-entry handling MUST live in their own module.
- **FR-015**: The original script MUST keep the command line interface, the arg parser, the context-update lifecycle, atomic writing, history migration, journal finish and advance, terminal promotion, and the no-regress guard.
- **FR-016**: The command line interface MUST NOT change — every flag accepted before MUST be accepted after, with the same behavior, the same printed output, and the same exit codes.
- **FR-017**: No command body, hook, preset, or calling script may require editing as a result of the split.
- **FR-018**: Every new module MUST be included in the runtime packing list so the release archive ships a working extension.
- **FR-019**: The shape-parity check, the command-assembly checks, and the packaging check MUST all pass after the split.
- **FR-020**: The spec-kit extension changelog MUST carry an entry under its unreleased heading for each of the two halves, written for users.
- **FR-021**: Any reference documentation that describes the shape of the context-writing script MUST be updated in the same change.

## Key Entities

- **Delta set** — the requirement changes a feature spec declares, grouped by verb (added, modified, removed, renamed), each carrying a heading and, for added and modified, a body.
- **Living spec** — a durable per-capability document holding requirement sections under `### ` headings. The fold target.
- **Requirement section** — a `### ` heading line plus everything up to the next heading. The unit every verb operates on.
- **Rename mapping** — the heading-to-heading map derived from a delta set's rename entries, used to decide what an added heading's final name is.
- **Context file** — the per-spec record the writer maintains, holding lifecycle history plus captured decisions, verifications, concerns, expectations, coverage, and summaries.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 12 ordered same-heading verb pairs are idempotent, up from 8 today.
- **SC-002**: All 24 ordered same-heading verb triples are idempotent, up from 13 today.
- **SC-003**: Applying an add-and-rename delta set 5 times in a row produces exactly 1 requirement heading, down from 5 today.
- **SC-004**: A single writer call carrying two different kinds of captured data records 2 of 2, up from 1 of 2 today.
- **SC-005**: The largest script in the folder is under 1000 lines, down from 1860.
- **SC-006**: 0 command bodies, hooks, presets, or calling scripts require editing.
- **SC-007**: All 5 verification gates pass — unit tests, the extension's own test suite, shape parity, command emissions, and packaging.

## Assumptions

- When one delta set both adds and edits the same heading, the edited body is the intended final state — the edit is the later, more specific statement of intent.
- When one delta set both adds and renames the same heading, the renamed heading is the intended final name, and the added body is its content.
- Cases already idempotent today keep their current observable behavior; this change narrows the broken set to empty rather than redefining what a fold means.
- The four new modules are plain sibling files in the same scripts folder, imported the same way the script already imports its sibling resolver, so no packaging or path model changes.
- The dispatch fix converts the flag ladder into a sequence of independent checks; a call passing one flag behaves exactly as before.

## Verbatim Constraints

- Spec directory: `specs/403-fold-idempotency-and-split`
- New modules: `spec_deltas.py`, `living_spec_fold.py`, `task_sync.py`, `capture.py`
- The script that keeps the command line: `write-context.py`
- Flags that must both take effect in one call: `--decision`, `--verified`
- Gates that must pass: `package-manifest.py --check`, `check-shape-parity.py`, `assemble-nodes.py --check`, `build-commands.py --check` (the ticket also named `check-command-emissions.py`; no such script exists in this repo, and the command-body gates above are what stand in its place)
