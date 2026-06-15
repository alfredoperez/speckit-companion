# Plan: Remove orphaned "Mark step complete" override chain

## Summary

Delete the `markStepComplete` message chain that #277 left orphaned (no UI sends the message), along with the three dead `ViewerState` fields (`runningStepArtifactReady`, `runningStepStartedAt`, `runningStepLabel`) that no webview component reads. Simplify the viewer's running-step derivation to return only the live active-step tab, which lets the non-trivial-artifact disk probe and its test be deleted. Document the resulting non-implement force-complete gap as accepted in `docs/viewer-states.md`.

## Technical Context

- **Language**: TypeScript 5.3+ (ES2022, strict), VS Code Extension API, Preact (webview).
- **Testing**: Jest (`npm test`), `npm run compile` for type-check.
- **Storage**: `.spec-context.json` per spec dir — unchanged by this work (the deleted fields are derived `ViewerState`, not persisted context).
- **Constraint**: Removal-only; must not touch any live lifecycle path. `findRunningStep`, `completeStep`, `isLifecycleStep` stay — they back `fileWatchers`, `terminalStepTracker`, `specCommands`, and the viewer's stepper/approve handlers.

## Approach & Structure

Order of attack (delete the consumers' need first, then the producers, then the types):

1. **`src/features/spec-viewer/messageHandlers.ts`** — delete `handleMarkStepComplete` and its `markStepComplete:` routing entry. Drop any imports that become unused *only here* (e.g. `findRunningStep` is still imported by other files, so check before removing — it is used by `handleMarkStepComplete` here, but also by `specViewerProvider`/`stateDerivation`; the import in this file may become unused — verify and prune).
2. **`src/features/spec-viewer/specViewerProvider.ts`** — simplify `deriveRunningStepInfo` to return `{ tab }` only (drop `artifactReady`/`startedAt`/`label` and the `await hasNonTrivialArtifact(...)` probe). Update both call sites (l.584, l.925) — `generateHtml` still gets `runInfo.tab`; `deriveViewerState(..., runInfo.artifactReady ?? false)` loses its 4th arg. Remove the now-unused `hasNonTrivialArtifact` import.
3. **`src/features/spec-viewer/stateDerivation.ts`** — remove the `runningStepArtifactReady` parameter from `deriveViewerState` and the three `runningStep*` fields from the returned object. Keep `findRunningStep` (still exported/used) but drop the `running`-only usage that solely fed the removed fields if it becomes dead.
4. **`src/core/types/specContext.ts`** — remove `runningStepArtifactReady`, `runningStepStartedAt`, `runningStepLabel` from the `ViewerState` interface.
5. **`webview/src/spec-viewer/types.ts`** — remove the same three fields from the webview `ViewerState` and remove `| { type: 'markStepComplete' }` from the inbound message union.
6. **`src/features/spec-viewer/types.ts`** — remove the `markStepComplete` message-type union member.
7. **`src/features/spec-viewer/stepArtifact.ts` + `__tests__/stepArtifact.test.ts`** — delete both once `hasNonTrivialArtifact` has no remaining references.
8. **`webview/src/spec-viewer/components/__tests__/FooterActions.test.tsx`** + **`FooterActions.stories.tsx`** — drop the three removed fields from the `ViewerState` fixtures.
9. **`docs/viewer-states.md`** — add a short note: specify/plan/tasks have no one-click force-complete; they settle via `after_*` hooks, and Regenerate is the recovery path if a transition is missed.

Verify with `grep -rn "markStepComplete\|runningStepArtifactReady\|runningStepStartedAt\|runningStepLabel\|hasNonTrivialArtifact"` returning nothing in `src/`/`webview/` (docs may mention the gap in prose), then `npm run compile && npm test`.

## Out of Scope

- Re-homing the manual-complete affordance as a new UI surface (decided against: it would reintroduce the redundant in-flight surface #277 removed).
- The implement-step fallback settle (the always-on `tasks.md` watcher) — unchanged and still the implement recovery path.
- The `write-context.py` `--feature-dir`/`--tasks-file` mismatch exit-code note (#281 "Also (low)") — separate, not part of the viewer chain; left for a follow-up.

## Constitution Check

Removal-only cleanup with no new behavior, no new dependency, and full test/compile coverage of the touched surfaces — no constitution gates implicated. Pass.
