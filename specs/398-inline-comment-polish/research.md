# Phase 0 Research: Inline comments that annotate, not interrupt

## Decision 1 — Where the comment body lives

**Decision**: The comment collapses to a single quiet line in the existing `.line-comment-slot`, and expands in place on click / Enter / Space via a real `<button>` carrying `aria-expanded`. The body is not hover-revealed, not moved to a gutter, and not moved to a popover.

**Rationale**: Density is the complaint — N comments must not mean N permanent cards. Collapsing is the only treatment that makes a comment cost one line regardless of its length. Expanding *in place* keeps the comment anchored to the line it annotates, which a gutter or popover would break. A `<button>` gets the keyboard path, the focus ring, and the screen-reader disclosure semantics for free; a `div` with a click handler would need all three bolted on.

**Alternatives considered**:
- *Hover-reveal the body*: rejected — an interaction that exists only on hover is not discoverable and has no keyboard path.
- *Gutter marker + side panel*: rejected — decouples the comment from its line and duplicates the Overview's Review comments card, which already is the consolidated list.
- *Keep the card, just restyle it*: rejected — restyling a full-width card still costs multiple lines per comment, so it does not solve density. (Spec 394 already shipped the restyle-only version; the issue is that it was not enough.)

## Decision 2 — How edit persists

**Decision**: A new `editComment` message and a new pure `editComment(ctx, id, text)` helper in `reviewComments.ts`, mutating only the comment's `comment` field. Add / remove / refine are untouched.

**Rationale**: The alternative — delete then re-add — mints a new id, loses `createdAt`, resets an applied comment to pending, and costs two serialized writes. A field-level update is one mutation through the same `persistCommentMutation` queue every other comment write already uses, so it inherits the queue's serialization and the "only `specContextWriter` writes" rule for free. It is additive: nothing existing changes shape.

**Alternatives considered**:
- *Remove + add*: rejected for the identity and status loss above.
- *No edit at all*: rejected — the issue names editing explicitly, and a comment you can only delete and retype is a worse experience than the one being replaced.

## Decision 3 — Do applied comments show inline?

**Decision**: Yes. `restoreComments` stops filtering on `status === 'pending'` and mounts applied comments too, in the collapsed quiet state. They are excluded from the Refine count, which continues to be driven by pending comments only.

**Rationale**: "Pending vs applied legible at a glance" is meaningless if only one of the two states ever appears on a line. Showing an applied comment where it was made turns the line into a record of what was asked for, which is the actual value of keeping applied comments as history. The density cost is one quiet line, and the reviewer can delete any they no longer want.

The Refine badge must stay pending-only, which means the `pendingRefinements` signal — which drives that badge — must keep holding pending comments only. Applied comments are therefore mounted without entering that signal, and tracked in the same mount map so cleanup still finds them.

**Alternatives considered**:
- *Applied comments live only in the Overview card*: rejected — the pending/applied distinction then never appears on the surface the issue is about.
- *Applied comments counted in the Refine badge*: rejected — it would re-dispatch work already done and misreport outstanding review.

## Decision 4 — Where Refine surfaces

**Decision**: The expanded action row of a *pending* comment offers Refine, which dispatches that document's pending comments — the same `runDocRefinement` batch the footer button and the Overview card already send. An applied comment's action row offers Edit and Delete only.

**Rationale**: The issue asks for the hand-off to be obvious from the comment itself. Reusing `runDocRefinement` keeps one dispatch path; inventing a per-comment refinement would fork the dispatch semantics for a benefit nobody asked for. Offering Refine on an applied comment would invite re-dispatching work already done.

**Alternatives considered**:
- *Per-comment refinement dispatch*: rejected — comments are handed to the AI as a document-level batch today; splitting that is a behavioral change well beyond a styling pass.

## Decision 5 — The visual vocabulary

**Decision**: Reuse the treatment the viewer already applies to inline code spans (`_typography.css`) and file-reference chips (`_code.css`): a `color-mix(in srgb, var(--text-muted) 12%, transparent)` surface, no border, text in `--text-body`, and accent picked up only on `:hover` / `:focus-visible`. State is carried by a 2px left rail — accent-tinted when pending, muted when applied — plus a codicon glyph and a one-word state label.

**Rationale**: The viewer solved exactly this over-shouting problem for those two elements one release ago. A third invented visual language for the same problem would read as inconsistency, not design. The left rail is the cheapest state channel that survives truncation, and it is redundant with the glyph and the text label so the state is not carried by colour alone.

**Alternatives considered**:
- *A coloured badge per state*: rejected — a badge is exactly the shouting element the issue is asking us to remove.
