# Feature Specification: Fade Create Spec Placeholder

**Feature Branch**: `326-fade-spec-placeholder`
**Created**: 2026-06-15
**Status**: Draft
**Input**: GitHub issue #330 — "fix: Create Spec placeholder is too prominent — make it more faded/grayish"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Empty field reads as guidance, not entered text (Priority: P1)

A person opens the Create Spec page to start a new spec. The description field is empty but shows placeholder guidance about what to type and a sample of helpful context to include. The placeholder appears clearly faded compared to real typed text, so they immediately understand the field is empty and the words are a prompt to fill in — not content they already entered.

**Why this priority**: This is the whole fix. Today the placeholder is painted in the high-contrast color reserved for real content, so an empty field can be mistaken for a filled one, causing confusion at the very first step of creating a spec.

**Independent Test**: Open the Create Spec page with the description field empty and confirm the placeholder text is visibly lighter than what typed text looks like, reading as a hint rather than as entered content.

**Acceptance Scenarios**:

1. **Given** the Create Spec page is open and the description field is empty, **When** the user looks at the field, **Then** the placeholder text appears visibly lighter/grayer than typed content and reads as guidance.
2. **Given** the user begins typing in the description field, **When** real text replaces the placeholder, **Then** the typed text appears in the full-contrast content color, clearly distinct from the faded placeholder.

---

### User Story 2 - Placeholder guidance stays readable on both themes (Priority: P1)

The placeholder intentionally carries teaching content (what context helps, a sample of the kind of links and detail to include). A person on either a light or a dark theme can still comfortably read that guidance — it is faded, but not so faint that it disappears or looks disabled.

**Why this priority**: The placeholder does double duty as instructional copy. Fading it too far would erase the teaching the field relies on, trading one problem for another.

**Independent Test**: View the empty Create Spec field on both a light and a dark theme and confirm the placeholder guidance remains legible in each.

**Acceptance Scenarios**:

1. **Given** a light theme, **When** the description field is empty, **Then** the placeholder guidance is faded yet clearly readable.
2. **Given** a dark theme, **When** the description field is empty, **Then** the placeholder guidance is faded yet clearly readable.

---

### Edge Cases

- The placeholder must not fade so far that it matches the "disabled" appearance, which would wrongly signal the field cannot be used.
- The contrast difference between placeholder and typed text must hold across both light and dark themes — a value that looks faded on one theme but near-content on the other is not acceptable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Create Spec description field's placeholder MUST render in a visibly lighter/grayer treatment than the color used for real typed content.
- **FR-002**: The placeholder MUST remain legible enough to read its instructional guidance on both light and dark themes.
- **FR-003**: The placeholder MUST NOT appear identical to a disabled field, so users can still tell the field is active and ready for input.
- **FR-004**: The fade MUST be achieved by tuning the placeholder's color treatment as a whole, rather than stacking an already-low-contrast color with additional heavy transparency that would push it below readable contrast.
- **FR-005**: If the visual baseline of the empty Create Spec state shifts, the corresponding empty-state visual reference MUST be updated to match.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When shown the empty Create Spec field, users can correctly identify it as empty (placeholder, not entered text) without interacting with it.
- **SC-002**: The placeholder guidance is readable on both light and dark themes, meeting accessibility contrast expectations for placeholder text.
- **SC-003**: Real typed content is visually distinguishable from the placeholder at a glance, with the typed text noticeably darker/higher-contrast.

## Assumptions

- The fix is purely visual: only the placeholder's appearance changes; the placeholder's wording, the field's behavior, and the surrounding Create Spec layout stay the same.
- The existing instructional placeholder copy (the "what context helps" teaching, including the sample links) is retained as-is.
- "Faded but legible" is interpreted as a muted foreground treatment that clearly sits between full-contrast content and the disabled appearance, consistent with how placeholder text conventionally reads across the rest of the product and on both themes.
