# Contract: `speckit-viewer` package exports

Package name: `speckit-viewer`. Package path: `packages/viewer`. Entry points: `/contract`, `/core`, `/styles`. Token prefix: `--sk-*`. Theme files: `vscode.css`, `light.css`, `dark.css`, `ap-ui.css`. Surface map entry: `packages/viewer/**`.

## Exports map

Each entry has three conditions, matched in this order.

| Condition | Resolves to | Used by |
|---|---|---|
| `types` | the TypeScript source | `tsc` |
| `source` | the TypeScript source | webpack builds (webview, extension) |
| `default` | compiled CommonJS in `dist/` | the host's `tsc` output (F5) and plain Node |

| Subpath | Meaning |
|---|---|
| `./contract` | types and Zod schemas |
| `./core` | the renderer and pure derivations |
| `./core/*` | one core module by path |
| `./styles/*` | one CSS file by path |

`typesVersions` maps the same subpaths to the source for node10 resolution.

## `speckit-viewer/contract`

| Export | Kind |
|---|---|
| `SpecContextSchema` | Zod schema for `.spec-context.json` as written |
| `NavStateSchema` | Zod schema for the navigation state |
| `ViewerStateSchema` | Zod schema for the viewer state |
| `ViewerMessageSchema` | Zod schema checking the `type` discriminant of every outgoing message |
| `SpecContext` | type |
| `NavState` | type |
| `ViewerState` | type |
| `STEP_NAMES` | `StepName[]` helper |
| `STATUSES` | `Status[]` helper |

The interfaces stay hand-written. A type test asserts each schema's output is assignable to its interface.

## `speckit-viewer/core`

The renderer entry is `renderMarkdown`. These names come from `apps/vscode/webview/src/spec-viewer/markdown/index.ts`.

| Group | Names |
|---|---|
| Render | `renderMarkdown`, `slugify` |
| Render state setters | `setCurrentTask`, `setHasSpecContext`, `setLivingMode`, `setReportMode`, `setTaskSummaries`, `setSpecLedgerTasks` |
| Screens | `renderScreenByName` |
| Clarifications | `markClarifications`, `writtenQuestion` |
| Living | `setLivingCoverage`, `setLivingDrifted`, `setLivingNew`, `stripLivingDraftBanner`, `preprocessLivingPurpose`, `preprocessLivingScenarios`, `preprocessLivingRequirements`, `preprocessLivingUncovered` |
| Inline | `parseInline`, `escapeHtml`, `escapeHtmlInScenario` |
| Preprocessors | `preprocessSpecMetadata`, `preprocessUserStories`, `preprocessTaskPhases`, `preprocessRequirements`, `preprocessEntities`, `preprocessChecklist`, `preprocessTechnicalContext`, `preprocessConstitution`, `preprocessDecisions`, `preprocessCallouts` |
| Scenarios | `parseAcceptanceScenarios`, `resetScenarioTableCounter` |

Pure derivations also in `/core`: `relativeTime`, `timelineEvents`, `coverageState`, `activityHeroModel`, `overviewModel`, `stepInFlight`, `overviewAvailability`, `clarificationsIn`, `linkifyIds`, `ownedBy`.

`/core` imports no DOM, Preact or `vscode`.

The renderer reads one live value, `navState`, from `signals.ts`. `/core` ships it as a plain `{ value: null }` holder. A host replaces that one module with its own signal.

## `speckit-viewer/styles/*`

| File | Role |
|---|---|
| `viewer.css` | the viewer rules, scoped under `.sk-viewer`; imports `themes/light.css` first as the default |
| `themes/vscode.css` | the editor palette, keyed on `body.vscode-light` and `body.vscode-dark`, plus high contrast |
| `themes/light.css` | light tokens |
| `themes/dark.css` | dark tokens |
| `themes/ap-ui.css` | the ap-ui tokens |
| `themes/roles.css` | the shared role colours that `light.css`, `dark.css` and `ap-ui.css` read |

Every theme file sets every `--sk-*` token.

## Root class

Every selector is prefixed with `:where(.sk-viewer)`, so scoping adds no specificity. A host puts `sk-viewer` on the element that wraps the viewer. The extension puts it on `<body>`.

## Load order

A theme loads after `viewer.css`. Load `viewer.css`, then one theme file. The extension loads `dist/viewer.css` then `dist/themes/vscode.css`.
