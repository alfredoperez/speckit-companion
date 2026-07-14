# Feature Specification: Open a spec from its name in the Specs tree

**Feature Branch**: `397-open-spec-overview`
**Created**: 2026-07-14
**Status**: Draft
**Input**: Issue #434 — "Clicking a spec's name should open its Overview"

## User Scenarios & Testing

### User Story 1 - Click a spec's name and land on its Overview (Priority: P1)

A developer scanning the Specs sidebar wants to know what a spec is about and how its run went. Today the spec's name is inert: clicking it only opens and closes the row. They have to guess which document to open, click into it, and then find the Overview from inside the viewer. Instead, clicking the spec's name should open that spec in the viewer, landing on the Overview — the dossier that answers why the spec exists, what constrained it, what was verified, which decisions were made, and how requirements map to tests.

**Why this priority**: This is the whole point of the issue. The name is the most obvious thing to click and it is the one thing in the tree that does nothing.

**Independent Test**: Open the sidebar, click the name of a spec that has a recorded run. The viewer opens for that spec showing the Overview.

**Acceptance Scenarios**:

1. **Given** a spec with a recorded run (it carries durable context), **When** the developer clicks its name in the Specs tree, **Then** the spec viewer opens for that spec and shows the Overview.
2. **Given** the viewer is already open for that spec on one of its documents, **When** the developer clicks the spec's name in the tree, **Then** the existing panel is revealed and returns to the Overview rather than opening a second panel.
3. **Given** the developer clicks a spec's name, **When** the viewer opens, **Then** the row also expands so its documents are visible underneath.

### User Story 2 - A spec with no recorded run still opens (Priority: P1)

A brand-new spec — one that was created but never run through the pipeline — has no Overview to show, because there is nothing recorded yet. Clicking its name must still open it, on its first available document, exactly as the viewer already behaves when it has nothing to land on.

**Why this priority**: Without this, the most common early state of a spec (just specified, nothing captured) would open onto an empty page or fail to open at all.

**Independent Test**: Click the name of a freshly-created spec with only a specification document and no recorded run. The viewer opens showing that document.

**Acceptance Scenarios**:

1. **Given** a spec with no recorded run, **When** the developer clicks its name, **Then** the viewer opens on the spec's first available document.
2. **Given** a spec whose first pipeline document was never written but a later one was, **When** the developer clicks its name, **Then** the viewer opens on the first document that actually exists.
3. **Given** a spec folder with no documents at all, **When** the developer clicks its name, **Then** the viewer opens without error and shows its usual empty state.

### User Story 3 - Browsing a spec's documents without opening the viewer (Priority: P2)

A developer who only wants to see which documents a spec has — without a viewer panel taking over the editor — can still expand the row from its chevron. Clicking the name is the "open it" action; clicking the chevron is the "just peek" action.

**Why this priority**: It preserves the low-cost browse that the sidebar redesign introduced when spec rows started collapsed, so the new open action never becomes a trap.

**Independent Test**: Click the chevron on a collapsed spec row. The row expands and no viewer panel opens.

**Acceptance Scenarios**:

1. **Given** a collapsed spec row, **When** the developer clicks the chevron, **Then** the row expands and no viewer opens.
2. **Given** an expanded spec row, **When** the developer clicks the chevron, **Then** the row collapses and no viewer opens.

## Edge Cases

- A spec with no recorded run: no Overview exists — the viewer must land on a document instead.
- A spec whose folder holds no readable documents: opening must not fail; the viewer's existing empty state stands in.
- The viewer is already open for that spec on a document the developer navigated to inside the panel: the name click must bring it back to the Overview, not silently reveal the old view.
- Two specs with the same folder name in different spec roots: clicking either name must open the one that was clicked.
- Repeated clicks on the same spec name: each click lands on the Overview again; no second panel, no error.

## Requirements

### Functional Requirements

- **FR-001**: Clicking a spec's name in the Specs tree MUST open the spec viewer for that spec.
- **FR-002**: When the spec has a recorded run, the viewer MUST land on the Overview.
- **FR-003**: When the spec has no recorded run, the viewer MUST land on the spec's first available document.
- **FR-004**: The tree MUST NOT decide by itself whether a spec has an Overview — the Overview-versus-document landing decision, and the choice of which document is "first available", MUST remain owned by the viewer, with the tree deferring to them.
- **FR-005**: Clicking a spec's name MUST reveal the spec's existing viewer panel when one is already open, rather than opening a second panel for the same spec.
- **FR-006**: Clicking a spec's name MUST also expand or collapse the row, so the documents remain reachable in the same click; the chevron MUST remain able to expand the row without opening the viewer.
- **FR-007**: Opening a spec that has no documents at all MUST NOT produce an error.
- **FR-008**: The change MUST NOT alter or remove any existing command, view, or setting identifier, and document rows MUST keep opening their own document exactly as they do today.

### Key Entities

- **Spec row**: the tree row bearing the spec's name; owns the spec's folder location and its lifecycle status. Gains an open action.
- **Spec viewer panel**: one panel per spec; already knows how to pick what to show when it opens, and already renders the Overview when the spec has one.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Opening a spec's Overview from the sidebar takes 1 click, down from 2 (open a document, then pick Overview).
- **SC-002**: 100% of specs with a recorded run land on the Overview when their name is clicked.
- **SC-003**: 100% of specs without a recorded run open on a document instead of an empty Overview.
- **SC-004**: Zero specs fail to open from the tree, including specs with no documents.
- **SC-005**: The rule that decides Overview-versus-document exists in exactly one place in the product.

## Assumptions

- **Clicking the name both opens the viewer and toggles the row.** The tree fires a row's command and toggles its expansion on the same click, and the two cannot be separated. Rather than fight that, the click means "open this spec, and show me what's in it", which matches how the editor's own Testing view behaves for a row that has both children and a file to open. The chevron stays available as the browse-only affordance for anyone who wants the documents without the panel. The alternative — removing the children from the row so the name only opens — would cost the tree its document rows, which are the sidebar's main navigation.
- A spec that recorded only a work log (steps ran, but nothing durable was captured) is treated by the viewer as "has an Overview but not worth landing on"; the name click inherits that judgement rather than second-guessing it.

## Verbatim Constraints

- The tree must not re-derive: `showingOverview` (the viewer's landing rule) and the viewer's existing first-available-document fallback stay the single owners of the decision.
