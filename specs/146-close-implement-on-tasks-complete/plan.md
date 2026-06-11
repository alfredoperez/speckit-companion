# Implementation Plan: Close the implement step when all tasks are checked

## Summary

When a watched `tasks.md` reaches 100% completion, the always-on tasks watcher must record the closing implement transition so the spec advances from `implementing` to `implemented`. The fix adds a single mode-agnostic trigger inside `setupTasksWatcher`'s change handler that, when the spec's implement step is underway and every task is now checked, calls the existing `completeStep(specDir, 'implement', 'extension')` lifecycle helper — the same helper the terminal-close tracker and the Python `after_implement` hook already use. Idempotency and no-backward-clobber come from inspecting the recorded `.spec-context.json` before writing.

## Technical Context

- **Language/version**: TypeScript (VS Code extension, `tsc -p ./`).
- **Primary modules**: `src/core/fileWatchers.ts` (`setupTasksWatcher`), `src/features/specs/stepLifecycle.ts` (`completeStep`), `src/features/specs/specContextReader.ts` (`readSpecContextSync`), `src/features/specs/historyHelpers.ts` (`lastEntryIsCompletionFor` / step-level helpers), `src/speckit/taskProgressService.ts` (`parseTasksFile` → `{ totalTasks, completedTasks }`, `extractSpecNameFromPath`).
- **Testing**: vitest (`npm test`). Python capture path unchanged but covered by `speckit-extension/tests/test_context.py`.
- **Constraints**: best-effort (logged-and-swallowed); no new runtime dependency on `.claude/**` or `.specify/**`; must not regress the Python hook or the terminal-close tracker (both already write the same close — the new path is idempotent with them).

## Approach & Structure

Order of attack:

1. **Derive the spec directory + recorded context in the watcher.** In `src/core/fileWatchers.ts`, the `handleTasksChange` debounced handler already computes `progress` via `parseTasksFile`. Add: resolve the spec directory from the `tasks.md` uri (parent dir), read the recorded context with `readSpecContextSync`, and compute `allDone = progress.totalTasks > 0 && progress.completedTasks === progress.totalTasks`.

2. **Add an "implement underway" guard.** Only auto-close when the spec is genuinely implementing — `currentStep === 'implement'` OR `status === 'implementing'` OR an implement entry already exists in `history[]`. This preserves fast-path's pause at `ready-to-implement` (no implement step yet → never auto-closed). Skip when the recorded status is already terminal (`implemented` / `completed` / `archived`) — no re-close, no backward clobber.

3. **Call the shared close.** When `allDone` and underway and not-yet-closed, `await completeStep(specDir, 'implement', 'extension')`. `completeStep` → `setStepCompleted` appends the step-level `{ step:'implement', substep:null, kind:'complete' }` entry and sets `status:'implemented'`. Idempotency: guard with a `lastEntryIsCompletionFor(history,'implement')`-style check (or the recorded terminal-status check) so a re-save at 100% appends nothing.

4. **Keep it best-effort.** Wrap the close in the watcher's existing try/catch (the handler already swallows + logs to the output channel). The phase-completion notification path is left intact and runs alongside.

5. **Tests.** Add a focused unit test for the new helper (extract the decision into a small pure function `shouldCloseImplement(ctx, progress)` so it is testable without a live `vscode` watcher), covering: all-done + underway → close; all-done + fast-path-parked (no implement, status ready-to-implement) → no close; mid-flight (one unchecked) → no close; already-terminal → no close; zero markers → no close; idempotent re-save → no second entry. Extend the Python `test_context.py` stale-test gap only if it blocks `npm test` — the Python path is already correct (verified: a single hook run writes the step-level close).

## Out of Scope

- Changing the Python capture scripts' close logic (already correct).
- The user's Mark-Completed gate (`implemented` → `completed`) — untouched.
- Reordering or backfilling existing dogfood `.spec-context.json` history.
- The terminal-close tracker and complete-on-advance paths — they keep working; the new watcher path is additive and idempotent with them.

## Decisions

- **Why the tasks watcher, not the dispatcher or a hook?** The watcher is the only surface that fires for *every* driving mode (stock speckit has no companion hook; IDE-chat dispatch returns no terminal so the terminal-close tracker no-ops; implement has no "next step" so complete-on-advance never fires for it). The watcher already parses completion and is always-on — it is the genuine shared completion path the issue asks for.
- **Reuse `completeStep` rather than a new writer.** One terminal-status code path keeps the close consistent with the existing tracker + Python hook and inherits append-only + atomic-write guarantees.
