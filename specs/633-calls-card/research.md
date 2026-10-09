# Research

## Row source lines
**Decision**: the renderer hands the block the source line of the first body row; rows are consecutive, so row N is first + its index in the body.
**Rationale**: the loop already holds `sourceLineOf`, and blank body lines keep their index so numbering stays true.
**Alternatives considered**: renumbering after render (loses survival across re-render).

## The note
**Decision**: the renderer looks at the lines straight after the closing fence (blank lines allowed, as the check script allows), passes the `note:` text in, and skips that line when the card rendered. A fallback leaves the note as ordinary text.
**Rationale**: the card owns the footer; the check script counts one note line.
**Alternatives considered**: a post-pass removing the note paragraph (fragile).

## File chip
**Decision**: lift the chip markup built inside `parseInline` into one exported helper that both call.
**Rationale**: one validation path, no second copy to drift.
**Alternatives considered**: calling `parseInline` on a backticked path (works but goes through emphasis and link passes first).

## Strike state
**Decision**: the strike handler checks the mounted comments for the row's line and the fixed text before posting; a row is drawn struck from the same check on mount and on restore.
**Rationale**: reuses the comment store as the single source of truth.
**Alternatives considered**: a separate struck set (would drift from the host).

## Host anchor
**Decision**: in `extractBlock`, if the line sits inside a fence whose info starts with `calls`, return that single line with the nearest heading above the fence.
**Rationale**: a fence body has no blank-line boundaries, so the paragraph walk would take the whole fence.
**Alternatives considered**: fence-aware for every language (changes existing behaviour).
