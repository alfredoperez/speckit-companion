# Plan: Constitution card and stale documents on the board

## Summary

The pure comparison in `apps/vscode/src/features/spec-viewer/staleness.ts` moves to `packages/viewer/src/core/staleness.ts`; VS Code keeps a wrapper that reads file times. The canvas bundles the core function, reads document times and the constitution on the server, and renders a constitution card in the board header and a stale line on the spec detail.

## Project Structure

```text
packages/viewer/src/core/staleness.ts (+ test), core/index.ts
apps/vscode/src/features/spec-viewer/staleness.ts (wrapper)
apps/copilot-canvas/build.mjs; extension files specs-core.mjs, server.mjs, public/app.js; tests; vendor/
.changeset/, apps/copilot-canvas/CHANGELOG.md, apps/website/src/content/docs/docs/copilot-app/index.mdx
```

**Structure Decision**: one rule in core, two hosts that read file times their own way.

## Constitution Check

| Principle | Assessment |
|---|---|
| I–IV | PASS: a shared pure rule and read-only board panels. |
