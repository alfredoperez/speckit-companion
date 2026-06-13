# Tasks: Implement Lifecycle Reliability

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Child 2 — capture writer settles spec from `--tasks-file`

- [x] **T001** Add `feature_dir_from_tasks_file()` helper + task-sync resolution override (with `--feature-dir` mismatch error) in `speckit-extension/scripts/write-context.py` `main()`.
- [x] **T002** Add Python regression tests in `speckit-extension/tests/test_context.py`: `--tasks-file` parent wins over a conflicting active-feature pointer; `--feature-dir`/`--tasks-file` mismatch does not write.
- [x] **T003** Mirror the script change into `.specify/extensions/companion/scripts/write-context.py` is NOT needed — that copy is gitignored/generated; the source under `speckit-extension/` is authoritative. (No-op; documented.)

## Child 3 + #270 — spec-context watcher over configured dirs + discovery

- [x] **T004** Add `specContext` patterns to `getFileWatcherPatterns()` in `src/core/specDirectoryResolver.ts`.
- [x] **T005** Add `.specify/specs` to the default `speckit.specDirectories` in `package.json`.
- [x] **T006** Extract `handleSpecContextChange`/`handleSpecContextDelete` and add `setupSpecContextWatchers()` (refresh viewer + sidebar on create) in `src/core/fileWatchers.ts`; wire from `setupFileWatchers`.
- [x] **T007** Unit test the new `specContext` patterns in `tests/` (specDirectoryResolver coverage).

## Child 4 — consolidate spinner onto step tab

- [x] **T008** Delete `webview/src/spec-viewer/components/footer/GeneratingFooter.tsx`.
- [x] **T009** Rewrite `FooterActions.tsx`: remove generating branch, recovery-timeout net, and gate the next-step button while the current step is in flight.
- [x] **T010** `StepTab.tsx`: allow the sync glyph during the implement percent state (spinner + percent together).
- [x] **T011** Reduced-motion fallback for `.codicon-sync` in spec-viewer CSS (verify/add).
- [x] **T012** Update `FooterActions.stories.tsx` and `StepTab.stories.tsx` for the new states; update/repair FooterActions/StepTab unit tests.

## Docs

- [x] **T013** Update `docs/capture-and-timing.md` (Children 1–3 / writer resolution + watcher) and `docs/viewer-states.md` (Children 3–4 / refresh + spinner).
- [x] **T014** Update root `CHANGELOG.md` (VS Code half) and `speckit-extension/CHANGELOG.md` + bump `speckit-extension/extension.yml` version (Child 2 touched `speckit-extension/**`).
- [x] **T015** Update root `README.md` Configuration (specDirectories default now includes `.specify/specs`).
