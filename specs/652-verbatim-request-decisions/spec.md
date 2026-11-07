# Feature Specification: Keep the request verbatim, and say who decided what

**Source**: #963

## User Scenarios & Testing

### User Story 1 - See the request word for word (Priority: P1)

A developer opens a finished spec's Overview and reads, under Intent, the exact words they typed when they started the run. The one-line intent is the run's reading of the request; the quoted request is what they actually asked for, so they can judge whether the run built the right thing. Later steps read the stored request instead of a paraphrase of it.

**Why this priority**: A paraphrased request quietly drops details, and nothing downstream can tell. Keeping the original is the cheapest guard.

**Independent Test**: Run specify with a request that has odd spacing, line breaks and punctuation. Open the run record and the Overview: both show it unchanged.

**Acceptance Scenarios**:

1. **Given** a new run started with a request, **When** specify writes its first record, **Then** the record holds the request exactly as given, byte for byte after trimming outer blank space.
2. **Given** a record that already holds a request, **When** a later step or a second specify run writes the request again, **Then** the stored request is unchanged.
3. **Given** a record with a request, **When** the Overview opens, **Then** Intent shows a block labelled "Your request, word for word" with the request text.
4. **Given** an older record with no request, **When** the Overview opens, **Then** Intent renders as it does today, with no empty block.
5. **Given** the plan step runs, **When** it gathers context, **Then** it reads the stored request rather than restating it from memory.

### User Story 2 - See who answered each decision and when (Priority: P1)

Each decision in the Overview says who made it, the agent or a named person, and when. A person reading the record can tell which choices a human signed off on and which the agent made alone.

**Why this priority**: A decision without an author reads as settled even when nobody reviewed it.

**Independent Test**: Record one decision as the agent and one as a person, then open the Overview.

**Acceptance Scenarios**:

1. **Given** the agent records a decision, **When** the Overview opens, **Then** the row reads "answered by agent" with the date and time it was recorded.
2. **Given** a person's answer is recorded as a decision (for example a clarify answer), **When** the Overview opens, **Then** the row names that person.
3. **Given** a decision recorded with no author or time, **When** it is written, **Then** the record stamps the agent as author and the write time.
4. **Given** an older decision without author or time, **When** the Overview opens, **Then** it renders as today with no "answered by" text.

### User Story 3 - Reopen a decision without losing the first answer (Priority: P2)

When a decision is revisited and answered differently, the new answer becomes the current one and the earlier answer stays on the record, shown struck through beneath it with who gave it and when.

**Why this priority**: Overwriting an answer erases the reason a later reader might question the current one.

**Independent Test**: Record a decision with an id, record it again with the same id and a different answer, then open the record and the Overview.

**Acceptance Scenarios**:

1. **Given** a decision with an id, **When** a decision with the same id and a new answer is recorded, **Then** the record shows the new answer as current and keeps the earlier one with its author and time.
2. **Given** a reopened decision, **When** the Overview opens, **Then** the earlier answer shows beneath the current one, indented and struck through, with "earlier answer · <who> · <when> · reopened".
3. **Given** the same id and the same answer recorded twice, **When** it is written, **Then** nothing is added.
4. **Given** a decision reopened twice, **When** the record is read, **Then** both earlier answers are kept, oldest first.

### Edge Cases

- A very long request (several paragraphs) wraps inside the Intent block and never widens the page.
- A request containing markup or script text shows as plain text.
- An empty or whitespace-only request is not stored.
- A decision written without an id still de-duplicates by its text, as today, and cannot be reopened.
- A malformed author or time value on a stored decision is ignored by the viewer rather than breaking the row.

## Requirements

### Functional Requirements

- **FR-001**: The run record MUST store the original request word for word, written once at the first specify write and never overwritten.
- **FR-002**: The Overview MUST show the stored request under Intent in a block labelled "Your request, word for word", as plain text that wraps.
- **FR-003**: The plan step MUST read the stored request from the run record when one exists, rather than a paraphrase.
- **FR-004**: Every newly recorded decision MUST carry who answered (`agent` or a person's name) and when; the writer fills both when the caller omits them.
- **FR-005**: A decision MAY carry a stable id; recording a different answer under an existing id MUST make the new answer current and keep every earlier answer with its author and time.
- **FR-006**: The Overview MUST show "answered by <who> · <when>" on each decision that has an author, and each earlier answer of a reopened decision beneath it, struck through, with its author, time and "reopened".
- **FR-007**: Records written before this change MUST render exactly as they do today.
- **FR-008**: When a Companion step stops to ask a person and they answer, it MUST record the answer as a decision authored by that person.

### Key Entities

- **Request**: the text the person gave when starting the run. One per spec, written once.
- **Decision**: a choice made during the run. Has the answer, optional reasoning and rejected alternative, an optional id, who answered, when, and the earlier answers it replaced.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A request with line breaks, quotes and markup round-trips through the record and the Overview with zero characters changed.
- **SC-002**: 100% of decisions recorded after this change show an author and a time in the Overview.
- **SC-003**: Reopening a decision three times leaves three earlier answers on the record and on screen.
- **SC-004**: Every existing Overview fixture renders unchanged.

## Assumptions

- "When" is the write time of the decision unless the caller supplies one.
- A person's name comes from the caller (clarify knows who answered); when it does not know, it writes "you" rather than guessing a name.
- The request is trimmed of outer blank space only; inner spacing and line breaks are kept.
- Items r1 to r4 and r7 of #963 are later slices and out of scope here.
- Stock `clarify` has no Companion surface, so its answers are not attributed by this change.
- The Copilot canvas and the Claude Code mod read the record on their own; showing the new fields there is a later change.
- When auto starts the run, auto stores the request, because the specify it dispatches receives a restatement.

## Verbatim Constraints

- Intent label: `Your request, word for word` (rendered in the kicker style, which uppercases it as in the approved design)
- Decision line: `answered by <who> · <when>`
- Earlier answer line: `earlier answer · <who> · <when> · reopened`
- Author for the assistant: `agent`
