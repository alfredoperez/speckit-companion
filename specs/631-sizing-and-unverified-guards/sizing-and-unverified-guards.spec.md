# Feature Specification: Sizing and unverified guards

**Feature Branch**: `631-sizing-and-unverified-guards`
**Created**: 2026-10-08
**Status**: Draft
**Input**: Issue #892, the three ideas the owner kept after checking each against 71 recorded runs

Two holes let unchecked work through, and one fact is missing from the sidebar. A change that is small by file count takes the short path even when it is hard to undo or hard to check. A spec completes with nothing verified and nothing saying why. And a spec row does not say which branch the work is on, though 70 of 71 runs record one.

## User Scenarios & Testing

### User Story 1 - A risky small change takes the full path (Priority: P1)

A developer describes a change that touches three files but rewrites how a shared record is saved. Sizing asks whether the change is hard to undo or hard to check. It is, so the run keeps plan and tasks, and the run log says why.

**Why this priority**: the short path removes both review points. Three of 17 short-path runs in this repo were changes of this kind.

**Independent Test**: size a three-file change described as a data migration. The verdict is not `simple`, and the printed reason names the risk.

**Acceptance Scenarios**:

1. **Given** a change within the small bar that is hard to reverse (a migration, a deletion of stored data, a published contract), **When** it is sized, **Then** the verdict is `normal` and one line says the change is hard to undo or hard to check.
2. **Given** a change within the small bar that is easy to reverse and easy to check, **When** it is sized, **Then** the verdict stays `simple`.
3. **Given** an unclear case, **When** it is sized, **Then** the verdict is `normal`, as for any weak signal.

---

### User Story 2 - A spec that finishes unverified says so (Priority: P1)

A run completes with no verification recorded and no concern explaining why. The spec still completes, but it carries a concern reading "finished, unverified" and the run prints a warning. A spec that already explains itself is left alone.

**Why this priority**: six past Companion runs completed this way with nothing in the record to tell a reader. A warning costs nothing and never strands a run.

**Independent Test**: complete a spec whose record has no verification and no concern. It ends completed, the warning is printed, and the record holds one new concern. Complete it again: nothing is added.

**Acceptance Scenarios**:

1. **Given** an implemented spec with no verification and no concern, **When** it is marked complete, **Then** it becomes completed, one concern says it finished unverified, and a warning is printed.
2. **Given** an implemented spec with at least one verification, **When** it is marked complete, **Then** no concern is added and no warning is printed.
3. **Given** an implemented spec with no verification but a concern already recorded, **When** it is marked complete, **Then** no concern is added.
4. **Given** any of the above, **When** completion runs, **Then** it never refuses for lack of verification.

---

### User Story 3 - A spec row says which branch it is on (Priority: P2)

Hovering a spec in the sidebar shows its branch along with its status, last activity and assistant.

**Why this priority**: the value is already recorded for nearly every run and only the viewer shows it.

**Independent Test**: hover a spec whose record names a branch. The tooltip holds a Branch line. A spec with no branch recorded shows none.

**Acceptance Scenarios**:

1. **Given** a spec whose record names a branch, **When** its row tooltip is built, **Then** it holds `Branch: <name>`.
2. **Given** a spec with no branch recorded, **When** its row tooltip is built, **Then** it has no Branch line.

---

### Edge Cases

- A verification field that is present but not a list counts as nothing verified. A concern field of any shape that holds something counts as an explanation and is left exactly as it was.
- A spec already completed or archived is untouched: no concern, no warning.
- The unverified concern is added once. A second completion attempt adds nothing.
- A branch value that is not text, or is blank, shows no Branch line.

## Requirements

### Functional Requirements

- **FR-001**: Sizing MUST ask whether the change is hard to undo or hard to check, and MUST NOT return `simple` when it is.
- **FR-002**: When that question turns a small change into `normal`, sizing MUST print one line naming the reason.
- **FR-003**: The shared size definition MUST carry the question, so every command that states the definition states the same rule.
- **FR-004**: Marking a spec complete MUST record one concern reading "finished, unverified" when the record holds no verification and no concern, and MUST print a warning.
- **FR-005**: Marking a spec complete MUST NOT refuse for lack of verification, and MUST leave a record that has a verification or a concern unchanged.
- **FR-006**: The spec row tooltip MUST show the recorded branch when there is one and omit the line when there is none.
- **FR-008**: A step that starts on a named branch other than the one the spec was created on MUST record it as the working branch, so the tooltip and the viewer header name the branch the work is on.
- **FR-007**: The docs and both changelogs MUST describe the three changes.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A change within the small bar that is described as hard to undo or hard to check is never sized `simple`.
- **SC-002**: Every spec the pipeline completes with no verification and no concern carries exactly one "finished, unverified" concern afterwards.
- **SC-003**: No spec that could complete before this change is refused after it.
- **SC-004**: The row tooltip shows a branch for every spec whose record names one.

## Assumptions

- Dropped by the owner and out of scope: a pull request on the row (nothing records one) and a needs-input state (two open questions in 71 runs).
- The warning is a concern on the record plus one printed line. The Overview already shows concerns, so no viewer change is needed.
- The warning belongs to the pipeline's own completion. A person pressing Mark Completed in VS Code closes a spec by hand and gets no concern.
- A check that ran and failed still counts as a verification: it is in the record and reads as failed. Only a top-level concern counts as an explanation, not one noted on a single task.
- "The recorded branch" is the working branch when the record has one, else the branch the spec was created on. The viewer already reads it that way, and the sidebar must agree.
- "Hard to undo or hard to check" is the agent's judgement from the spec's wording, like the existing scope signal, and errs toward `normal`.

## Verbatim Constraints

- `finished, unverified`
- `Branch: <name>`
