# Feature Specification: The viewer shows converge as its own step

**Feature directory**: `specs/644-viewer-converge-step`
**Source**: issue #926, slice 3 (last slice). Design: the approved mock, boards "Viewer · converge found gaps" and "Viewer · clean converge, completed".

## User Scenarios & Testing

### User Story 1 - See what a converge pass found (Priority: P1)

A developer opens a spec after converge ran. Today the run overview draws converge as a plain dot like any other step, and nothing says whether it found missing work. With this change, the overview ends on a converge pill. When the pass added tasks, the pill is amber and reads "3 gaps", a card lists each added task by id and title, and the next step shows as a second implement round, waiting. The developer sees at a glance that the spec is not done, and what is left.

**Why this priority**: a spec that converge sent back looks finished today. That is the gap the slice exists to close.

**Independent Test**: record a converge pass that appends three tasks, open the viewer, and read the pill, the card and the waiting implement round.

**Acceptance Scenarios**:

1. **Given** a converge pass that appended T013 to T015, **When** the viewer opens the spec, **Then** the overview row ends with an amber converge pill reading its duration and "3 gaps", followed by "Implement" with "round 2, waiting".
2. **Given** the same spec, **When** the overview renders, **Then** a card headed "CONVERGE FOUND 3 GAPS" explains what converge did and lists T013, T014 and T015 with their titles from tasks.md.
3. **Given** a converge pass that appended one task, **When** the card renders, **Then** it reads "CONVERGE FOUND 1 GAP", singular.
4. **Given** a spec where converge never ran, **When** the viewer opens it, **Then** no pill, card, badge or fact about converge appears.

---

### User Story 2 - See that a clean converge completed the spec (Priority: P1)

A developer opens a spec that a clean converge pass completed. The converge pill is green and reads how many passes ran and "clean". A card headed "DONE, BY A CLEAN CONVERGE" says the last pass found nothing missing, with one row per pass ("3 gaps, added as T013 to T015", "nothing added") and a row saying when the spec was completed and who wrote it.

**Why this priority**: completed now means a clean converge. The viewer has to show that proof, or completed reads the same as before.

**Independent Test**: record two passes, the first adding three tasks and the second adding none, then complete the spec; open the viewer and read the pill and the card.

**Acceptance Scenarios**:

1. **Given** two passes, the second adding nothing, and a completed spec, **When** the overview renders, **Then** the pill is green and reads "2 passes · clean".
2. **Given** the same spec, **When** the card renders, **Then** it shows "PASS 1: 3 gaps, added as T013 to T015", "PASS 2: nothing added" and "COMPLETED: <date> at <time>, written by the extension".
3. **Given** one clean pass, **When** the pill renders, **Then** it reads "clean" with no pass count.
4. **Given** a completed spec whose last pass added tasks (converge ran after completion), **When** the overview renders, **Then** the pill is amber with the gap count, not green.

---

### User Story 3 - Act on the converge result from anywhere in the viewer (Priority: P2)

Outside the overview, the developer still needs the result. The header facts say "3 added by converge" or "converge clean". The Tasks item in the rail carries a "+3" badge while added tasks are open. The footer says "Converge added 3 tasks" and offers "Open tasks" and, as the main action, implementing the new tasks. On a completed spec the footer says "Run complete" and offers converge again.

**Why this priority**: useful once the result is visible, but the overview alone already tells the story.

**Independent Test**: with a gaps pass recorded, check the header fact, the rail badge and the footer; then check a cleanly completed spec.

**Acceptance Scenarios**:

1. **Given** a gaps pass with three open added tasks, **When** the viewer renders, **Then** the header shows "3 added by converge", the Tasks rail item shows "+3", and the footer reads "Converge added 3 tasks" with "Open tasks" and "Implement 3 new tasks" as the primary action.
2. **Given** two of the three added tasks are checked, **When** the viewer renders, **Then** the badge reads "+1" and the footer button reads "Implement 1 new task".
3. **Given** a spec completed by a clean converge, **When** the viewer renders, **Then** the header shows "converge clean", no badge shows, and the footer reads "Run complete" with "Converge again" as a secondary action.

---

### User Story 4 - See each implement round's time (Priority: P3)

When converge sends a spec back, implement runs again. The overview shows each round's time ("18m 4s, then 6m 40s") rather than hiding a duration it cannot attribute to one run.

**Why this priority**: a nicety; the round count matters more than its times.

**Independent Test**: record implement, converge with gaps, implement again; read the implement entry in the overview row.

**Acceptance Scenarios**:

1. **Given** two finished implement rounds, **When** the overview renders, **Then** the implement entry lists both durations in order.

## Edge Cases

- A converge that started and never finished is in flight: the existing running state applies, and the pill shows no outcome yet.
- A converge pass whose start predates this change has no recorded task list: the pass is shown without a gap count, never as clean.
- A task converge added that is later deleted from tasks.md: the card lists only ids still in tasks.md, and the count follows.
- A task title holding markup or a link: shown as plain text.
- Converge run twice with no implement between: each pass is its own row.
- The viewer pane is narrow: the header fact hides with the other facts by priority, and the pill wraps rather than overflowing.

## Requirements

### Functional Requirements

- **FR-001**: Each converge pass MUST be recorded with its start, its finish, and the ids of the tasks it added to tasks.md.
- **FR-002**: Recording a pass MUST keep the run record's guarantees: history only grows, writes merge, one lock covers the write, and a failure never fails the host command.
- **FR-003**: The run overview MUST show converge as its own pill, amber with the gap count when the latest pass added tasks, green with the pass count and "clean" when it added none.
- **FR-004**: When the latest pass added tasks, the overview MUST show a card listing each added task's id and title from tasks.md, and a waiting implement round after converge.
- **FR-005**: When a clean converge completed the spec, the overview MUST show a card with one row per pass and a completion row naming when and who.
- **FR-006**: The header facts MUST include "N added by converge" while added tasks are open, or "converge clean" after a clean pass.
- **FR-007**: The Tasks rail item MUST carry a "+N" badge counting added tasks still open.
- **FR-008**: The footer MUST offer implementing the open added tasks as the primary action, plus opening tasks, while added tasks are open; on a spec completed by a clean converge it MUST offer converging again as a secondary action.
- **FR-009**: The pill, card, badge, fact and footer MUST read one converge result, derived once.
- **FR-010**: A pass recorded without its task list MUST NOT read as clean.
- **FR-011**: The implement entry SHOULD list each round's duration when implement ran more than once.
- **FR-012**: Task ids and titles MUST reach the screen as text, never as markup.

### Key Entities

- **Converge pass**: one run of converge on a spec. Started at, finished at, the task ids it added (empty means clean; absent means unknown).
- **Converge result**: what the viewer shows, derived from the passes and tasks.md: the latest outcome (gaps, clean, unknown, running), the added tasks still open with their titles, the pass count.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A spec sent back by converge and a spec completed by a clean converge are told apart from the overview alone, every time, with no other view opened.
- **SC-002**: Every added task id in the gaps card matches an id converge appended to tasks.md, with zero missing or extra.
- **SC-003**: The rail badge, the header fact and the footer button show the same count in 100% of tested states.
- **SC-004**: A spec where converge never ran renders exactly as before this change.

## Assumptions

- "Added by converge" means task ids present in tasks.md at a pass's finish that were absent at its start.
- The completion row's "who" comes from the completion entry already in history (extension or ai).
- The footer's implement action reuses the existing step dispatch for implement rather than a new command.
- Green for a clean pass is allowed: the pipeline's done state is one of the few places the design lets green show.
- The mock's source-ticket chip belongs to another issue and is out of scope.

## Verbatim Constraints

- `CONVERGE FOUND 3 GAPS`
- `DONE, BY A CLEAN CONVERGE`
- `Converge checked the code against the spec, plan and tasks, and added these to the end of tasks.md. The spec did not change. Implement them, and converge runs again.`
- `round 2, waiting`
- `2 passes · clean`
- `3 added by converge`
- `converge clean`
- `Converge added 3 tasks`
- `Open tasks`
- `Implement 3 new tasks`
- `Run complete`
- `Converge again`
- `nothing added`
- `written by the extension`
