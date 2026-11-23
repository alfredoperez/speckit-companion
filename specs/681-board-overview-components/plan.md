# Plan: The board's Overview from the viewer's components

## Summary

`apps/copilot-canvas/build.mjs` bundles `preact-render-to-string` with the dossier sections from `packages/viewer/src/view/components/OverviewDossier.tsx` into `vendor/viewer-overview.mjs` (JSX automatic, Preact). `overview.mjs` derives the viewer state, marks missing tests from disk, renders the sections to a string, and appends the board-only timing note and run log.

## Project Structure

```text
package.json (devDependency), apps/copilot-canvas/build.mjs, extension overview.mjs, vendor/, tests/render.test.mjs, apps/copilot-canvas/CHANGELOG.md
```

## Constitution Check

| Principle | Assessment |
|---|---|
| I–IV | PASS: one view, rendered in two places. |
