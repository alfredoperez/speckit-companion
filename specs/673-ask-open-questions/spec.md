# Ask a spec's open questions before plan

**Source**: #1029

## User Scenarios & Testing

### User Story 1 - Specify asks what it could not settle (Priority: P1)

A developer runs specify on a request that leaves a real choice open. Instead of handing plan a spec with unanswered questions, specify stops once, shows the open questions as one numbered table with options, and waits. The developer answers, the answers go into the spec, and plan starts from a spec with no open questions.

**Why this priority**: today nothing in the default pipeline ever asks these questions, so the agent guesses and the guess becomes code.

**Independent Test**: run specify by hand on a request with an open choice and see the table; answer it and read the spec and the run record.

**Acceptance Scenarios**:

1. **Given** a spec draft with one or more open-question markers after the self-check, **When** specify runs attended, **Then** it shows every remaining question in one numbered table with options and does not continue until each is answered.
2. **Given** the developer answers the table, **When** specify continues, **Then** each answer is in the spec, no marker remains, and each answer is recorded in the run record as a decision the developer made.
3. **Given** a spec draft with no open-question markers, **When** specify runs, **Then** it asks nothing and runs exactly as before.

### User Story 2 - Auto keeps going and says what it assumed (Priority: P1)

A developer runs auto, which nobody watches. When the spec has open questions, auto does not stall: it picks the most reasonable answer for each, writes it under Assumptions, and records one concern per question so the developer can see every guess afterwards.

**Why this priority**: auto must never pause, and a silent guess is the problem this issue exists to fix.

**Independent Test**: run auto on a request with an open choice; it finishes without stopping, and the run record lists a concern for each assumed answer.

**Acceptance Scenarios**:

1. **Given** an unattended run and a spec with open-question markers, **When** the self-check finishes, **Then** specify asks nothing, replaces each marker with a default written under Assumptions, and records one concern per question naming the question and the assumed answer.
2. **Given** an unattended run with the stricter blocking checklist chosen, **When** questions remain after its loop, **Then** it follows the same assume-and-record rule instead of stopping.

### User Story 3 - Every spec states what it leaves out and how it will be proven (Priority: P2)

A reader opens any new spec and finds what the change deliberately leaves out, any rules that hold for this change only, and how a person or a test will prove it works. A small change may say "None" in a section rather than invent content.

**Why this priority**: every rival spec workflow writes these, and Companion already records non-goals when a spec has them, but no section asks for them.

**Independent Test**: run specify on any request and read the new sections in the spec and the non-goals in the run record.

**Acceptance Scenarios**:

1. **Given** any specify run, **When** the spec is written, **Then** it has Non-goals, Change-level rules and Verification plan sections, each filled or saying "None".
2. **Given** a spec whose Non-goals section lists items, **When** specify wraps up, **Then** those items are recorded in the run record as the spec's non-goals.

### Edge Cases

- More than three open questions: the draft rules already cap markers at three; the table holds at most three rows.
- The developer answers "something else": the free answer is recorded as given and written into the spec.
- An unattended run where no reasonable default exists: the step still picks the safest option, says so in the concern, and continues.
- A project that replaced the default checklist with its own recipe keeps its own behavior.

## Requirements

### Functional Requirements

- **FR-001**: When open-question markers remain after the default self-check in an attended run, specify MUST stop and ask them as one numbered table with options before continuing.
- **FR-002**: Each answer MUST be written into the spec, removing its marker, and recorded as a decision made by the developer, keyed by its question so a later change replaces it.
- **FR-003**: A spec with no open-question markers MUST run the self-check exactly as before, with no table and no pause.
- **FR-004**: In an unattended run, the default self-check and the blocking checklist MUST NOT pause; each remaining question MUST get a default written under Assumptions and one recorded concern naming the question and the assumed answer.
- **FR-005**: The spec draft MUST include Non-goals, Change-level rules and Verification plan sections, and MUST allow "None" in each.
- **FR-006**: The wrap-up MUST record the Non-goals section's items as the spec's non-goals, and record none when the section says "None".
- **FR-007**: The installed specify and auto commands MUST carry these instructions, and the shipped command files MUST match their sources.
- **FR-008**: The user docs for the specify and auto steps and the extension's changelog MUST describe the new behavior.

### Key Entities

- **Open question**: a `[NEEDS CLARIFICATION: …]` marker in a spec draft, at most three.
- **Decision** *(existing)*: an answer recorded in the run record with who made it.
- **Concern** *(existing)*: a note in the run record a reader should see.
- **Non-goals** *(existing as `expectations`)*: what the spec leaves out.

## Success Criteria

### Measurable Outcomes

- **SC-001**: An attended specify run with open questions reaches plan with zero markers left in the spec.
- **SC-002**: An unattended run with open questions finishes without a pause and records exactly one concern per question.
- **SC-003**: 100% of new specs carry the three new sections.
- **SC-004**: The extension's test suite, the build drift check and the changelog check all pass.

## Non-goals

- Running the separate clarify command from the pipeline.
- Turning the review gates on by default; that is #1028.
- Changing the three-marker cap.

## Assumptions

- The stricter blocking checklist stays as an opt-in variant; only its unattended behavior changes.
- "Unattended" is read from the run record's `unattended` field that auto already sets.
