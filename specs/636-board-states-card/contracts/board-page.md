# Contract: the board page

What a page test of the Copilot app board codes against. The board adds no API, no CLI and no schema.

## Asset route

| Route | Served from | Content type |
|---|---|---|
| `/states-select.mjs` | `vendor/states-select.mjs` | `text/javascript; charset=utf-8` |

The page imports `setupStatesSelect` from this route and calls it once, on load. The listener is on the document, so it survives every redraw.

## States card

| Selector | What a test does with it |
|---|---|
| `.states-card` | Finds one card. Picking in one card leaves every other card alone. |
| `button.states-state[data-state]` | Clicks it to pick a state. `data-state` is the state's index, from 0. |
| `.is-selected` | Reads it. Exactly one `.states-state` per card has it: the picked one. |
| `aria-pressed` | Reads it. `"true"` on the picked button, `"false"` on the rest. |
| `.states-caption` | Reads it. Visible, and its text is `<name>: <sentence>` of the picked state. |
| `.states-moves` | Reads the one that is a direct child of `.states-card`. Lists the picked state's next moves. Absent when it has none. |
| `.states-shown` | Reads it. Holds the picked state's screen. Absent when it has none. |

Before any click, the start state is the picked one.

## File names

| Selector | What a test reads |
|---|---|
| `.file-ref` | Every one has `disabled` after each draw, so Tab never lands on it. Its cursor is the default and it takes no pointer events. |

## Stays hidden

| Selector | Rule |
|---|---|
| `.calls-strike` | `display: none` on the board. |
| `.line-add-btn` | `display: none` on the board. |
