# Research: Plan cards that respond on the Copilot app board

## How the board gets the picking code

**Decision**: bundle `apps/vscode/webview/src/spec-viewer/editor/statesSelect.ts` into `apps/copilot-canvas/vendor/states-select.mjs` and import it from `public/app.js`.

**Rationale**: the file has no imports and touches only the page, so it bundles as it stands. The board already vendors the renderer and the styles this way, and CI already fails when a vendored file is stale.

**Alternatives considered**: moving the file to a shared folder, as the issue suggested. Not needed, since the build can read it in place. Copying the function into `app.js` was rejected: two copies drift.

## Where the listener is added

**Decision**: call `setupStatesSelect()` once when the page loads.

**Rationale**: it listens on the document, and the board replaces the whole document panel on every redraw. A per-draw call would stack listeners.

## Making a file name inert

**Decision**: after each draw set `disabled` on every `.file-ref`, and in CSS give it a default cursor and no pointer events.

**Rationale**: CSS cannot take a button out of the tab order. `disabled` does, and stops the click. Turning off pointer events stops the hover colour. The chip keeps its look as a name.

**Alternatives considered**: replacing the button with a span in the renderer. Rejected: the renderer is shared, and VS Code needs the button.

## Comment and strike

**Decision**: leave them hidden, as `public/styles.css` already does.

**Rationale**: the owner chose hiding over support.

## The picture

**Decision**: no new screenshot in this change. A page test covers the behaviour.

**Rationale**: pictures are taken once, in release QA.
