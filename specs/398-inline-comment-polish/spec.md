# Feature Specification: Inline comments that annotate, not interrupt

**Feature Branch**: `398-inline-comment-polish`
**Created**: 2026-07-14
**Status**: Draft
**Input**: Issue #433 — Make the inline-comment experience feel good (style + UX)

## Overview

Reviewers can already leave a comment on any line of a spec document: hover the line, click the plus, type, and the comment is saved with the spec, comes back when the spec is reopened, and can be handed to the AI as a refinement. The mechanics work. The presentation does not: every saved comment renders as a full-width strip planted in the middle of the document, with an icon, the whole comment, and a delete cross that never goes away. Five comments on a page means five permanent interruptions, and each one shouts louder than the line it is talking about.

This feature is a presentation and interaction pass over the comments that already exist. It does not add review conversations — there are no replies, no resolve, no avatars, no separate composer. There is one author reviewing their own spec, and the comment should read like a margin note: quiet by default, complete when asked for, and obvious about whether it has been acted on.

## User Scenarios & Testing

### User Story 1 - A commented line reads as annotated, not interrupted (Priority: P1)

A reviewer reads a spec that already carries several comments. Each commented line still reads as the primary thing on the page: underneath it sits a single quiet line — a small state glyph, the beginning of the comment, and a word for its state — that stays visually subordinate to the document text. Scrolling the document is still reading the document, not wading through review furniture.

**Why this priority**: This is the whole complaint in the issue. If comments still outweigh the lines they annotate, nothing else matters.

**Independent Test**: Open a spec with three or more saved comments across the page. The document remains readable top to bottom; each comment occupies one quiet line and never a full card, and no comment carries a permanently visible delete control.

**Acceptance Scenarios**:

1. **Given** a document line with a saved comment, **When** the document renders, **Then** the comment appears as a single-line annotation beneath the line, with no border, on a quiet neutral surface, and its text is truncated with an ellipsis rather than wrapping.
2. **Given** a commented line, **When** the reviewer is not interacting with the annotation, **Then** the annotation carries no accent colour and no delete control.
3. **Given** a document with several commented lines, **When** the reviewer scans the page, **Then** each comment adds exactly one line of height to the document.
4. **Given** a comment whose text is longer than the available width, **When** it is collapsed, **Then** the text truncates on one line and does not wrap or expand the row.

### User Story 2 - Open a comment to read it, act on it, or change it (Priority: P1)

The reviewer clicks (or tabs to and presses Enter on) an annotation. It opens in place: the full comment text, readable at body weight, and a row of actions — hand this document's comments to the AI, edit this comment, delete this comment. Clicking again closes it. Nothing is hidden behind a hover-only affordance.

**Why this priority**: Collapsing the comment is only acceptable if the full text and every action are one obvious, keyboard-reachable step away. Without this, story 1 hides information instead of quieting it.

**Independent Test**: Tab to an annotation with the keyboard, press Enter, read the full comment, use the Edit action to change the text, reopen the spec, and confirm the edited text persisted.

**Acceptance Scenarios**:

1. **Given** a collapsed annotation, **When** the reviewer clicks it or focuses it and presses Enter or Space, **Then** it expands in place to show the complete comment text and an action row.
2. **Given** an expanded annotation, **When** the reviewer activates it again, **Then** it collapses back to one line.
3. **Given** an expanded annotation, **When** a screen reader reads it, **Then** the control announces that it is a comment, its state, and whether it is expanded or collapsed.
4. **Given** an expanded pending annotation, **When** the reviewer chooses Edit, **Then** the existing comment composer opens pre-filled with the current text, and saving replaces the comment's text while keeping it the same comment.
5. **Given** an expanded annotation, **When** the reviewer chooses Delete, **Then** the comment is removed from the document and from the saved spec, and does not return on reopen.
6. **Given** an expanded pending annotation, **When** the reviewer chooses Refine, **Then** this document's pending comments are handed to the AI — the same hand-off the footer button performs.

### User Story 3 - Pending and applied are legible at a glance (Priority: P2)

A comment that has not yet been handed to the AI looks live: it carries an accent-tinted rail and reads "Pending". A comment the AI has already been asked to act on looks settled: a check glyph, a muted rail, and the word "Applied". Applied comments stay visible on their line as a record of what was asked, but they never advertise themselves as work outstanding, and they are not counted in the Refine badge.

**Why this priority**: Valuable, but the reviewer can still work if the two states share one look. It rides on the annotation built in stories 1 and 2.

**Independent Test**: Leave two comments, run Refine, and confirm both flip from pending to applied on their lines without a reopen, and the Refine count drops to zero.

**Acceptance Scenarios**:

1. **Given** a pending comment, **When** it renders, **Then** it shows a pending state label and an accent-tinted rail.
2. **Given** an applied comment, **When** it renders, **Then** it shows a check glyph, an applied state label, and a muted rail.
3. **Given** a document with two pending comments, **When** the reviewer runs Refine, **Then** both comments render as applied and the Refine badge no longer counts them.
4. **Given** a spec with applied comments, **When** the spec is reopened, **Then** the applied comments are restored on their lines in the collapsed, quiet state, alongside any pending ones.
5. **Given** an applied comment, **When** it is expanded, **Then** it offers Edit and Delete but not Refine.

### User Story 4 - Adding a comment is reachable without a mouse (Priority: P3)

The plus control that starts a comment only appears when a line is hovered. A keyboard user tabs through the document; when the plus takes focus it becomes visible, and pressing Enter opens the composer on that line.

**Why this priority**: An accessibility gap that predates this feature; small, contained, and worth closing while the same surface is open.

**Independent Test**: With the mouse untouched, tab through a rendered spec document and confirm a visible focus ring lands on a line's plus control and that activating it opens the composer.

**Acceptance Scenarios**:

1. **Given** a rendered document, **When** a line's add control receives keyboard focus, **Then** it becomes visible with a focus indicator.
2. **Given** a focused add control, **When** the reviewer presses Enter, **Then** the comment composer opens on that line.

### User Story 5 - The consolidated review list speaks the same language (Priority: P3)

The Overview's Review comments card lists every comment across the spec's documents. It uses the same quiet vocabulary as the inline annotations — status as a small chip, comment text at body weight — so the two surfaces read as one system rather than two.

**Why this priority**: Consistency payoff, not a blocker. The card already works.

**Independent Test**: Open the Overview on a spec with comments in more than one document; each row's state chip matches the inline annotation's state vocabulary.

**Acceptance Scenarios**:

1. **Given** the Overview with saved comments, **When** the Review comments card renders, **Then** each comment's status reads as a small chip in the same colour language as the inline annotation.
2. **Given** a comment's text in the card, **When** it renders, **Then** it is set at readable body weight, not metadata weight.

## Edge Cases

- A comment whose text is a single very long word with no spaces must still truncate on one line collapsed and wrap safely expanded, without pushing the document sideways.
- A comment whose text contains angle brackets, quotes, or anything that looks like markup must be shown literally as characters. It must never be interpreted as markup, in the comment body or in any label, tooltip, or accessible name derived from it.
- Deleting the last comment on a line must leave that line indistinguishable from a line that never had one.
- Editing a comment to empty text must be treated as no change rather than saving a blank comment.
- A comment whose anchor line has drifted since it was written must still restore, exactly as it does today.
- Two comments on the same line must both render, each independently expandable.
- On a spec that is completed or archived, comments must remain readable but the actions that change them stay unavailable, as they are today.

## Requirements

### Functional Requirements

- **FR-001**: A saved comment MUST render on its line as a collapsed single-line annotation by default, showing a state glyph, the comment text truncated to one line, and a state label.
- **FR-002**: The collapsed annotation MUST NOT carry a border, and MUST sit on the same quiet neutral surface vocabulary the viewer already uses for inline code and file references, taking on accent colour only on hover or focus.
- **FR-003**: The annotation MUST be a real, focusable control that expands and collapses on click, Enter, or Space, and MUST expose its expanded state to assistive technology.
- **FR-004**: Expanding an annotation MUST reveal the complete comment text at readable body weight and an action row.
- **FR-005**: The action row MUST offer Delete and Edit for any comment, and Refine for a pending comment; no delete control may be permanently visible on a collapsed annotation.
- **FR-006**: Refine from the action row MUST perform the same hand-off as the footer's Refine control for that document's pending comments.
- **FR-007**: Edit MUST open the existing comment composer pre-filled with the comment's current text, and saving MUST update that same comment's text in the saved spec, preserving its identity and creation time.
- **FR-008**: An edit submitted with empty or unchanged text MUST leave the comment untouched.
- **FR-009**: A pending comment MUST be visually distinguished from an applied comment by state label, glyph, and rail treatment.
- **FR-010**: Applied comments MUST be restored on their lines when a spec is reopened, in the collapsed quiet state, and MUST NOT be counted by the Refine badge.
- **FR-011**: Pending comments MUST continue to restore on reopen exactly as they do today, including when the anchor line has drifted.
- **FR-012**: Adding, deleting, and refining comments MUST continue to save to the spec's stored context and survive a reopen; this feature MUST NOT change how add, delete, or refine are stored.
- **FR-013**: Comment text MUST be rendered as literal text everywhere it appears — body, label, accessible name, or title — and MUST never be able to introduce markup or script.
- **FR-014**: A line's add control MUST become visible when it receives keyboard focus, and MUST open the composer when activated from the keyboard.
- **FR-015**: The Overview's Review comments card MUST present each comment's status as a chip in the same state vocabulary as the inline annotation, and its text at readable body weight.
- **FR-016**: On a completed or archived spec, comment annotations MUST remain readable while the actions that mutate them remain unavailable.

### Key Entities

- **Review comment**: a note a reviewer left on one line of one spec document. It carries its own identity, the document it belongs to, an anchor describing where it was written, the comment text, a state (pending or applied), and when it was created. Its stored shape is unchanged by this feature except that its text can now be revised in place.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A collapsed comment adds no more than one line of height to the document it annotates, regardless of how long the comment is.
- **SC-002**: A document carrying five comments remains scannable: no comment occupies more vertical space than the line it annotates while collapsed.
- **SC-003**: Every comment action — read in full, refine, edit, delete — is reachable using only the keyboard, in no more than two key presses from the annotation receiving focus.
- **SC-004**: A reviewer can tell pending from applied without opening a comment, in a single glance, from the state label and glyph alone.
- **SC-005**: Comment text containing markup-like characters renders as those literal characters in 100% of surfaces that display it, and introduces no elements or scripts into the page.
- **SC-006**: Comments saved before this change are restored on reopen with no loss, at the same rate as today.

## Assumptions

- Applied comments are worth keeping on the line as a record; they are shown, quietly, rather than hidden. A reviewer who wants one gone can delete it.
- Edit is a text revision of the same comment, not a new comment. The comment keeps its identity, anchor, creation time, and state.
- Refine from an expanded comment dispatches the whole document's pending comments — the same batch the footer sends — rather than that comment alone. Comments are handed to the AI as a document-level batch today, and splitting that is out of scope.
- The comment composer keeps its current shape; edit reuses it with the text pre-filled rather than introducing a second editor.

## Verbatim Constraints

- Neutral surface for the quiet annotation, matching the existing inline-code and file-reference vocabulary: `color-mix(in srgb, var(--text-muted) 12%, transparent)`
- Readable comment text uses `--text-body` or `--text-primary`, never `--text-secondary` or `--text-muted`
- Truncation requires the full trio — `white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis` — plus `min-width: 0` on the flexible child
- Anything referenced by `aria-describedby` or `aria-labelledby` uses `.sr-only`, never `hidden` or `display: none`
