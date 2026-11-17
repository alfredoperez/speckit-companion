# Implementation Plan: Spec viewer as a shared library (V1 to V4)

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md) · **Source**: #983

> **Scale note**: about 120 files across four areas: the workspace, the contract and core move (about 60 TypeScript files and their tests), the styles move (38 partials, four themes, a CSS build), and the build plumbing (webpack, three tsconfigs, Jest, the canvas build). Watch the cascade: scoping and token renames are mechanical but the only proof is the computed-style diff.

## Summary

Start `packages/viewer` as the npm workspace package `speckit-viewer` and move the viewer's framework-free half into it. `/contract` takes the `.spec-context.json` and viewer protocol types with new Zod schemas. `/core` takes the markdown renderer and the pure derivations. `/styles` takes the viewer CSS, renamed onto `--sk-*` tokens, scoped under `.sk-viewer` by a small PostCSS build, with four theme files. The extension imports all three and keeps thin re-export files where the host used to own the code. New dependencies: `zod` (package runtime) and `postcss` (package dev, already in the tree through Vite).

## Project Structure

```
packages/viewer/
  package.json              exports ./contract ./core ./core/* ./styles/*; typesVersions; build script
  tsconfig.json             CommonJS build to dist/
  LICENSE
  scripts/build-css.mjs     inline partials, prefix selectors with :where(.sk-viewer)
  src/contract/             specContext.ts, viewer.ts, viewerState.ts, schemas.ts, index.ts
  src/core/                 markdown/** (renderer), derivations, signals.ts (seam), index.ts
  styles/                   viewer.css, _tokens.css, partials, themes/{vscode,light,dark,ap-ui,roles}.css
  tests/                    node import test (plain runtime), schema tests
apps/vscode/src/core/types/specContext.ts      → re-export of speckit-viewer/contract
apps/vscode/src/protocol/viewer.ts             → re-export, NavState bound to ReportNav
apps/vscode/webview/src/spec-viewer/           DOM and Preact files stay; imports point at the package
apps/vscode/webview/styles/spec-viewer.css     → imports the package's built CSS and vscode theme
apps/vscode/src/features/spec-viewer/html/generator.ts   body gets class sk-viewer
apps/copilot-canvas/build.mjs                  new entry paths; vendor/ rebuilt
webpack.config.js, tsconfig*.json, jest.config.js, package.json, .vscodeignore, CLAUDE.md
.claude/skills/release-qa/surface-map.yml
```

**Structure Decision**: one package with source-first exports; the extension keeps only what touches the DOM, Preact or the host.

## Call paths

```calls the webview renders a document from the package
  handleContentUpdated() @ apps/vscode/webview/src/spec-viewer/messageHandlers.ts
~   renderMarkdown() @ packages/viewer/src/core/markdown/renderer.ts **new**
~     livingRequirementLinks() @ packages/viewer/src/core/markdown/livingComponents.ts **new**
+       navState @ packages/viewer/src/core/signals.ts **new**
```
note: the extension's webpack and Jest point the core signals module at the extension's real signal.

```calls the host reads the contract at F5
  activate() @ apps/vscode/src/extension.ts
~   STEP_NAMES @ apps/vscode/src/core/types/specContext.ts
+     STEP_NAMES @ packages/viewer/src/contract/specContext.ts **new**
```

```calls the stylesheet is built and loaded
+ buildCss() @ packages/viewer/scripts/build-css.mjs **new**
~ getHtml() @ apps/vscode/src/features/spec-viewer/html/generator.ts
~   spec-viewer.css @ apps/vscode/webview/styles/spec-viewer.css
```

## Constitution Check

No `.specify/memory/constitution.md` principles bind this change beyond CLAUDE.md's architecture rules.

| Rule | Result |
|---|---|
| The host owns the filesystem | PASS: nothing in the package touches files |
| `core/` imports nothing from `features/` | PASS: the shim re-exports from the package only |
| Repository text reaches a panel as text | PASS: renderer moves unchanged |
| One fact, one owner | PASS: moved code leaves re-exports, not copies |
| Pipeline shape derived once | PASS: untouched |
| Copilot canvas shares no code with `apps/vscode/` | PASS, improved: the canvas now builds from the package |

## Proof commands

- V2: `cmp` of every `dist/webview/*` file against main's build.
- V3: `node packages/viewer/scripts/bundle-diff.mjs <main-dist> dist` strips module ids and path comments, then diffs `spec-viewer.js`.
- V4: `node packages/viewer/scripts/style-diff.mjs <main-storybook> <branch-storybook>` compares computed styles of every element in each viewer fixture story, light and dark.
