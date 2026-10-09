# Research: Plan code block

## Which numbers `hl` and `pin` use

**Decision**: the numbers the card shows. A sketch counts from 1, a citation from `<from>`.
**Rationale**: the reader and the writer look at the same number, and a pin on a citation names the real file line.
**Alternatives considered**: always count from 1. It makes a citation's pin disagree with the gutter beside it.

## How the block reaches its renderer

**Decision**: add `code` to the block names and let the render loop route to it when the language is not itself a block name and the text after it starts with `sketch ` or matches `<file>:<from>-<to>`.
**Rationale**: the registry is keyed by one name, and a code card's language is any language. One extra name keeps the try/catch and the plain-block fallback the seam already gives.
**Alternatives considered**: a second registry for "any language" renderers. One product, so no factory.

## How pins reach the card

**Decision**: the loop collects the run of `pin N: text` lines after the closing fence, after optional blank lines, and puts them on the block context with their plan line numbers. It skips them only when a block was drawn.
**Rationale**: the loop already does this for the calls note. Pins left in place on fallback keep the text readable.
**Alternatives considered**: pins inside the fence body. It would put text that is not code inside the code for every other markdown reader.

## A citation's body and its range

**Decision**: the body must be exactly `to - from + 1` lines. The viewer falls back when it is not, and the check reports an error.
**Rationale**: the viewer cannot read the file, so a wrong count would show wrong line numbers with full confidence.
**Alternatives considered**: number whatever is there. Rejected for the same reason.

## What the check compares

**Decision**: errors for a missing file, a range outside the file, a wrong body length and any grammar fault the viewer falls back on. Warnings for a sketch over 12 lines, more than 3 pins, and cited text that differs from the file once trailing spaces are dropped.
**Rationale**: budgets are warnings for call paths too. Drifted text is a warning because a plan may trim a long line.
**Alternatives considered**: drift as an error. Line numbers go stale as soon as implement edits the file, so it would cry wolf.

## Colour

**Decision**: the highlight and the pinned line take the accent tint, and the pin's edge the accent colour. The badge is outlined.
**Rationale**: the design notes keep green, amber, red and purple for new, changed, removed and picked. A note is none of those.
**Alternatives considered**: amber, the usual highlight colour. It already means changed.

## Comment anchors

**Decision**: the host's block extractor treats a line inside a code card fence, and a `pin` line, as a block of one line.
**Rationale**: without it a comment on one code line would quote the whole paragraph run around it.
**Alternatives considered**: every fence. Ordinary fences have no line comments, so there is nothing to change there.
