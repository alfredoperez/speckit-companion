# speckit-viewer

The SpecKit Companion spec viewer as a library: the data contract, the markdown renderer and the stylesheet the VS Code extension uses, for any host. Private for now; the name is provisional until it is published.

## Entry points

- `speckit-viewer/contract`: the `.spec-context.json`, navigation-state, viewer-state and message types, with Zod schemas (`SpecContextSchema`, `NavStateSchema`, `ViewerStateSchema`, `ViewerMessageSchema`).
- `speckit-viewer/core`: `renderMarkdown` and the derivations the viewer draws from. No framework, no DOM.
- `speckit-viewer/styles/viewer.css`: every rule scoped under `.sk-viewer` and read from `--sk-*` tokens. Load one theme after it: `themes/vscode.css`, `themes/light.css` (the default), `themes/dark.css` or `themes/ap-ui.css`.

```ts
import { SpecContextSchema } from 'speckit-viewer/contract';
import { renderMarkdown } from 'speckit-viewer/core';
import 'speckit-viewer/styles/viewer.css';
import 'speckit-viewer/styles/themes/light.css';

const context = SpecContextSchema.parse(JSON.parse(raw));
container.classList.add('sk-viewer');
container.innerHTML = renderMarkdown(specMarkdown);
```

Bundlers that honour the `source` export condition read the TypeScript source; everything else reads the CommonJS build. `npm run build -w speckit-viewer` writes `dist/`.
