# speckit-viewer

The SpecKit Companion spec viewer as a library, for any host: the data contract, the markdown renderer and derivations, the stylesheet, the Preact view and a `<speckit-viewer>` custom element. Not on npm yet: the package stays private until its name is confirmed.

```sh
npm install speckit-viewer
```

## Entry points

- `speckit-viewer/contract`: the `.spec-context.json`, navigation-state, viewer-state and message types, with Zod schemas. `ViewerAction` is everything the view asks its host for.
- `speckit-viewer/core`: `renderMarkdown`, the derivations the viewer draws from, and `buildNavState`. No framework, no DOM.
- `speckit-viewer/view`: the Preact view. `App` is the shell; `setActionHandler` receives every `ViewerAction`; `ViewerSlotsContext` lets a host add its own parts (banners, footer, report pages, install banner).
- `speckit-viewer/element`: registers `<speckit-viewer>`, one ES module with Preact and highlight.js inside.
- `speckit-viewer/styles/viewer.css`, then one theme (`themes/vscode.css`, `themes/light.css`, `themes/dark.css` or `themes/ap-ui.css`), and `highlight/github-dark.css` for code colours.

## Two ways to plug in

**The element**, for any page or framework:

```ts
import 'speckit-viewer/element';
import 'speckit-viewer/styles/highlight/github-dark.css';
import 'speckit-viewer/styles/viewer.css';
import 'speckit-viewer/styles/themes/light.css';

const viewer = document.querySelector('speckit-viewer');
viewer.record = specContext;          // the .spec-context.json, or null
viewer.documents = documents;          // SpecDocument[]: core and action steps, related documents
viewer.currentDoc = 'spec';
viewer.content = specMarkdown;         // the open document's text; null while you read it
viewer.addEventListener('speckit-action', (event) => {
    if (event.detail.type === 'stepperClick') viewer.content = read(event.detail.phase);
});
```

The element moves between documents itself and emits every action. Children with `slot="actions"` show above the rail and stay outside the viewer's styles. One viewer per page.

**The Preact view**, for a host that owns its state (the VS Code extension): set the signals from `/view`, call `setActionHandler`, and render `App` inside `ViewerSlotsContext.Provider`.

## Build

`npm run build -w speckit-viewer` writes `dist/`: the CommonJS contract and core, declarations in `dist/types`, the styles, and `dist/element/index.js`. `node packages/viewer/tests/element/element.check.mjs` loads the element alone in headless Chrome and checks the rail, the slot, highlighting, navigation, events and that nothing comes from a CDN. `npm run storybook -w speckit-viewer` shows the element on a demo spec, one story per theme.

## Release

Add a changeset (`npx changeset`) with each change. `/publish-viewer` runs `npx changeset version` and pushes a `speckit-viewer-v<version>` tag; `.github/workflows/publish-viewer.yml` publishes from that tag with npm provenance.
