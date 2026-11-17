# Implementation Plan: The spec viewer as an embeddable element

**Spec**: [spec.md](./spec.md) · **Source**: #983

> **Scale note**: about 70 files across four areas: the package (new `view/` and `element/` entries, derivations moved into `core/`, strict-index fixes), the extension webview (now a thin host of the package view), the extension host (re-export shims, the HTML generator) and the build configs (webpack, Jest, Storybook, tsconfigs). Watch two things: every test and story that fakes the global `vscode` must keep passing without edits, and the computed-style diff against main must stay clean.

## Summary

The host-neutral Preact view moves from the extension webview into `packages/viewer/src/view`, and every message it sends goes through one `onAction(action)` typed by the contract's `ViewerAction` (the existing `ViewerToExtensionMessage` union). The extension webview installs an action handler that forwards to `vscode.postMessage`, and plugs its own parts (banners, footer, report pages, editor hooks, install banner) into the package `App` through a slots context. A new `packages/viewer/src/element` registers `<speckit-viewer>`: it builds `NavState` and `ViewerState` from a record, a document list and the current text with derivations moved into `/core`, renders the view in the light DOM, handles document switches itself and re-emits every action as a `speckit-action` event. highlight.js 11.9.0 becomes a package dependency, bundled through `highlight.js/lib/common` so the language set matches the CDN's common build; its github-dark sheet ships as `dist/styles/highlight/github-dark.css`. esbuild (already at the root, used by the canvas and the mod) builds the element as one ES module; a separate `tsconfig.view.json` type-checks and emits declarations for `view` and `element`, and the package turns on `noUncheckedIndexedAccess`.

## Project Structure

```
packages/viewer/
  package.json                 + ./view, ./element exports; highlight.js, preact, @preact/signals deps; build:element
  tsconfig.json                ~ noUncheckedIndexedAccess; excludes view/ and element/ (core stays DOM-free)
  tsconfig.view.json           + DOM + preact JSX, declarations to dist/types
  scripts/build-element.mjs    + esbuild ESM bundle → dist/element/index.js
  scripts/build-css.mjs        ~ copies highlight.js github-dark.css → dist/styles/highlight/
  src/contract/viewer.ts       ~ export type ViewerAction
  src/core/                    + phaseCalculation, stepHistoryDerivation, stateDerivation, historyHelpers,
                                 taskCheckboxes, statuses (SpecStatuses, WorkflowSteps), capabilityNames, navState
  src/core/markdown/**         ~ strict-index fixes
  src/view/                    + App, signals, host (onAction), slots, toc, highlighting, documentLinks,
                                 components/ (NavigationBar, StepTab, SpecHeader, PageChrome, ActivityPanel,
                                 ActivityErrorBoundary, OverviewDossier, RunStrip, TimelineEvent, ElapsedTimer,
                                 Badge, cards/*)
  src/element/index.ts         + <speckit-viewer>
apps/vscode/webview/src/spec-viewer/
  App.tsx                      ~ wraps the package App, fills the slots
  signals.ts                   ~ re-exports package signals + extension-only signals; installs the postMessage handler
  index.tsx, actions.ts, messageHandlers.ts, editor/**, footer/**, report-pages/**   stay
  components/{NavigationBar,…}.tsx, toc.ts, highlighting.ts, documentLinks.ts   - moved (re-export shims where stories/tests import them)
apps/vscode/src/
  features/spec-viewer/{phaseCalculation,stateDerivation}.ts, features/specs/stepHistoryDerivation.ts,
  core/utils/taskCheckboxes.ts, core/utils/capabilityNames.ts   ~ one-line re-exports of /core
  features/spec-viewer/html/generator.ts   ~ github-dark from the package, no highlight.js CDN tags
webpack.config.js, jest.config.js, .storybook/{main.ts,preview-head.html}, tsconfig.webview.json   ~ resolve /view and /element
```

**Structure Decision**: one package, two new entries; the extension keeps its old module paths as re-exports so the ~40 tests and stories that import them by path need no edit.

## Call paths

```calls a rail click in VS Code
+ NavigationBar() @ packages/viewer/src/view/components/NavigationBar.tsx **new**
+   onAction() @ packages/viewer/src/view/host.ts **new**
~     installPostMessageHandler() @ apps/vscode/webview/src/spec-viewer/signals.ts
```
note: the handler reads the global `vscode` at call time, so tests that mock `globalThis.vscode` keep working.

```calls a rail click in the element
+ NavigationBar() @ packages/viewer/src/view/components/NavigationBar.tsx **new**
+   onAction() @ packages/viewer/src/view/host.ts **new**
+     handleAction() @ packages/viewer/src/element/index.ts **new**
+       buildNavState() @ packages/viewer/src/core/navState.ts **new**
```

```calls the extension builds viewer state
  readViewerState() @ apps/vscode/src/features/spec-viewer/specViewerProvider.ts
+   deriveViewerState() @ packages/viewer/src/core/stateDerivation.ts **new**
      getFooterActions() @ apps/vscode/src/features/spec-viewer/footerActions.ts
```
note: core's `deriveViewerState` takes the footer builder as a parameter; the extension's re-export binds `getFooterActions`, so its output is unchanged.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: no setting added or changed. |
| II. Spec-Driven Workflow | PASS: the viewer shows the same documents and steps. |
| III. Visual and Interactive | PASS: the computed-style diff guards the look. |
| IV. Modular Architecture | PASS: the view leaves the host; the host plugs in through slots and one action function. |
| AI Provider Integration | PASS: untouched. |
| User Interface | PASS: no visible change in VS Code. |

Re-checked after design: still PASS.
