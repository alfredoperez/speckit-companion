# Amend a spec after work has started

**Source**: #1030

## User Scenarios & Testing

### User Story 1 - Change the spec in place, on the record (Priority: P1)

A developer changes their mind after plan or implement has run. They run amend with what changed and why. The spec is edited in place, not copied into a new folder, and the spec's record keeps one amendment entry saying when, who, what changed and why.

**Why this priority**: today the only way to change course is a new folder that extends the old one, and nothing says the spec changed.

**Independent Test**: amend a planned spec with a wording change, then read spec.md and the amendments on the record.

**Acceptance Scenarios**:

1. **Given** a spec past specify, **When** the developer amends it, **Then** spec.md is edited in place and no new spec folder is created.
2. **Given** an amendment, **When** it finishes, **Then** the record gains one amendment entry with when, who, what and why, and earlier entries stay.
3. **Given** two amendments with the same description, **When** both run, **Then** both are on the record.

### User Story 2 - A big change replans, a small one does not (Priority: P1)

When the amendment adds or removes a requirement, amend reruns plan and then converge, so the plan and the task list catch up. A wording-only change reruns neither. Either way the spec's status and step never move backward.

**Why this priority**: a spec whose requirements changed but whose plan did not is worse than no amendment.

**Independent Test**: amend a spec by adding a requirement and see plan and converge run; amend wording only and see neither run.

**Acceptance Scenarios**:

1. **Given** an amendment that adds or removes a requirement, **When** amend runs, **Then** it reruns plan and then converge, and records `replanned: true`.
2. **Given** a wording-only amendment, **When** amend runs, **Then** it reruns neither and records `replanned: false`.
3. **Given** a completed spec, **When** it is amended, **Then** its status stays completed and amend says how to reopen it.

### User Story 3 - Decide about code that lost its spec line (Priority: P2)

When an amendment removes a requirement, the developer is asked whether to keep or remove the code that implemented it. An unattended run records a concern instead of asking.

**Why this priority**: removed requirements otherwise leave code nobody asked for.

**Independent Test**: amend a spec to remove a requirement and see the keep-or-remove question.

**Acceptance Scenarios**:

1. **Given** an amendment that removes a requirement with code behind it, **When** amend ends attended, **Then** it asks keep or remove and records the answer as a decision.
2. **Given** the same unattended, **When** amend ends, **Then** it records a concern naming the code.

### User Story 4 - The Overview says the spec was amended (Priority: P2)

A reader opening the Overview sees that the spec changed after it started: how many times, and the last change.

**Why this priority**: the record is only useful if a reader meets it.

**Independent Test**: open the Overview of a spec with two amendments.

**Acceptance Scenarios**:

1. **Given** a spec with amendments, **When** the Overview opens, **Then** the intent block shows "Amended N times · last: <what>".
2. **Given** a spec with no amendments, **When** the Overview opens, **Then** no amended line shows.

### Edge Cases

- Amend on a spec with no spec.md: it stops and says to run specify.
- A record written before this change has no amendments field and reads as none.
- A spec with only amendments (no other durable context) still shows its Overview.

## Requirements

### Functional Requirements

- **FR-001**: A `speckit.companion.amend` command MUST edit the current spec.md in place and never create a new spec folder.
- **FR-002**: Each amendment MUST append one entry to `amendments` on the record with `at`, `by`, `what`, `why` and `replanned`, without merging entries that share a description.
- **FR-003**: When requirements are added or removed, amend MUST rerun plan and then converge; otherwise it MUST rerun neither.
- **FR-004**: Amend MUST NOT move the spec's status or current step backward; on a completed spec it MUST say how to reopen it.
- **FR-005**: When requirements are removed, amend MUST end with a keep-or-remove decision (attended) or a concern (unattended).
- **FR-006**: The viewer MUST read `amendments` from the record and the Overview MUST show "Amended N times · last: <what>" when there is at least one.
- **FR-007**: The command MUST be registered wherever the extension's command checks look, and documented on the site.

### Key Entities

- **Amendment**: one change to a spec after it started: when, who, what changed, why, and whether plan was rerun.

## Success Criteria

### Measurable Outcomes

- **SC-001**: An amended spec keeps one folder and gains exactly one amendment entry per amend run.
- **SC-002**: 100% of amendments that add or remove a requirement rerun plan and converge; 0% of wording-only ones do.
- **SC-003**: A record without amendments renders exactly as before.
- **SC-004**: The extension suite, the jest suite, the viewer build and the command-emission checks pass.

## Non-goals

- A Copilot canvas button for amend.
- Moving a spec's status backward from the writer.
- Showing the full amendment list in the Overview; one line is the first version.

## Change-level rules

- No new history kind; history stays start and complete.
- No new dependency.

## Verification plan

- Writer tests: `--amend` and `--batch` append entries; same-text entries both survive.
- Viewer tests: derivation carries amendments; the Overview line shows and hides correctly.
- The command-emission check passes with the new command registered.
- One sandbox run amends a planned spec with a new requirement.

## Assumptions

- `by` is `ai` when the agent writes the entry and `you` when the developer dictates it.
- "Requirement added or removed" is judged by the FR list before and after the edit.
