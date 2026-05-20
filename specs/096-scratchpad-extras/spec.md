# Feature Specification: Per-Document Scratchpad Extras

**Feature Branch**: `096-scratchpad-extras`  
**Created**: 2026-05-20  
**Status**: Draft  
**Input**: User description: "Replace inline review comments with per-document scratchpad files (spec-extra.md, plan-extra.md, tasks-extra.md) surfaced as sub-tabs in the spec viewer, with a repurposed Refine button that dispatches the scratchpad contents to the AI to edit the corresponding source doc."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture refinement notes and apply them to a source document (Priority: P1)

A user reviewing a spec wants to jot down freeform refinement notes, questions, deferred concerns, or instructions for the AI without altering the source artifact yet. They open the scratchpad that pairs with the document they are reading, write their notes in plain markdown, and later trigger a single action that hands the scratchpad's contents to the AI with instructions to edit the corresponding source document in place.

**Why this priority**: This is the core value of the feature and the direct replacement for the removed inline-comment workflow. Without it, there is no way to collect and act on refinement notes.

**Independent Test**: Open a spec's scratchpad, type notes, trigger the apply action, and confirm the AI edits the matching source document (not a regenerated template) and the scratchpad file remains intact for handoff.

**Acceptance Scenarios**:

1. **Given** a spec with an existing scratchpad containing notes, **When** the user views that scratchpad tab and triggers the apply action, **Then** the full scratchpad contents are sent to the AI with instructions to directly edit the matching source document.
2. **Given** the user is viewing a source-document tab (not a scratchpad), **When** the user looks for the apply action, **Then** the apply action is hidden because there is nothing to submit.
3. **Given** a scratchpad for one document type, **When** the apply action runs, **Then** the AI is instructed to edit only the matching source document and never to run a command that regenerates the document from a template.

---

### User Story 2 - Create a scratchpad on demand (Priority: P1)

A user wants to start taking notes for a document that has no scratchpad yet. They open the scratchpad sub-tab, see a clear empty state, create the file with one action, and immediately begin editing it.

**Why this priority**: Scratchpads are lazily created, so a frictionless creation path is required before any notes can be captured. It is a prerequisite for Story 1 on documents that have never been annotated.

**Independent Test**: Open a scratchpad sub-tab for a document with no scratchpad file, confirm an empty state with a single create action appears, click it, and confirm the file is created and the view switches to it.

**Acceptance Scenarios**:

1. **Given** a source document with no paired scratchpad file, **When** the user opens the scratchpad sub-tab, **Then** an empty state with a single create action (labeled for the specific scratchpad, e.g. "Create spec-extra.md") is shown.
2. **Given** the empty state is shown, **When** the user triggers the create action, **Then** an empty scratchpad file is created in the spec directory and the view switches to the newly created scratchpad.
3. **Given** a scratchpad file exists, **When** the user chooses to edit it, **Then** it opens in the standard editor using the same affordance as other documents.

---

### User Story 3 - See which scratchpads have pending notes at a glance (Priority: P2)

A user wants to know which of a spec's scratchpads currently contain notes without opening each one, so they can quickly spot outstanding refinement work.

**Why this priority**: A convenience that improves discoverability of pending work but is not required for the core capture-and-apply loop. Explicitly noted as non-blocking for the initial release.

**Independent Test**: Add content to one scratchpad, leave others empty, open the activity surface, and confirm only the scratchpad with content is flagged.

**Acceptance Scenarios**:

1. **Given** a spec where some scratchpads contain notes and others are empty or absent, **When** the user views the activity surface, **Then** scratchpads that contain content are indicated and empty or absent ones are not.

---

### Edge Cases

- **Empty scratchpad apply**: When the user triggers the apply action on a scratchpad that exists but contains no content, the system does not dispatch an empty instruction to the AI and indicates there is nothing to apply.
- **Scratchpad deleted outside the viewer**: If a scratchpad file is removed from disk while its tab is open, the sub-tab returns to the empty state on next view.
- **Scratchpad created outside the viewer**: If a user creates a `*-extra.md` file directly in the spec directory, the viewer surfaces it as an existing scratchpad without requiring the in-app create action.
- **Source document absent**: If the paired source document does not exist, the scratchpad sub-tab is not offered for that document type.
- **Existing ephemeral inline comments**: Any in-flight inline review comments from the old model are not migrated; the old infrastructure is removed wholesale.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support up to one optional scratchpad document per core source document, named with an `-extra` suffix on the source document's base name (spec-extra, plan-extra, tasks-extra).
- **FR-002**: System MUST store each scratchpad as a plain markdown file in the same spec directory as its source document, alongside the existing source artifacts.
- **FR-003**: System MUST create scratchpad files lazily — only when the user explicitly creates one — and MUST NOT create them automatically when a spec is created.
- **FR-004**: System MUST surface each existing scratchpad as a sub-tab next to its source document in the spec viewer, following the same pattern used for related documents.
- **FR-005**: System MUST visually distinguish the scratchpad sub-tab from the source-document tab so the user can tell which is the authoritative artifact and which is the scratchpad.
- **FR-006**: System MUST show an empty state with a single, clearly labeled create action when the user opens a scratchpad sub-tab whose file does not exist.
- **FR-007**: System MUST create an empty scratchpad file and switch the view to it when the user triggers the create action from the empty state.
- **FR-008**: System MUST allow the user to open an existing scratchpad in the standard editor using the same edit affordance available for other documents.
- **FR-009**: System MUST display the apply ("Refine") action as visible and active only when the user is viewing a scratchpad tab, and MUST hide it when the user is viewing a source-document tab.
- **FR-010**: System MUST, when the apply action is triggered, read the full contents of the active scratchpad and dispatch an AI instruction to edit the matching source document directly (scratchpad for a given document type maps to that document type's source).
- **FR-011**: System MUST instruct the AI to perform a direct, in-place edit of the source document and MUST NOT invoke any command that regenerates the source document from a template.
- **FR-012**: System MUST NOT dispatch an apply instruction when the active scratchpad is empty, and MUST indicate to the user that there is nothing to apply.
- **FR-013**: System MUST treat scratchpad files as non-core artifacts: they MUST NOT gate phase transitions, MUST NOT count toward task completion, and MUST NOT trigger any workflow-lifecycle behavior.
- **FR-014**: System MUST leave scratchpad files committable to source control and MUST NOT add them to ignore rules.
- **FR-015**: System MUST remove the prior inline review comment capability in full, including the hover-to-add control, the comment cards, the comment entry dialog, the batch-submit action's old behavior, and the associated stored comment/refinement state and message protocol.
- **FR-016**: System SHOULD surface, on the activity surface, an indication of which scratchpads currently contain content (Priority P2; may follow the initial release).
- **FR-017**: System MUST recognize scratchpad files created directly on disk and surface them in the viewer without requiring the in-app create action.

### Key Entities *(include if feature involves data)*

- **Scratchpad (Extra) Document**: A plain markdown file paired one-to-one with a core source document (spec, plan, or tasks) within a single spec. Holds freeform refinement notes, questions, deferred concerns, or AI instructions authored by the user. Identified by the `<doctype>-extra.md` naming convention. Optional, lazily created, intended for source control, and excluded from core workflow tracking.
- **Source Document**: An existing core spec artifact (spec, plan, or tasks) that a scratchpad refines. The target of the apply action's direct AI edit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a scratchpad for any of the three core documents and begin editing it in a single action from the empty state.
- **SC-002**: A user can capture notes in a scratchpad and apply them to the matching source document in one action without manually copying content.
- **SC-003**: 100% of apply actions result in a direct edit of the matching source document, with zero cases of template regeneration.
- **SC-004**: The apply action is available only while viewing a scratchpad and never while viewing a source document, across all three document types.
- **SC-005**: After release, none of the removed inline-comment controls or behaviors remain reachable in the spec viewer.
- **SC-006**: Scratchpad files appear in the user's source-control change set by default (are not ignored) and never affect phase transitions or task-completion counts.

## Assumptions

- The three supported scratchpads correspond exactly to the three core documents (spec, plan, tasks); custom-workflow or non-core steps do not produce their own scratchpads in this version.
- Each source document supports at most one scratchpad; multiple scratchpads per source are out of scope.
- The apply action does not clear or modify the scratchpad after a successful dispatch; the scratchpad persists as a durable, committable record for teammate handoff.
- Cross-document refinement (e.g., a spec scratchpad editing the plan document) is not supported; each scratchpad maps only to its own source document.
- The AI does not auto-generate scratchpad content from conversation history; scratchpads are authored by the user.
- Existing ephemeral inline review comments require no migration because they were never persisted.

## Out of Scope

- Multiple scratchpads per source document.
- Custom workflows producing their own scratchpads for non-core steps.
- AI auto-generating a scratchpad based on conversation history.
- Cross-scratchpad refinement (dispatching one document's scratchpad to edit a different source document).
