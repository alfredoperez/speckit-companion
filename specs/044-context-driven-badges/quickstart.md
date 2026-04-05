# Quickstart: Context-Driven Badges and Dates

## What This Feature Does

Makes the spec viewer badge and date display fully driven by `.spec-context.json` instead of markdown frontmatter. When context is missing, badge and dates are gracefully omitted.

## Key Files to Modify

| File | Change |
|------|--------|
| `src/features/spec-viewer/types.ts` | Add `createdDate`, `lastUpdatedDate` to `NavState` |
| `src/features/spec-viewer/specViewerProvider.ts` | Compute dates from `stepHistory`, populate NavState |
| `src/features/spec-viewer/html/generator.ts` | Render context-driven dates in initial HTML |
| `webview/src/spec-viewer/markdown/preprocessors.ts` | Remove date fields from markdown parsing |
| `webview/src/spec-viewer/navigation.ts` | Update dates dynamically via `updateNavState()` |

## Implementation Order

1. **Add date fields to NavState** (`types.ts`) — the interface change everything else depends on
2. **Add date computation helper** (`specViewerProvider.ts`) — extract dates from `stepHistory`
3. **Populate NavState with dates** (`specViewerProvider.ts`) — wire up computation
4. **Render dates in HTML generator** (`generator.ts`) — initial load shows context dates
5. **Remove date parsing from preprocessor** (`preprocessors.ts`) — stop reading from markdown
6. **Add dynamic date updates** (`navigation.ts`) — dates update on lifecycle actions
7. **Add tests** — badge edge cases, date computation, preprocessor changes

## Testing Quick Check

```bash
# Run existing tests to ensure no regressions
npm test

# Manual verification:
# 1. Open a spec with .spec-context.json → badge and dates from context
# 2. Open a spec without .spec-context.json → no badge, no dates
# 3. Complete a spec → badge updates to COMPLETED, dates update
# 4. Delete .spec-context.json while viewer open → badge/dates disappear on refresh
```

## Patterns to Follow

- **Badge pattern**: `computeBadgeText()` returns string or null → NavState → webview renders or hides. Follow same pattern for dates.
- **NavState flow**: Extension computes → `postMessage()` → webview `updateNavState()` applies DOM changes.
- **Graceful omission**: Return `null` from computation → check for null in rendering → skip DOM element creation.
