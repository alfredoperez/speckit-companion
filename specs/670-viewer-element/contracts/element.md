# Contract: `speckit-viewer` package entries

## `speckit-viewer/contract`

- `type ViewerAction` (= `ViewerToExtensionMessage`)

## `speckit-viewer/view` (Preact)

- `App`, the components, `signals`, `ViewerSlots` context
- `onAction(action: ViewerAction): void`
- `setActionHandler(handler: ((action: ViewerAction) => void) | null): void`

## `speckit-viewer/element`

Importing it registers the custom element `speckit-viewer` (once; a second import is a no-op).

```html
<speckit-viewer>
  <div slot="actions">host buttons</div>
</speckit-viewer>
```

Properties: `record`, `documents`, `currentDoc`, `content`, `landing`, `live`, plus optional `taskCounts`.

Event: `speckit-action`, bubbles, composed, `detail: ViewerAction`. After a `stepperClick` or `switchDocument`, `currentDoc` already holds the new type; the host answers by setting `content`.

Slot: children with `slot="actions"` render above the rail and the document.

## `speckit-viewer/styles/*`

- `viewer.css`, then one of `themes/vscode.css`, `themes/light.css`, `themes/dark.css`, `themes/ap-ui.css`
- `highlight/github-dark.css` for code colours
