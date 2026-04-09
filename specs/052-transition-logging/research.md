# Research: Transition Logging

## R1: Where does the extension write `.spec-context.json`?

**Decision**: Intercept at `updateSpecContext()` in `specContextManager.ts` — the single merge-and-write function all callers use.

**Rationale**: Every write path (`updateStepProgress`, `setSpecStatus`, `workflowManager.saveFeatureWorkflow`) funnels through `updateSpecContext()`. Adding transition logic here captures all step/substep changes with zero caller modifications.

**Alternatives considered**:
- Intercepting each caller individually — fragile, easy to miss new callers.
- Post-write hook via file watcher — race conditions, can't distinguish extension vs. external writes.

## R2: Transition entry data model

**Decision**: Append to a `transitions` array in `.spec-context.json`:
```json
{
  "step": "plan",
  "substep": null,
  "from": { "step": "specify", "substep": null },
  "by": "extension",
  "at": "2026-04-09T12:00:00.000Z"
}
```

**Rationale**: Matches the spec exactly. Uses `step`/`substep` (not `currentStep`) for the transition entry to avoid confusion with the top-level `currentStep` field. `from: null` for initial creation.

**Alternatives considered**:
- Separate `transitions.json` file — adds file management complexity, breaks single-file mental model.
- Storing in `stepHistory` — different semantics (stepHistory tracks start/complete, not individual transitions).

## R3: Detecting step/substep changes in `updateSpecContext`

**Decision**: Read current file state before merging, compare `currentStep`/`substep` fields. If either changed, append a transition entry.

**Rationale**: `updateSpecContext` already reads the file before merging. The comparison is O(1) and adds no I/O overhead.

**Alternatives considered**:
- In-memory cache comparison — would miss changes from other extension instances or manual edits between writes.

## R4: External transition detection via file watcher

**Decision**: Add a dedicated `.spec-context.json` watcher (or extend the existing `.claude/**/*` watcher) that:
1. Maintains an in-memory cache of `{ step, substep }` per spec directory
2. On file change, reads new state and compares to cache
3. If the latest `transitions` entry has `by !== "extension"`, logs to output channel
4. Updates cache

**Rationale**: The existing `.claude/**/*` watcher fires on all file changes but only refreshes the tree view. A targeted check on `.spec-context.json` changes adds the transition detection without modifying the existing debounce logic.

**Alternatives considered**:
- Separate watcher for `.spec-context.json` only — unnecessary since the existing watcher already fires; just add a targeted handler within it.

## R5: Spec viewer History section

**Decision**: Add a "History" section to the spec viewer that:
1. Extension reads `transitions` array from `.spec-context.json` and passes it via `NavState`
2. Webview renders a timeline below existing content
3. Color-coding via CSS variables: blue for "sdd", green for "extension", orange for backtracking

**Rationale**: Follows existing pattern — extension reads data, passes to webview via `NavState`, webview renders. No new communication channels needed.

**Alternatives considered**:
- Separate webview panel — overkill for a simple timeline, fragments the UX.
- Tree view — can't render rich color-coded timelines.

## R6: Backtracking detection

**Decision**: Use the workflow step order array (resolved via `resolveWorkflowSteps()`) to determine if a transition moves backward. Compare index of `from.step` vs index of `step` — if `step` index < `from.step` index, it's backtracking.

**Rationale**: The step ordering is already available from workflow configuration and supports custom workflows.

**Alternatives considered**:
- Hardcoded step order — breaks for custom workflows.

## R7: Preventing duplicate transitions on no-op writes

**Decision**: In `updateSpecContext`, only append a transition entry when the new `currentStep` or new substep (from the `partial` argument) differs from the existing values in the file. If neither is present in the partial, skip transition logic entirely.

**Rationale**: Many calls to `updateSpecContext` update unrelated fields (e.g., `status`, `progress`). Only step/substep changes should produce transitions.
