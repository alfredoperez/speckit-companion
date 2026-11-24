# Research: builder card and node popover

## Where the status comes from

**Decision**: A pure `hookStatus(step, hook, runs)` in a new `hookStatus.ts` returns `{ word, tone, reason }` or null. Problem first, then the run record matched by `${step}/${when}/${anchor}/${index}`.
**Rationale**: One derivation read by both the card and the popover, so the two cannot disagree.
**Alternatives considered**: Computing it inside each row; two copies would drift.

## When to ask for the run record

**Decision**: The webview posts `readHookRuns` each time a `graph` message arrives, and keeps the last `hookRuns` answer in state.
**Rationale**: A graph arrives on open and after every write, which is when the run record can have changed; the host already answers the message.
**Alternatives considered**: A file watcher on the host; needs a protocol change this slice rules out.

## Popover placement

**Decision**: The popover renders inside the builder root with `position: fixed`, placed beside the card's bounding box on whichever side has room, and re-placed on scroll and resize. Under 640px of builder width it renders as a bottom sheet with a scrim.
**Rationale**: Lanes clip their overflow and scroll sideways; a fixed layer escapes both. 640px is the width the lanes already stack at.
**Alternatives considered**: Absolutely positioned inside the lane; clipped at the lane edge.

## What "Edit node" opens

**Decision**: The existing instructions pane (`Inspector`) in the side column, which keeps the read, edit and save of a node's instructions.
**Rationale**: Editing a body needs room a popover does not have; every other action moves into the popover's More menu.
**Alternatives considered**: An inline textarea in the popover; cramped and duplicates the pane.

## Source grouping of hooks

**Decision**: The card drops the per-source group headings. Another extension's hook shows its source mark as its icon and keeps its title; your own hooks say whose they are in the popover ("Yours, in companion.yml").
**Rationale**: The picked design rows are icon, name, status; the source is detail.
**Alternatives considered**: Keep group headings inside the card slots; the design rejects them.
