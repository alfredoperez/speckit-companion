# Research: The spec viewer as an embeddable element

## How the extension keeps its message channel

- **Decision**: the package exports `onAction` and `setActionHandler`. The extension's `signals.ts`, which every view module and test already loads, installs a handler that calls the global `vscode.postMessage` at call time.
- **Rationale**: 18 tests and stories fake `globalThis.vscode` and assert on the messages. A lazy lookup keeps them all passing unedited, and the production webview gets the same messages.
- **Alternatives considered**: a Jest setup file plus edits to every mock (more churn, same result); passing `onAction` as a prop (threads through every component).

## How extension-only parts reach the shared shell

- **Decision**: a Preact context `ViewerSlots` that the package `App` reads: `banners`, `footer`, `reportPage`, `installBanner`, `onRendered`, `moved`.
- **Rationale**: the install banner sits deep in `ActivityPanel`; a context reaches it without prop drilling. The extension's `App` fills the slots with today's components.
- **Alternatives considered**: props on `App` only (cannot reach `ActivityPanel`); leaving `ActivityPanel` in the extension (Factory would lose it).

## Signals

- **Decision**: the package owns `view/signals.ts` (Preact signals: navState, viewerState, markdownHtml, viewerMode, specMoved, historyEntries, overviewAvailable, showingOverview). The extension's `signals.ts` re-exports them and keeps `pendingRefinements` and `activeEditor`.
- **Rationale**: one instance per page; the existing webpack and Jest redirects (core's holder → extension signals) still land on the same objects because the extension file re-exports the package's. The element's esbuild build redirects core's holder to `view/signals.ts`.
- **Alternatives considered**: deleting the redirects (touches the renderer's live value; out of scope).

## Highlighting

- **Decision**: `highlight.js@11.9.0` as a package dependency, imported as `highlight.js/lib/common`. Its `styles/github-dark.css` is copied unscoped to `dist/styles/highlight/github-dark.css` and linked where the CDN sheet was. Storybook's preview head switches too.
- **Rationale**: the CDN `highlight.min.js` is the common build; the six language tags add nothing to it. Same version and same languages produce the same spans, so the style diff and the bundle stay comparable. A separate sheet keeps `spec-viewer.css` unchanged, which is what the style diff loads.
- **Alternatives considered**: Factory's nine languages (drops python, sql, go and more); inlining github-dark into `viewer.css` (changes the diffed stylesheet).

## Mermaid

- **Decision**: unchanged in VS Code (CDN, always loaded). The element never loads it; `initializeMermaid` runs only when a global `mermaid` exists.
- **Rationale**: the issue makes Mermaid opt-in for other hosts without changing the extension.

## Derivations in /core

- **Decision**: move `phaseCalculation`, `stepHistoryDerivation`, `stateDerivation`, `historyHelpers`, `taskCheckboxes`, `capabilityNames` and the `SpecStatuses`/`WorkflowSteps` objects into `/core`; old paths become re-exports. `deriveViewerState` takes the footer builder as an optional last parameter (default: no footer). A new `buildNavState` carries Factory's adapter logic, fixed to put action steps on the rail as the extension does.
- **Rationale**: one copy of each derivation; the extension's outputs stay byte-for-byte.
- **Alternatives considered**: Factory's stubs (`support.ts`, `@ts-nocheck`), which already drifted.

## Element hosting and slots

- **Decision**: light DOM. The element gets class `sk-viewer`, renders Preact into an inner root div, and lays out as a flex column with `[slot="actions"]` children ordered first.
- **Rationale**: the scoped CSS and the view's `document.getElementById` calls need the light DOM. The host framework keeps owning its slotted nodes because the element never moves them.
- **Alternatives considered**: shadow DOM with real `<slot>` (breaks every document-level lookup).

## Build

- **Decision**: esbuild (already used by the canvas and the mod) bundles `dist/element/index.js` as ESM with Preact, signals and highlight.js inside. `tsconfig.view.json` emits `.d.ts` for contract, core, view and element into `dist/types`; the `element` export's `types` points there.
- **Rationale**: strict consumers read declarations, not source.

## Strict indexing

- **Decision**: turn on `noUncheckedIndexedAccess` in both package tsconfigs; fix each site with a guard where the value can be missing and a non-null assertion where a bound proves it present.
- **Rationale**: behaviour stays identical; the 448 errors sit in the markdown renderer and ledger.
