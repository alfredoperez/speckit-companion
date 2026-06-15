# Remove orphaned "Mark step complete" override chain

## Overview

PR #277 removed the `GeneratingFooter` and with it the user-facing "Mark step complete" manual override, but left the `markStepComplete` message chain and its supporting state fields in the code with no UI path that triggers them. This removes that dead chain end-to-end and documents the resulting non-implement force-complete gap as an accepted trade-off (those steps settle reliably through their `after_*` hooks, and Regenerate remains the recovery path).

## Functional Requirements

- **FR-001** The system MUST remove the `markStepComplete` message handler (`handleMarkStepComplete`) and its routing entry from the spec-viewer message dispatch, since no UI surface sends a `markStepComplete` message.
- **FR-002** The system MUST remove the `markStepComplete` member from the inbound message-type unions on both the extension side (`src/features/spec-viewer/types.ts`) and the webview side (`webview/src/spec-viewer/types.ts`).
- **FR-003** The system MUST remove the dead `ViewerState` fields `runningStepArtifactReady`, `runningStepStartedAt`, and `runningStepLabel` from the type declarations (`src/core/types/specContext.ts`, `webview/src/spec-viewer/types.ts`) and from their population in the viewer-state derivation, because no webview component reads them.
- **FR-004** The system MUST simplify the viewer's running-step derivation so it returns only the live active-step tab, dropping the `artifactReady`/`startedAt`/`label` outputs and the per-refresh non-trivial-artifact disk probe that fed only the dead fields.
- **FR-005** The system MUST delete the non-trivial-artifact disk-probe module and its test once that probe is no longer referenced by any production code path.
- **FR-006** The system MUST keep the shared helpers `findRunningStep`, `completeStep`, and `isLifecycleStep`, which are still used by other live lifecycle paths.
- **FR-007** The system MUST update the affected component test and Storybook story to drop the removed state fields so they continue to type-check and reflect the real `ViewerState` shape.
- **FR-008** The system MUST document, in the viewer-states reference doc, that for the specify/plan/tasks steps there is no one-click force-complete and that those steps settle via their lifecycle hooks with Regenerate as the recovery path.
- **FR-009** The extension MUST compile and the full test suite MUST pass after the removal, with no remaining references to the deleted message type, handler, or fields.

## Success Criteria

- **SC-001** A repository-wide search for `markStepComplete` returns zero matches in source and test files.
- **SC-002** A repository-wide search for `runningStepArtifactReady`, `runningStepStartedAt`, and `runningStepLabel` returns zero matches in source, test, and story files.
- **SC-003** `npm run compile` completes with no type errors.
- **SC-004** `npm test` passes with no failures.
- **SC-005** The viewer-states reference doc contains a statement describing the accepted non-implement force-complete gap and the Regenerate recovery path.

## Assumptions

- The active-step tab (`runInfo.tab`) is the only live consumer of the running-step derivation; the artifact-ready, started-at, and label outputs have no remaining reader (confirmed by trace).
- The non-trivial-artifact disk probe exists solely to feed the now-removed `artifactReady` flag; removing the flag makes the probe and its test fully unused.
- Re-adding a UI override would reintroduce the redundant in-flight surface that #277 deliberately removed, so the gap is documented rather than re-homed.
- The `after_*` lifecycle hooks settle specify/plan/tasks reliably in practice, making the gap narrow and theoretical.
