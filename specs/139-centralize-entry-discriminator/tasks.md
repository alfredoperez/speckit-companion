# Tasks — Centralize the step-level vs per-task entry discriminator

Dependency-ordered, organized by file/layer. Behavior-preserving refactor (FR-006/FR-007). Each task names the concrete file it edits.

## Foundational (blocking — every later task depends on these)

- [x] **T001** Add and export two predicates in `src/features/specs/historyHelpers.ts`: `isStepLevelEntry(e)` → `e.substep == null && e.task == null` (FR-001) and `isPerTaskEntry(e)` → `e.task != null` (FR-002). Type the param as a minimal structural shape `{ substep?: string | null; task?: string | null }` so canonical `HistoryEntry` and former `HistoryEntryLike` callers pass without casts.
- [x] **T002** In `src/features/specs/historyHelpers.ts`, rewrite the existing `lastEntryIsCompletionFor` loop (~line 33) to use `isStepLevelEntry`/`isPerTaskEntry` instead of the inline `e.substep != null || e.task != null`. This becomes the single source for FR-004.

## Core work (one file per task; depends on T001/T002)

- [x] **T003**  [P] `src/features/specs/specContextManager.ts` — delete the local duplicate `lastEntryIsCompletionFor` (~lines 245-256) and import it from `historyHelpers`; route `stepHasBeenStarted` (~line 262) and the completion skip (~line 252) through `isStepLevelEntry`/`isPerTaskEntry` (FR-003, FR-004).
- [x] **T004**  [P] `src/features/specs/stepHistoryDerivation.ts` — replace the inline `t.substep == null && t.task == null` (~line 276) with `isStepLevelEntry`; route the per-task/substep distinction in `dedupeConsecutive` (~lines 140-148) through the predicates where it is the same rule. Keep `rowName`'s `substep ?? task` naming fallback (~lines 159-163) as-is — display logic, not the discriminator (FR-003).
- [x] **T005**  [P] `src/features/specs/lastTransition.ts` — route the per-task branch of `entryLabel` (~lines 45-57) through `isPerTaskEntry`; then remove `HistoryEntryLike` (~lines 16-23) and retype against canonical `HistoryEntry` / shared minimal pick that includes `task` (FR-003, FR-005).
- [x] **T006**  [P] `src/features/specs/specContextReader.ts` — align `normalizeHistoryKind` (~lines 228-239) with `isStepLevelEntry` ONLY if it preserves the existing kind-backfill semantics exactly. It currently keys on `substep` alone; verify the task-aware predicate does not change backfilled kinds for legacy entries. If it would, leave the backfill as-is and add a one-line note why (FR-003, FR-006).

## Integration (types — after the call-sites that consume them)

- [x] **T007**  `src/core/types/specContext.ts` — confirm `HistoryEntry.task?: string` is the canonical field (~line 93) and that the predicates' param type accepts the reader shapes (canonical + legacy duck-type). No new type mirrored into `webview/src/spec-viewer/types.ts` unless a type actually moves (FR-005). Depends on T005.

## Webview (separate compile boundary; do not import from `src/`)

- [x] **T008**  `webview/src/spec-viewer/timelineEvents.ts` — replace inline `substep`/`task` checks in `buildHistoryIndex` (~line 53) and `mergeStepEvents` (~line 89). Per the plan decision, define tiny local `isStepLevelEntry`/`isPerTaskEntry` (or a shared util under `webview/src/`) rather than crossing the extension boundary (FR-003, FR-009).

## Polish (Python best-effort, then verify)

- [x] **T009**  [P] Python (FR-008, best-effort) — add a module-level `_is_step_level(e)`/`_is_per_task(e)` helper and route inline checks through it in `speckit-extension/scripts/write-context.py` (`_has_complete` ~307-312, `_has_step_start` ~280-295), its installed mirror `.specify/extensions/companion/scripts/write-context.py`, and `.claude/skills/eval-speckit-extension/check_capture.py` (`_step_span` ~322-329). Edit the source script under `speckit-extension/scripts/` as authoritative; keep the `.specify/...` mirror consistent.
- [x] **T010**  Verify — run `npm run compile` (both tsconfigs) then `npm test`. The golden contract `src/features/specs/__tests__/readerShapeContract.test.ts` and `messageHandlers.spec.ts` mock MUST pass with no edits (FR-007, SC-003). Grep for residual inline `substep == null` / `substep === null` discriminators at reader call-sites — only the predicate bodies should retain the comparison (SC-001, SC-002). Depends on all prior tasks.

## Dependencies

- T001 → T002 (the rewrite uses the new predicates).
- T002 blocks all of T003–T008 (every call-site imports/uses the shared predicates).
- T005 → T007 (the type reconciliation follows the `HistoryEntryLike` removal in `lastTransition.ts`).
- T009 is independent of the TypeScript chain (shares only the rule, not code).
- T010 depends on everything (final compile + full-suite verification).

## Parallel

- After T002 lands, T003, T004, T005, T006 are `[P]` — distinct files, no shared incomplete dependency.
- T009 `[P]` can run anytime (separate language/files).
- T007 and T008 are not `[P]` with each other only by ordering preference; T008 has no TS-side dependency and may run alongside the T003–T006 batch.
