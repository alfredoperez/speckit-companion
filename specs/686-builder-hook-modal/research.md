# Research

## Where the modal lives in state

**Decision**: keep `side.kind === 'attach'` as the modal's state and stop it from opening the side column.
**Rationale**: the keyboard-move rollback and the drag guard already read that state; moving it would re-plumb both.
**Alternatives considered**: a separate `modal` state, rejected because the move rollback would need a second copy.

## Seams versus edge buttons

**Decision**: replace the dashed seams between nodes with "+ before" / "+ after" buttons on each node's edges, hidden until the card is hovered or holds focus, always in the Tab order, and always shown where the device has no hover.
**Rationale**: the design puts the place on the node itself; one gap no longer needs two anchors drawn, since each button names its side.
**Alternatives considered**: keeping the seams beside the buttons, rejected as two controls for one job.

## Result list keyboard model

**Decision**: a combobox: the input keeps focus, `aria-activedescendant` points at the highlighted option, Up and Down move it, Enter adds it.
**Rationale**: the design says "Up and down move · Enter adds"; focus never leaves the field, so typing goes on working.
**Alternatives considered**: roving focus through the rows, rejected because typing would need the focus moved back.

## The place inside the modal

**Decision**: keep the When and Where menus as a quiet "Runs before <place>" line under the field.
**Rationale**: the side form let you change the place, and the slice must not lose behaviour.
**Alternatives considered**: a fixed place, rejected as a lost action.
