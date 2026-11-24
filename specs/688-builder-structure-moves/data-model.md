# Data model

Webview-only shapes; nothing is stored.

## MovePlace

A place a node could go, from `movePlaces(step, nodeId)`.

- `id`: `up`, `down` or `phase:<name>`, the action the popover already sends.
- `label`: "Up, above <name>", "Down, below <name>", "To phase <name>, first|last".
- `refused`: the reason the writer would give, or empty when legal.
- `held`: lock rows naming a held neighbour, shown under the places.

Rules: a place is refused when the resulting order puts a node the moved one reads after it, puts a node that reads it before it, or changes a held node's place. A held moved node offers no places.

## RemovedRow

`{ step, phase, index, nodeId, name }`, set when a removal is sent. Drawn while the status's `undo.token` is `remove:<step>:<nodeId>`; cleared by any other status or by Undo.

## AddMode

`'hook' | 'node' | 'step'`, the modal's choice row. Absent when editing a hook.
