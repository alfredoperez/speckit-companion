# Tasks: Extension-Side Lifecycle Writes for .spec-context.json

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-13

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add `stepLifecycle` wrapper — `src/features/specs/stepLifecycle.ts` | R001, R002, R007, R008
  - **Do**: Create module exporting `startStep(specDir, step, by)`, `completeStep(specDir, step, by)`, `startSubstep(specDir, step, substep, by)`, `completeSubstep(specDir, step, substep, by)`. Each delegates to `specContextWriter` and wraps in try/catch that logs to `console.error` (and `vscode.window` output channel if available) without rethrowing.
  - **Verify**: `npm run compile` passes; module can be imported.
  - **Leverage**: `src/features/specs/specContextWriter.ts` (existing `setStepStarted`/`setStepCompleted` signatures).

- [x] **T002** Test `stepLifecycle` — `src/features/specs/__tests__/stepLifecycle.test.ts` | R002
  - **Do**: BDD specs covering: writer called with correct args; writer rejection is logged not thrown; substep variants pass the canonical name through.
  - **Verify**: `npm test -- stepLifecycle` passes.
  - **Leverage**: `src/features/specs/__tests__/specContextManager.test.ts` (mock pattern for writer).

- [x] **T003** Make `executeInTerminal` return the spawned terminal — `src/ai-providers/*` | R003
  - **Do**: Change provider interface so `executeInTerminal(prompt, name)` returns `Promise<vscode.Terminal | undefined>`. Update each provider implementation to return the `vscode.Terminal` it created (or `undefined` if it cannot). Existing void-return callers continue to work.
  - **Verify**: `npm run compile` passes; existing tests still pass.
  - **Leverage**: current `executeInTerminal` implementations in `src/ai-providers/`.

- [x] **T004** Add `terminalStepTracker` — `src/features/specs/terminalStepTracker.ts` | R003
  - **Do**: Module owning a `Map<vscode.Terminal, { specDir: string; step: string }>`. Export `track(terminal, specDir, step)` and `register(context: vscode.ExtensionContext)` that subscribes `vscode.window.onDidCloseTerminal` and, on close, looks up the terminal, calls `stepLifecycle.completeStep(specDir, step, 'extension')`, then deletes the entry. No-op when terminal is not tracked.
  - **Verify**: `npm run compile` passes.
  - **Leverage**: T001 wrapper.

- [x] **T005** Test `terminalStepTracker` — `src/features/specs/__tests__/terminalStepTracker.test.ts` | R003
  - **Do**: Mock `vscode.window.onDidCloseTerminal`; verify tracked-close fires `setStepCompleted` once with correct args; untracked-close is a no-op; double-close on same terminal does not double-fire.
  - **Verify**: `npm test -- terminalStepTracker` passes.
  - **Leverage**: `tests/__mocks__/vscode.ts`.

- [x] **T006** Wire step-start + tracker into `specCommands.ts` — `src/features/specs/specCommands.ts` | R001, R002, R003, R007
  - **Do**: For each `speckit.<step>` command (`specify`, `plan`, `tasks`, `implement`, `clarify`, `analyze`), before `executeInTerminal`: call `stepLifecycle.startStep(specDir, step, 'extension')`. Capture the terminal returned and call `terminalStepTracker.track(terminal, specDir, step)` when defined. Order: write first, then dispatch — write failure must not block dispatch (already covered by T001 swallow).
  - **Verify**: `npm run compile`; manual run in Extension Development Host shows `stepHistory.<step>.startedAt` populated immediately.
  - **Leverage**: existing dispatch pattern in `specCommands.ts:186` and `:245`.

- [x] **T007** Replace legacy `setSpecStatus` with canonical `updateSpecContext` writes — `src/features/specs/specCommands.ts` and `src/features/spec-viewer/messageHandlers.ts` | R006, R007
  - **Do**: In `specCommands.ts:90` (`completeSpec`) and `:104` (`archiveSpec`), and in the `messageHandlers.ts` `completeSpec` / `archiveSpec` / `reactivateSpec` handlers, swap `setSpecStatus(...)` for `updateSpecContext(specDir, ctx => ({ ...ctx, status: 'completed' | 'archived', updated: today }))` plus a transition entry. For `reactivateSpec`, derive status from `currentStep` (canonical active-state derivation). Remove the `setSpecStatus` import where no callers remain. If callers remain elsewhere, leave the import; do NOT delete `setSpecStatus` itself yet.
  - **Verify**: `npm run compile`; existing `messageHandlers.test.ts` updated and passes.
  - **Leverage**: `src/features/specs/specContextWriter.ts` `updateSpecContext` and `transitionLogger.ts`.

- [x] **T008** Wire viewer Approve/Regenerate to lifecycle — `src/features/spec-viewer/messageHandlers.ts` | R004, R005, R008
  - **Do**: In `handleApprove`, after computing the approved step, call `stepLifecycle.completeStep(specDir, step, 'extension')`. In `handleRegenerate`, call `stepLifecycle.startStep(specDir, step, 'extension')` (this rewrites `stepHistory[step].startedAt` and clears `completedAt` per writer semantics). Wrap multi-phase work with `startSubstep`/`completeSubstep` using names from `CANONICAL_SUBSTEPS`.
  - **Verify**: `npm test -- messageHandlers` passes; manual: clicking Approve advances stepper without waiting for AI.
  - **Leverage**: `CANONICAL_SUBSTEPS` in `src/core/types/specContext.ts`.

- [x] **T009** Register tracker in extension activate — `src/extension.ts` | R003
  - **Do**: Import `terminalStepTracker.register` and call it once in `activate(context)`, pushing the returned disposable into `context.subscriptions`.
  - **Verify**: `npm run compile`; Extension Development Host launches without errors; closing a step terminal writes `completedAt`.
  - **Leverage**: existing `context.subscriptions.push(...)` pattern in `extension.ts`.

- [x] **T010** Update README — `README.md` | docs
  - **Do**: Add a short note under the lifecycle/spec-context section that the extension itself now records `startedAt`/`completedAt` and canonical status — independent of AI cooperation.
  - **Verify**: README renders correctly; section reflects new behavior.
  - **Leverage**: existing spec-context section in `README.md`.

---

## Progress

- Phase 1: T001–T010 [x]
