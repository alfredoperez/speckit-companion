# Implementation Plan: Hide Resume on Terminal Specs (Make `implemented` a First-Class Status)

**Branch**: `151-implemented-terminal-status` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/151-implemented-terminal-status/spec.md`

## Summary

Make the pipeline terminal status `implemented` a first-class `SpecStatus`. Today it is absent from the `SpecStatuses` constant, so `lifecycleContextValue()` falls through `default → spec-active`, which (a) groups an `implemented` spec under **Active** and (b) keeps the Resume inline action's `when` matching (`viewItem == spec-active`). The fix adds `implemented` to the status set, maps it to a dedicated terminal lifecycle contextValue, buckets it out of the Active sidebar group, and excludes the new contextValue from the Resume menu `when`. No auto-promotion to `completed`; footer/Mark-Completed gating is untouched.

## Technical Context

**Language/Version**: TypeScript (VS Code extension), Node toolchain
**Primary Dependencies**: VS Code extension API; Jest for unit tests
**Storage**: `.spec-context.json` per spec (status source of truth)
**Testing**: Jest (`npm test`), `src/**/__tests__/*.test.ts`
**Target Platform**: VS Code extension host
**Project Type**: single (extension `src/` tree)
**Constraints**: VS Code tree inline menus can only **hide** via `when`, not disable — hidden is the intended behavior. No auto-advance `implemented → completed`.

## Constitution Check

No constitution file with binding gates for this change. The change is additive and narrow; it preserves the decided lifecycle model (implement terminates at `implemented`; `completed` is the user's explicit action). PASS.

## Approach (concrete edits)

1. **`src/core/constants.ts`** — add `IMPLEMENTED: 'implemented'` to the `SpecStatuses` object (between `TASKS_DONE` and `COMPLETED`).

2. **`src/features/specs/specExplorerProvider.ts`**
   - Add `'spec-implemented'` to the `SpecLifecycleContextValue` union and the `SPEC_LIFECYCLE_CONTEXT_VALUES` set so `isSpecLifecycleItem()` still returns `true` (row keeps lifecycle context-menu items like Delete/Archive). It is intentionally NOT a Resume-matching value.
   - In `lifecycleContextValue()`, add `case SpecStatuses.IMPLEMENTED: return 'spec-implemented';` before the `default`.
   - In `getChildren()` grouping (~L170), bucket `implemented` out of Active. Since `implemented` is a done-but-not-user-completed state and the only "done" group is **Completed**, route it into `completedSpecs` (it already renders as done via #244, and the Completed group is collapsed by default). This satisfies FR-004 (not under Active) without inventing a new sidebar group.

3. **`package.json`** — Resume `when` (~L532): currently `(viewItem == spec-active || viewItem == spec-tasks-done) && speckit.resumeBeta`. No change needed in principle because `spec-implemented` is a new value that does not match — but verify no broader regex elsewhere matches it. Confirm the Resume entry stays scoped to active/tasks-done. Also confirm the `spec-(active|tasks-done|completed|archived)` regexes used by Delete/Archive/markCompleted: decide whether `spec-implemented` should be included. For this ticket: include `spec-implemented` where `completed` already appears for terminal actions (Delete, Archive) so the new terminal row keeps the same affordances as `completed`; do NOT add it to markCompleted's active-only `when` (Mark Completed is surfaced via the spec viewer footer for `implemented`, and the sidebar markCompleted is gated to active/tasks-done — leaving it off keeps sidebar behavior consistent with the footer-owned action). The grouping puts the row under Completed, so its inline/context actions should mirror a completed row.

## Project Structure

### Source Code (repository root)

```text
src/
├── core/constants.ts                              # add SpecStatuses.IMPLEMENTED
└── features/specs/
    ├── specExplorerProvider.ts                    # contextValue + grouping
    └── __tests__/specExplorerProvider.test.ts     # new assertions
package.json                                        # Resume `when` (verify) + terminal-action whens
```

**Structure Decision**: Single-project extension tree. All edits live in `src/core` + `src/features/specs` + `package.json`; tests in the existing `specExplorerProvider.test.ts`.

## Status-consumer audit (must not regress)

Every switch/map keyed on status, and whether `implemented` is handled:

- `lifecycleContextValue()` — NOW returns `spec-implemented` (was `spec-active`). FIXED.
- `getChildren()` grouping — NOW buckets to Completed (was Active). FIXED.
- `footerActions.isSpecDone()` — already special-cases `'implemented'` (surfaces Mark Completed). UNCHANGED, correct.
- `footerActions.isTerminal()` / `stepHistoryDerivation.isTerminalStatus()` — only completed/archived. Intentionally UNCHANGED: these gate footer step-actions; treating `implemented` as terminal there would hide the Mark Completed CTA. Leave as-is.
- `phaseCalculation.canonicalStatusLabel()` — no `implemented` key → falls to step-based "IMPLEMENT COMPLETE" label (renders as done). UNCHANGED, correct.
- `stepHistoryDerivation.getSpecStatus()` — computes a `SpecStatuses` value from task %; never returns `implemented` and is not fed the raw status for `implemented`. UNCHANGED.
- `selectionContextKeys` / `specCommands` bulk grouping — "not completed && not archived ⇒ someActive". An `implemented` multi-select still counts as active for bulk command-palette gating. Out of scope (per-item sidebar is the ticket); note as a known follow-up, do not change.
- `specExplorerProvider` row icon (~L665) — `implemented` falls to the `currentStep` blue-beaker branch (renders as done-ish, not the active spin since `isActive` keys off `activeSpecName`). UNCHANGED.

## Complexity Tracking

No violations.
