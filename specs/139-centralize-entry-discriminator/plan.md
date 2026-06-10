# Plan — Centralize the step-level vs per-task entry discriminator

## Summary

The rule that classifies a `.spec-context.json` history entry as a step-level boundary (`substep == null && task == null`) vs a per-task implement finish (`task != null`) is re-derived inline across ~6 TypeScript call-sites, and `lastEntryIsCompletionFor` exists as two copies. This refactor adds two shared predicates — `isStepLevelEntry` and `isPerTaskEntry` — to `historyHelpers.ts`, routes every reader/derivation/manager check through them, collapses the duplicate `lastEntryIsCompletionFor` to the single exported one, and folds `HistoryEntryLike` into the canonical `HistoryEntry` (which already carries optional `task`). It is behavior-preserving: the golden-history contract test and full suite must pass unchanged.

## Technical Context

- **Language**: TypeScript 5.3+ (ES2022, strict). Python 3 for the capture scripts (best-effort, FR-008).
- **Primary deps**: VS Code Extension API; Preact (webview). No new deps.
- **Storage**: `.spec-context.json` per spec dir — read-only shape concern here; no schema change.
- **Testing**: Jest (`ts-jest`). The golden contract is `src/features/specs/__tests__/readerShapeContract.test.ts`.
- **Target**: Both the extension (`src/`) and webview (`webview/src/`) compile paths; both import from `historyHelpers`/types.
- **Constraints**: Zero observable behavior change (FR-006); no test assertions weakened (FR-007); no new public extension API (Assumptions). Webview must not import extension-only modules — verify the shared predicate location is importable from both sides, or duplicate the trivial predicate webview-side rather than cross a module boundary that isn't already crossed.

## Approach & Structure

Order of attack — predicates first, then swap call-sites, then types, then Python, then verify.

1. **`src/features/specs/historyHelpers.ts`** — add and export two predicates:
   - `isStepLevelEntry(e): boolean` → `e.substep == null && e.task == null`
   - `isPerTaskEntry(e): boolean` → `e.task != null`
   Rewrite the existing `lastEntryIsCompletionFor` loop to use them (line ~33 currently inlines `e.substep != null || e.task != null`). This file's `lastEntryIsCompletionFor` becomes the single source.

2. **`src/features/specs/specContextManager.ts`** — delete the local duplicate `lastEntryIsCompletionFor` (lines ~245-256); import it from `historyHelpers` (line ~218 call-site stays). Route `stepHasBeenStarted` (line ~262) and the completion skip (line ~252) through `isStepLevelEntry`/`isPerTaskEntry`.

3. **`src/features/specs/stepHistoryDerivation.ts`** — replace the inline `t.substep == null && t.task == null` at line ~276 with `isStepLevelEntry`. Check `dedupeConsecutive` (lines ~140-148) and `rowName` (lines ~159-163) — route the per-task/substep distinction through the predicates where it's the same rule (keep `rowName`'s `substep ?? task` naming fallback as-is; that's display logic, not the discriminator).

4. **`src/features/specs/lastTransition.ts`** — `entryLabel` (lines ~45-57) uses `entry.task`/`entry.substep` for labeling; route the per-task branch through `isPerTaskEntry`. Then **remove `HistoryEntryLike`** (lines ~16-23) and retype against canonical `HistoryEntry` (or a shared minimal pick that includes `task`) per FR-005.

5. **`src/features/specs/specContextReader.ts`** — `normalizeHistoryKind` (lines ~228-239) branches on `e.substep == null`; align with `isStepLevelEntry` only if it preserves the existing kind-backfill semantics exactly (it currently keys on `substep` alone — verify substituting the task-aware predicate doesn't change backfilled kinds for legacy entries; if it would, leave the backfill as-is and note why).

6. **`src/core/types/specContext.ts`** — confirm `HistoryEntry.task?: string` is the canonical field (it is, line ~93). Ensure the predicates' parameter type accepts the reader shapes (canonical + legacy duck-type). Mirror nothing new into `webview/src/spec-viewer/types.ts` unless a type moves.

7. **Webview (`webview/src/spec-viewer/timelineEvents.ts`)** — `buildHistoryIndex` (line ~53) and `mergeStepEvents` (line ~89) inline `substep`/`task`. If `historyHelpers` is not already imported webview-side, add a tiny local `isStepLevelEntry`/`isPerTaskEntry` (or shared util under `webview/src/`) rather than importing across the extension boundary. Decision recorded below.

8. **Python (FR-008, best-effort)** — `speckit-extension/scripts/write-context.py` and its installed mirror `.specify/extensions/companion/scripts/write-context.py` (`_has_complete` ~307-312, `_has_step_start` ~280-295), plus `.claude/skills/eval-speckit-extension/check_capture.py` (`_step_span` ~322-329). Add a module-level `_is_step_level(e)` / `_is_per_task(e)` helper in each script and route the inline checks through it. The two languages share the *rule*, not code. Edit the source script under `speckit-extension/scripts/`; the `.specify/...` copy is generated on install — change both to keep the working tree consistent but treat the source as authoritative.

9. **Verify** — `npm run compile` (both tsconfigs), then `npm test`. The golden test (`readerShapeContract.test.ts`) and `messageHandlers.spec.ts` mock must pass with no edits. Grep for residual inline `substep == null`/`substep === null` discriminators at reader call-sites (SC-001) — only the predicate bodies should retain the comparison.

## Decisions

- **Webview duplication over cross-boundary import.** The extension's `historyHelpers.ts` lives under `src/`; webview code must not import from `src/`. If no shared util already bridges them, define the two one-line predicates locally in webview rather than introduce a new cross-boundary dependency. The rule is trivial and the duplication is intentional and symmetric (same as how `HistoryEntry` is already mirrored in `webview/src/spec-viewer/types.ts`).
- **Predicate param type.** Accept a minimal structural shape (`{ substep?: string | null; task?: string | null }`) so both canonical `HistoryEntry` and the former `HistoryEntryLike` callers pass without casts — this is what lets FR-005 collapse `HistoryEntryLike` cleanly.

## Out of Scope

- No change to the `.spec-context.json` on-disk schema, status vocabulary, or history-shape rule itself.
- No new public extension API, setting, command, or user-facing surface.
- No timeline/badge/footer rendering behavior change; webview edits are mechanical predicate swaps.
- No README/CHANGELOG entry (pure internal refactor); `docs/architecture.md` only if a module boundary actually moves (it should not — predicates land in the existing `historyHelpers.ts`).
- Python is not required to share code with TypeScript — only the same rule.

## Constitution Check

Pass. No principle is at risk: this is a pure internal consolidation. Principle IV (Modular Architecture / avoid duplication) is directly advanced — collapsing two `lastEntryIsCompletionFor` copies and ~6 inline discriminators into shared predicates. No new provider, no pipeline change, no user-facing surface, so Principles I–III are untouched. No complexity violation to justify.
