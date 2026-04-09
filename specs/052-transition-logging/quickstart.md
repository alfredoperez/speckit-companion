# Quickstart: Transition Logging

## What this feature does

Adds an append-only transition log to `.spec-context.json` that records every workflow step change, who triggered it (extension vs SDD), and when. Displays the history in the spec viewer with color-coded timeline.

## Key files to modify

| File | Change |
|------|--------|
| `src/features/workflows/types.ts` | Add `TransitionEntry` type, add `transitions` field to `FeatureWorkflowContext` |
| `src/features/specs/specContextManager.ts` | Add transition append logic in `updateSpecContext()` |
| `src/core/fileWatchers.ts` | Add external transition detection + output channel logging |
| `src/features/spec-viewer/specViewerProvider.ts` | Pass `transitions` and `workflowStepOrder` to webview |
| `src/features/spec-viewer/html/generator.ts` | Accept and serialize transitions in NavState |
| `src/features/spec-viewer/types.ts` | Add `transitions` and `workflowStepOrder` to NavState |
| `webview/src/spec-viewer/App.tsx` | Render History section |
| `webview/styles/spec-viewer/` | Add `_history.css` partial for timeline styles |

## Key files to create

| File | Purpose |
|------|---------|
| `webview/src/spec-viewer/history/TransitionHistory.tsx` | History timeline component |
| `src/features/specs/transitionLogger.ts` | Transition append logic + cache for external detection |

## How transition logging works

1. **Extension writes**: `updateSpecContext()` reads current `currentStep`/`substep`, compares to new values, appends transition entry if changed
2. **External writes**: File watcher detects `.spec-context.json` change, reads latest transition entry, logs to output channel if `by !== "extension"`
3. **Viewer display**: Extension passes `transitions[]` to webview, webview renders chronological timeline with color coding

## Running locally

```bash
npm run watch          # Start TypeScript compilation
# Press F5 in VS Code to launch Extension Development Host
# Navigate a spec through workflow steps
# Check .spec-context.json for transitions array
# Open spec viewer to see History section
```

## Testing

```bash
npm test               # Run all tests
npm run test:watch     # Watch mode
```

Focus tests on:
- `specContextManager.ts` — transition append logic, no-op detection, first-creation handling
- `transitionLogger.ts` — cache management, external detection
- Webview History component — rendering, color coding, backtracking highlights
