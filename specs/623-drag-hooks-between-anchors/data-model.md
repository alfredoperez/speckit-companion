# Data Model: Drag a hook between anchors

The configuration file stays the only store. Nothing new is persisted: a move rewrites where an existing entry sits under a step's `hooks`, and every other entity below lives only for the length of one gesture or one write.

## Project hook (reshaped)

One entry under a step's hooks in the project configuration, drawn on the board as a `PipelineHook`.

| Field | Type | Notes |
|---|---|---|
| `when` | `'before' \| 'after'` | The side of the anchor it runs on. |
| `anchor` | string | A node id or a phase name in the step. |
| `index` | number | Its place among the entries at that `when` + `anchor`, zero-based. Order is run order, top to bottom. |
| `type`, `summary`, `note` | unchanged | Content. A move keeps the entry's exact text unless the same write also edits it. |
| `parked` | boolean? | Written by the project but not running because the shipped workflow is in force. A parked hook is read-only to moves. |

**Address**: `(step, when, anchor, index)` identifies one entry. It is only valid against the file the board was drawn from; a stale index is refused by the writer, never guessed.

**Movability**: a hook is movable when it is a project hook and not `parked`. A `StockHook` (registered by a spec-kit extension in `.specify/extensions.yml`) is never movable and never a drop target.

## Hook move (new)

The one writer operation that takes an entry from its old address and puts it at a new one in a single write (`move_hook` in `config_write.py`).

| Field | CLI flag | Type | Notes |
|---|---|---|---|
| step | `--command` | string | Source and target step. Always the same step. |
| from | `--move-from WHEN ANCHOR INDEX` | address | The entry's current place. |
| to side | `--when` | `'before' \| 'after'` | Target side. |
| to anchor | `--anchor` | string | Target node id or phase name. |
| to index | `--to-index N` | number? | The final index after removal. Absent means the end of the target list. |
| boundary | `--boundary node\|phase` | enum | What the drop was made on, so a name shared by a node and a phase cannot resolve to the other one. |
| content | `--hook` + `--ref`/`--run`/`--text` | optional | Present only when the form saves an edit and a new place together. The entry is then re-rendered with that content; otherwise its lines travel verbatim. |

**Validation (writer, against the file and the built plan)**:

- The source index exists at `from.when` + `from.anchor`; otherwise refuse with "there is no hook N".
- The plan loads (`build.load_config` + `build.plan_build`); otherwise refuse with that reason.
- `to.anchor` resolves through `hook_render.resolve_anchor` to something in the step; otherwise refuse.
- The resolved boundary equals `--boundary`; otherwise refuse.
- The shipped workflow is not in force; otherwise refuse with the existing reason.
- `to.index`, when given, is between 0 and the target list's length after removal.

**Write rules**:

- A refusal writes nothing: the file stays byte-identical (SC-002).
- The entry's line and its continuation lines move as one block, re-indented by the difference between the two lists' item indents.
- If the move empties its source anchor, that anchor key and its entries are removed, stopping at `_content_end` so trailing comments and blank lines stay.
- Every other line of the file is unchanged (FR-004, SC-004).
- A move to the same address is a no-op the panel never sends.

## `moveHook` message (new, webview to extension)

Replaces `addHook.movedFrom`, which is removed. `addHook` goes back to adding or editing in place. The exact shape is in [contracts/move-hook.md](./contracts/move-hook.md): `command`, `from: { when, anchor, index }`, `to: { when, anchor, index?, boundary }`, and an optional `hook: { hookType, value, note? }` present only when the form also changed the content.

The extension answers the way every write does: a status with the outcome on success, a notice with the writer's reason on refusal. Either way the board redraws from disk.

## Hook drag payload (new, webview only)

Carried by a drag started on a movable hook row, under its own MIME type `application/x-pb-hook` so node drop handlers (which read `text/plain`) ignore it.

| Field | Type |
|---|---|
| `command` | string |
| `when` | `HookWhen` |
| `anchor` | string |
| `index` | number |

## Drop target (new, webview only)

What the pointer is over during a hook drag, and the target address it produces.

| Target | Resulting `when` / `anchor` | Resulting index | Boundary |
|---|---|---|---|
| Project hook row, upper half | that hook's side and anchor | directly above it | that hook's |
| Project hook row, lower half | that hook's side and anchor | directly below it | that hook's |
| Node card, upper half | `before` that node | end | `node` |
| Node card, lower half | `after` that node | end | `node` |
| Seam | that seam's side and anchor | end | of the seam's anchor |
| Hook block | that block's side and anchor | end | of the block's anchor |
| Phase heading | `before` that phase | end | `phase` |
| Extension or parked hook row | not a target | | |

The index is computed after removing the dragged entry, so a move down the same list does not land one place too far. A drop on the dragged hook itself, or one that computes the same address, sends nothing.

**Panel-side refusals (before any write)**: a drag started on an extension or parked row does not start and the status line names the reason (the registering extension, or that it is parked); a drop in another step's lane is refused with "a hook moves within its own step".

## Order row (new, in the hook form)

Shown for an existing project hook only.

| Control | Enabled when | Disabled reason |
|---|---|---|
| Move up | `index > 0` | already first |
| Move down | `index < count - 1` | already last |

Each press sends one `moveHook` to the same side and anchor with `to.index` one less or one more. Changing the form's Runs fields (side or anchor) and saving sends one `moveHook` with the new place and any content edit.

## State transitions

### A drag on the board

```text
idle ──dragstart on movable row──▶ dragging
idle ──dragstart on extension/parked row──▶ idle  (status line: reason, nothing moves)
dragging ──over valid target──▶ over(target, half)
over ──leave──▶ dragging
over ──drop, same address──▶ idle  (nothing sent)
over ──drop, another lane──▶ idle  (status line: within its own step)
over ──drop, valid──▶ pending  (moveHook sent)
dragging ──dragend without drop──▶ idle
pending ──write answers ok──▶ idle  (board redraws, status line: where it went)
pending ──write refused──▶ idle  (board redraws from disk, status line: reason)
```

### A move from the form

```text
open(index i) ──Move up/down──▶ pending(index i±1, optimistic; further presses ignored)
pending ──write answers ok──▶ open(index i±1)  (live region reads the outcome)
pending ──write refused──▶ open(index i, restored)  (live region reads the reason)
open ──save with new side/anchor──▶ closed  (one moveHook; the status line reads the outcome)
```

Move up and Move down keep the form open on the same hook. Saving at a new place closes it, as every save does. The panel runs its writes one at a time, so a move always reads the file the previous write left. The live region and the status line speak only once the write answers, never on the optimistic step (FR-010). No transition depends on a CSS transition, so reduced motion changes nothing (FR-011).
