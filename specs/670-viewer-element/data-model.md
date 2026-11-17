# Data model

## ViewerAction

The existing `ViewerToExtensionMessage` union, re-exported under this name. A tagged union on `type` (`stepperClick`, `switchDocument`, `overviewChosen`, `openFile`, `toggleCheckbox`, `showTerminal`, `webviewError`, `openIdea`, `runDocRefinement`, footer actions, and the rest). No new variants.

## SpecDocument (element input)

From the contract: `type`, `label`, `fileName`, `filePath`, `exists`, `isCore`, `category` (`core` | `related` | `action`), optional `parentStep`. The rail shows `core` and `action` documents as steps and hangs `related` ones under their `parentStep`.

## Element state

| Property | Type | Rule |
|---|---|---|
| `record` | `SpecContext \| null` | null shows no Overview |
| `documents` | `SpecDocument[]` | empty shows an empty rail |
| `currentDoc` | `string` | unknown falls back to the first core document |
| `content` | `string \| null` | null shows a reading state |
| `landing` | `'overview' \| 'document'` | default `overview` |
| `live` | `boolean` | default `false` |
| `taskCounts` | `{ checked, total } \| null` | optional; drives the Tasks percent |

Setting any property re-derives `NavState` (via `buildNavState`) and `ViewerState` (via `deriveViewerState`) and re-renders.

## ViewerSlots (package view context)

`banners`, `footer`, `reportPage(report)`, `installBanner`, `onRendered()`, all optional. Empty in the element; filled by the extension.
