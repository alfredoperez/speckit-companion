# Implementation Plan: Implement Lifecycle Reliability

**Spec**: [spec.md](./spec.md) | **Branch**: `157-implement-lifecycle`

## Technical Context

- **Language**: TypeScript 5.3+ (ES2022, strict) + Python 3.12 (stdlib only) for the capture writer.
- **Surfaces**: spec-kit extension (`speckit-extension/scripts/write-context.py`, `commands/`) + VS Code extension (`src/core/fileWatchers.ts`, `src/core/specDirectoryResolver.ts`, `package.json`, `webview/src/spec-viewer/components/`).
- **Storage**: `.spec-context.json` per spec dir.

## Design by child

### Child 2 — `write-context.py` resolves feature dir from `--tasks-file`

In `main()`, before calling `resolve_feature_dir`, when `--tasks-file` is present derive the tasks file's parent as the authoritative feature dir:
- New helper `feature_dir_from_tasks_file(root, tasks_file) -> Path` — absolutize the tasks path against `root`, return its parent dir.
- In `main()`: if `args.tasks_file`, compute `tf_dir`. If `args.feature_dir` was ALSO supplied and resolves to a different dir → print error to stderr and return 0 (best-effort: never fail the host) but DO NOT write — surface the mismatch. Otherwise use `tf_dir` as the feature dir (skip the pointer precedence entirely for task-sync mode).
- Keep the existing `resolve_feature_dir` for step-mode and `--task` finish-mode.

This targets the watched path and is immune to the active-feature pointer drifting to a later spec.

### Child 3 — `.spec-context.json` watcher over configured patterns

In `fileWatchers.ts`, extract the `handleSpecContextChange` / `handleSpecContextDelete` closures so they can be shared, then add `setupSpecContextWatchers(context, specViewer, specExplorer, outputChannel)` that, for each `getFileWatcherPatterns().specs` pattern, derives a `**/${pattern}/**/.spec-context.json` glob and wires `onDidChange`→`handleSpecContextChange`, `onDidCreate`→(refresh + tree refresh), `onDidDelete`→`handleSpecContextDelete`. Keep the `.claude` watcher. Call the new setup from `setupFileWatchers`.

Deriving the context glob from the spec pattern: `getFileWatcherPatterns()` already returns `specs: ['**/specs/**/*', ...]`. Add a `specContext` array (`**/${pattern}/**/.spec-context.json`) to the return so the watcher targets dotfiles directly (VS Code `**` matches dotfiles).

### #270 — discovery of `.specify/specs`

Add `.specify/specs` to the default `speckit.specDirectories` enum in `package.json` (`["specs", ".specify/specs"]`). `resolveSpecDirectories` lists children of each simple pattern, so `.specify/specs/00x-feature` becomes discoverable; `getFileWatcherPatterns` then also emits a `**/.specify/specs/**/.spec-context.json` watcher (Child 3), so a newly-created spec there fires the tree refresh and the welcome screen clears. On `onDidCreate` of a `.spec-context.json`, call `specExplorer.refresh()`.

### Child 4 — spinner consolidation

- Delete `webview/src/spec-viewer/components/footer/GeneratingFooter.tsx`.
- `FooterActions.tsx`: drop the `GeneratingFooter` import, `RECOVERY_TIMEOUT_MS`, `forceTick`/`useEffect`/`useState`, `timedOut`, `isGenerating`, and the `if (isGenerating) return <GeneratingFooter/>` branch. Gate the running-state footer: when the current step is in flight (status in `specifying/planning/tasking/implementing`), suppress the next-step lifecycle button (pass a `stepInFlight` flag to `CatalogFooter`, or compute `isActive`-style suppression).
- `StepTab.tsx`: change `showSyncGlyph` to also be true during the implement percent state — `const showSyncGlyph = canonicalState === 'in-flight'` (drop `&& !inProgress`), and render the glyph alongside the percent label. Keep `showPercentLabel` for the number.
- Reduced-motion: ensure the `.codicon-sync` spin has a `@media (prefers-reduced-motion: reduce)` fallback (static glyph). Check existing CSS; add if missing.
- Update `FooterActions.stories.tsx` / `StepTab.stories.tsx` for the new states.

## Sequencing

Child 2 (Python) → Child 3 + #270 (watcher/discovery) → Child 4 (UI; Child 1 already satisfied so footer override removal is safe).

## Summary

The capture writer will trust the tasks file it's handed instead of a stale active-spec pointer; the viewer will watch the real `specs/` (and `.specify/specs/`) locations so it refreshes the moment a step settles and newly-created specs appear; and the running indicator collapses to a single spinning step tab, dropping the redundant footer now that the extension reliably settles implement on its own.
