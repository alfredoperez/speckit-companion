# Tasks: Remove orphaned "Mark step complete" override chain

Dependency-ordered. Type removals must follow the code that uses them (compile-driven). The simplification of `deriveRunningStepInfo` (the producer) is the foundational change that unblocks deleting the `stepArtifact` module and the three `ViewerState` fields.

## Foundational

- [x] **T001** Simplify `deriveRunningStepInfo` to return only `{ tab }` — drop `artifactReady`/`startedAt`/`label` and the `await hasNonTrivialArtifact(...)` probe; update both call sites and remove the `hasNonTrivialArtifact` import + the `runInfo.artifactReady` arg passed to `deriveViewerState` + `src/features/spec-viewer/specViewerProvider.ts` (FR-004)

## Core work

- [x] **T002** Delete `handleMarkStepComplete` and its `markStepComplete:` routing entry; prune any imports left unused only by it (verify `findRunningStep`/`completeStep`/`deriveStepHistory`/`readSpecContext` usage elsewhere in the file first) + `src/features/spec-viewer/messageHandlers.ts` (FR-001, FR-006)
- [x] **T003** Remove the `runningStepArtifactReady` parameter from `deriveViewerState` and the three `runningStep*` fields from its returned object; drop the now-dead `running`-only derivation if it solely fed those fields, keeping `findRunningStep` exported + `src/features/spec-viewer/stateDerivation.ts` (FR-003)
- [x] **T004** [P] Remove `runningStepArtifactReady` / `runningStepStartedAt` / `runningStepLabel` from the `ViewerState` interface + `src/core/types/specContext.ts` (FR-003)
- [x] **T005** [P] Remove the same three fields from the webview `ViewerState` and remove `| { type: 'markStepComplete' }` from the inbound message union + `webview/src/spec-viewer/types.ts` (FR-002, FR-003)
- [x] **T006** [P] Remove the `markStepComplete` member from the extension-side inbound message-type union + `src/features/spec-viewer/types.ts` (FR-002)
- [x] **T007** Delete the non-trivial-artifact probe module + `src/features/spec-viewer/stepArtifact.ts` (FR-005, depends on T001)
- [x] **T008** Delete the probe's test + `src/features/spec-viewer/__tests__/stepArtifact.test.ts` (FR-005, depends on T007)

## Integration

- [x] **T009** [P] Drop the three removed fields from the `ViewerState` fixtures + `webview/src/spec-viewer/components/__tests__/FooterActions.test.tsx` (FR-007)
- [x] **T010** [P] Drop the three removed fields from the story's `ViewerState` fixtures + `webview/src/spec-viewer/components/FooterActions.stories.tsx` (FR-007)

## Polish

- [x] **T011** [P] Document the accepted non-implement force-complete gap (specify/plan/tasks settle via `after_*` hooks; Regenerate is the recovery path; no one-click force-complete) + `docs/viewer-states.md` (FR-008, SC-005)
- [x] **T012** Verify zero remaining references (`grep` for `markStepComplete`, `runningStepArtifactReady`, `runningStepStartedAt`, `runningStepLabel`, `hasNonTrivialArtifact` in `src/`/`webview/`) and run `npm run compile && npm test` green (FR-009, SC-001, SC-002, SC-003, SC-004)

## Dependencies

- **T001** is foundational: it removes the only consumers of `hasNonTrivialArtifact` and the `artifactReady` flow, unblocking T007/T008 and making T003–T006 type-safe.
- **T007** before **T008** (delete module, then its test).
- **T012** is last (gates everything).
- T002 and T003 are in the same feature area but different files; do T002 then T003 (both reference the running-step path).

## Parallel

- **T004, T005, T006** touch three independent type files — can run together after T001/T003.
- **T009, T010, T011** are independent files (two test fixtures + a doc) — can run together.
