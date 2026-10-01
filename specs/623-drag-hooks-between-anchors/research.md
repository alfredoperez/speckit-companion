# Research: Drag a hook between anchors

## One writer operation for a move

**Decision**: add `move_hook` to `config_write.py`, invoked as `--move-from WHEN ANCHOR INDEX` plus `--when`/`--anchor` for the target, optional `--to-index N` (absent means the end) and `--boundary node|phase`. With `--hook` and its fields present, the moved entry is re-rendered with that content in the same write.
**Rationale**: today's move is a removal and an addition as two writes, so a refused addition leaves the hook gone. One computed text and one `save_config` makes a refusal leave the file byte-identical.
**Alternatives considered**: keep two writes and roll back on failure (a second write can fail too); a webview-side whole-list rewrite (the writer would lose the entry's own text and comments).

## The entry travels verbatim

**Decision**: the moved entry's line and its continuation lines move as they are, re-indented by the difference between the two lists' item indents. Only a move that also edits the content re-renders it.
**Rationale**: FR-004 and the release requirement that a setting written back leaves the rest of the file as written.
**Alternatives considered**: re-render through `_hook_line` (rewrites quoting and any block-style entry).

## An anchor the move empties

**Decision**: remove the emptied anchor key and its entries only, stopping at `_content_end` so comments and blank lines that trail it stay.
**Rationale**: `replace_hook` uses `_block_end` and can eat a trailing comment; a move must not.

## Validating the target

**Decision**: load the plan the way `pipeline-graph.py` does (`build.load_config`, `build.plan_build`) and resolve the target through `hook_render.resolve_anchor`. Refuse when it resolves to nothing, or to a boundary other than `--boundary`. If the plan cannot be read, refuse the move with that reason.
**Rationale**: the board draws from that same plan, so the writer refuses exactly what the board could not draw. A move of a board-drawn hook only happens when the plan read, so refusing on an unreadable plan costs nothing.
**Alternatives considered**: let it through like other unreadable-file checks (a hook at an unknown anchor is silently skipped at build time).

## Drag payload

**Decision**: a hook drag carries a JSON payload under its own MIME type, `application/x-pb-hook`, holding the step, side, anchor and index. Node drop handlers keep reading `text/plain` and ignore hook drags.
**Rationale**: `text/plain` already carries node ids; sharing it would let a hook drop reorder nodes.

## Where a drop lands

**Decision**: a project hook row or a node card takes the half the pointer is over (before/above or after/below). A seam or a hook block appends to that anchor and side. A phase heading appends before the phase. The index sent is the final index after removal.
**Rationale**: every anchor on the board then has a target, and order within a list is reachable in both directions.

## Keyboard path

**Decision**: the hook form gains an Order row with Move up and Move down, disabled with their reason at the edges. Another anchor stays the form's Runs fields. The form stays open on the hook after a move, its index updated optimistically and put back when the write is refused.
**Rationale**: the issue asks to extend the existing pattern, not invent a second one; the inspector's Order row is that pattern.
