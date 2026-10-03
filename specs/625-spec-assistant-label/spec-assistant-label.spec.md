# Feature Specification: Assistant name and Show terminal on a spec

**Feature Branch**: `625-spec-assistant-label`
**Created**: 2026-10-03
**Status**: Draft
**Input**: Issue #782, "Correlate spec with agent that is working on it"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See which assistant is working on a spec (Priority: P1)

A developer runs several specs at once, each handed to an assistant from Companion. Looking at the Specs sidebar or at an open spec, they can read the name of the assistant that Companion last sent that spec's step to, so they know which window to look in.

**Why this priority**: The request is about telling specs and assistants apart. The name alone answers "who has this one?" for every provider, including the ones that run in a chat panel.

**Independent Test**: Run a step on a spec from Companion with one provider configured, then read the sidebar row and the viewer. Both show that provider's name. A spec nobody ran from Companion shows none.

**Acceptance Scenarios**:

1. **Given** a spec whose step was started from Companion with Claude Code configured, **When** the developer looks at the spec's sidebar row, **Then** the row shows "Claude Code" alongside what it already shows.
2. **Given** the same spec open in the viewer, **When** the viewer renders, **Then** it shows the same assistant name as the sidebar row.
3. **Given** a spec that was only ever run by typing commands into an assistant directly, **When** the developer looks at its row and its viewer, **Then** no assistant name appears.
4. **Given** a spec last run with one provider, **When** the developer changes the configured provider and runs the next step from Companion, **Then** the row and the viewer show the new provider's name.
5. **Given** a spec with a recorded assistant, **When** VS Code is reloaded, **Then** the name is still shown.

---

### User Story 2 - Jump to the terminal Companion opened (Priority: P2)

When Companion opened a terminal for a spec's step and that terminal is still open, the developer can use a "Show terminal" action on the spec, from the sidebar row or from the viewer, and VS Code brings that terminal to the front.

**Why this priority**: It removes the hunt through terminal tabs, but it only helps providers that run in a terminal, and the name from Story 1 already narrows the search.

**Independent Test**: Run a step on two specs from Companion with a terminal provider, focus something else, then use Show terminal on the first spec. Its terminal comes to the front, not the other one.

**Acceptance Scenarios**:

1. **Given** a spec whose step Companion sent to a terminal that is still open, **When** the developer chooses Show terminal on its sidebar row, **Then** that terminal is revealed and focused.
2. **Given** the same spec open in the viewer, **When** the developer chooses Show terminal there, **Then** the same terminal is revealed and focused.
3. **Given** a spec whose terminal the developer closed, **When** they look at the row and the viewer, **Then** Show terminal is not offered.
4. **Given** a spec whose step went to a chat-panel provider, **When** they look at the row and the viewer, **Then** Show terminal is not offered and the assistant name still shows.
5. **Given** two specs with live terminals, **When** the developer runs a second step on the first spec in a new terminal, **Then** Show terminal on that spec reveals the newest terminal.

### Edge Cases

- The recorded assistant is a provider this version does not know (the file was written by a newer version or edited by hand): show no name, never arbitrary text from the file.
- VS Code was reloaded: the name stays, Show terminal is gone, because the extension can no longer tell which restored terminal belonged to the spec.
- The dispatch was suppressed (no command to run) or failed before anything was sent: nothing is recorded.
- A completed or archived spec keeps showing the last assistant name; it is history, not a claim that work is running.
- Recording the assistant fails (read-only folder): the step still dispatches.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When Companion dispatches a pipeline step for a spec, it MUST record on that spec which assistant the step was sent to.
- **FR-002**: The Specs sidebar row of a spec with a recorded, known assistant MUST show that assistant's display name.
- **FR-003**: The spec viewer of a spec with a recorded, known assistant MUST show the same display name.
- **FR-004**: The sidebar and the viewer MUST read the assistant name from one resolved source, so they cannot disagree.
- **FR-005**: A spec with no recorded assistant, or one this version does not recognise, MUST show no assistant name.
- **FR-006**: Recording the assistant MUST NOT change the spec's step, status or history, and a failure to record MUST NOT block the dispatch.
- **FR-007**: A spec MUST offer a Show terminal action on its sidebar row and in its viewer only while a terminal Companion opened for that spec is still open.
- **FR-008**: Show terminal MUST reveal and focus the most recent terminal Companion opened for that spec.
- **FR-009**: Closing that terminal MUST remove the Show terminal action from the row and the viewer without a manual refresh.
- **FR-010**: The docs MUST say plainly that Companion cannot jump to an IDE chat panel and does not mark a spec as waiting for input.

### Key Entities

- **Recorded assistant**: the provider a spec's most recent Companion-dispatched step was sent to. Stored with the spec so it survives a reload. One per spec, replaced on each dispatch.
- **Spec terminal**: the live terminal Companion opened for a spec's most recent step. Held only while VS Code is running; forgotten when the terminal closes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With three specs running under two different assistants, a developer can name the assistant for each spec from the sidebar alone, without opening any spec.
- **SC-002**: The sidebar row and the viewer show the same assistant name for the same spec in 100% of cases.
- **SC-003**: Show terminal brings the right terminal to the front in one action.
- **SC-004**: Show terminal is never offered for a spec with no live terminal.

## Assumptions

- "Assistant name" is the display name of the configured AI provider at the moment of dispatch. Companion cannot see which model or session the provider then uses.
- The name is kept after the step finishes, since "who built this" is still useful on a finished spec.
- Only steps dispatched through Companion's own buttons and commands are recorded. A step typed straight into an assistant leaves the last recorded name as it was.
- Out of scope: jumping to an IDE chat panel (VS Code does not tell an extension which chat panel picked up a command), a needs-your-input marker, and a header inside the assistant's own chat panel.
