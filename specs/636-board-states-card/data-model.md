# Data Model: Plan cards that respond on the Copilot app board

This feature stores no data. Nothing is persisted: no file, no setting, no `.spec-context.json` field, no browser storage. The one entity is the view state of a states card, and it lives only in the page's DOM.

## Entity: states card view state

One per `.states-card` on the page. It answers one question: which state is picked.

| Field | Where it lives | Value |
|---|---|---|
| Picked state | `is-selected` class on one `.states-state` button | The button whose `data-state` index is picked |
| Pressed flag | `aria-pressed` on every `.states-state` button | `"true"` on the picked one, `"false"` on the rest |
| Caption | `.states-caption` | A `<strong>` with the state's name, then `: ` and its sentence |
| Outgoing edges | `data-out="true"` on `.states-edge` groups | Set where `data-from` equals the picked index, removed elsewhere |
| Copied moves | A `.states-moves` element that is a direct child of the card, placed after the caption | A clone of the picked state's moves, absent when it has none |
| Copied screen | A `.states-shown` row, placed after the moves or the caption | A clone of the picked state's screen frame, absent when it has none |

## Sources the view state reads

These are drawn once by the renderer and never change. The picking code only reads them.

- `.states-list li[data-state="N"]` holds each state's `.states-list-name`, `.states-sentence` and, when it has moves, a `.states-moves`.
- `.states-screens > [data-state="N"]` holds the hidden screen frame for each state that names a screen.
- `.states-edge[data-from="N"]` marks which state each arrow leaves.

## Relationships

- A card owns its view state. Every lookup starts from `button.closest('.states-card')`, so two cards on one page never touch each other.
- The view state points at one state by index. That index is the `data-state` shared by the button, the list item and the screen frame.

## Validation rules

- Exactly one `.states-state` per card carries `is-selected` and `aria-pressed="true"` (FR-002).
- The caption always shows the picked state's name and sentence (FR-001, SC-001).
- The copied moves and the copied screen appear only when the picked state has them, and the copies from the state picked before are removed first (FR-003).
- A click on a button with no `data-state`, or outside a `.states-card`, changes nothing.
- The board and VS Code run the same `selectState`, so the rules above hold in both (FR-004, SC-002).

## State transitions

| From | Event | To |
|---|---|---|
| Drawn | The renderer writes the card | The start state is picked: it has `is-selected`, `aria-pressed="true"`, the caption, its edges marked `data-out`, and its moves and screen |
| State A picked | Click on state B's button | State B picked: A loses `is-selected` and its `data-out` edges, the caption, moves and screen are replaced with B's |
| State A picked | Click on state A's button | State A picked, redrawn the same |
| Any state picked | The board redraws the document | Drawn again, back on the start state |

The redraw replaces the whole document panel, so the pick is lost and the card returns to its start state. The click listener is on the document and added once, so picking keeps working on the redrawn card (FR-005).

## Not part of this model

File names (`.file-ref`) hold no state. The board sets `disabled` on each one after a draw and that is all (FR-006).
