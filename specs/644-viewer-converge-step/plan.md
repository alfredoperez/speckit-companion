# Plan: The viewer shows converge as its own step

**Scale note**: about 25 files across three areas: the spec-kit extension's writer, the VS Code host's viewer state and footer, and the webview's overview, rail, run strip and footer. Watch the seams. One converge result is derived once on the host and every surface reads it. The webview keeps a second copy of the `ViewerState` type that must change in step with the host's.

## Summary

Each converge pass gets its own record. The start hook snapshots the task ids in tasks.md. The finish hook writes the ids that appeared since, whether the pass completed the spec, and who wrote it. The host turns those passes plus tasks.md into one converge result on the viewer state: the latest outcome (gaps, clean, unknown, running), the added tasks still open with their titles, and the pass rows. The webview draws that result as a pill on the overview row, a gaps or clean card under it, a "+N" badge on the Tasks rail item, a run-strip fact, and the footer copy and actions.

Per-round implement durations (FR-011, a SHOULD) are deferred: the writers record one implement start per spec, so a second round has no honest start to measure from. See research.md.

## Project Structure

```text
apps/speckit-extension/
  scripts/write-context.py              converge start/finish hooks write the pass
  tests/test_converge_passes.py         new
apps/vscode/src/
  core/types/specContext.ts             SpecContext.convergePasses, ViewerState.converge
  core/constants.ts                     footer ids: implement-gaps, open-tasks
  core/utils/taskCheckboxes.ts          taskTitle helper
  features/spec-viewer/convergeResult.ts   new: the one derivation
  features/spec-viewer/specViewerProvider.ts  readViewerState attaches the result
  features/spec-viewer/stateDerivation.ts     passes the result to the footer
  features/spec-viewer/footerActions.ts       new actions, hide Mark Completed, relabel Converge
  features/spec-viewer/messageHandlers.ts     handlers for the two new ids
apps/vscode/webview/src/spec-viewer/
  types.ts                              ViewerState.converge mirror
  components/OverviewDossier.tsx        converge pill, round-waiting phase, ConvergeCard
  components/RunStrip.tsx               converge fact
  components/NavigationBar.tsx, StepTab.tsx   "+N" badge
  components/footer/CatalogFooter.tsx   context line, primary variant
  matching *.stories.tsx and __tests__
apps/vscode/webview/styles/spec-viewer/ _overview-dossier.css, _navigation.css, _base.css
apps/copilot-canvas/.../vendor/viewer.css   rebuilt
CHANGELOG.md, apps/speckit-extension/CHANGELOG.md
```

**Structure Decision**: the writer owns the facts, `convergeResult.ts` owns the one interpretation, and every webview surface only renders fields of that result.

## Call paths

```calls A converge pass is recorded
  _main() @ apps/speckit-extension/scripts/write-context.py:664
+   _open_converge_pass() @ apps/speckit-extension/scripts/write-context.py:1178
~   _after_converge() @ apps/speckit-extension/scripts/write-context.py:569
      _complete_after_clean_converge() @ apps/speckit-extension/scripts/write-context.py:556
        parse_task_markers() @ apps/speckit-extension/scripts/task_sync.py:70
+     _close_converge_pass() @ apps/speckit-extension/scripts/write-context.py:569
```
note: the pass closes after the completion attempt, so it can say whether this pass completed the spec.

```calls The host derives the converge result once
  readViewerState() @ apps/vscode/src/features/spec-viewer/specViewerProvider.ts:1518
    deriveViewerState() @ apps/vscode/src/features/spec-viewer/stateDerivation.ts:370
+     deriveConvergeResult() **new** @ apps/vscode/src/features/spec-viewer/convergeResult.ts
+       taskTitle() @ apps/vscode/src/core/utils/taskCheckboxes.ts:50
~     getFooterActions() @ apps/vscode/src/features/spec-viewer/footerActions.ts:250
```
note: readViewerState reads tasks.md itself when passes exist, because context-only refreshes skip the content read.

```calls The overview draws it
  OverviewTiming() @ apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx:37
~   converge phase as a pill @ apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx:56
+   ConvergeCard() @ apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx:85
```
note: RunStrip, StepTab and CatalogFooter read the same result field and make no new calls.

## States

```states The converge outcome the viewer shows
None: Converge never ran; nothing about it shows. (start)
Running: A pass started and has not finished.
Gaps: The latest pass added tasks; some are still open. shows gaps (proposed)
Unknown: A pass finished with no task snapshot. (proposed)
Clean: The latest pass added nothing. shows clean (proposed)
None -> Running: converge starts
Running -> Gaps: finish adds ids (proposed)
Running -> Clean: finish adds none (proposed)
Running -> Unknown: finish, no snapshot (proposed)
Gaps -> Running: implement, then converge again
Clean -> Running: converge again
Unknown -> Running: converge again
grid:
None | Running | Gaps
.    | Unknown | Clean
```
note: a gaps pass whose added tasks are all checked stays Gaps until converge runs again; the badge and button counts drop to zero.

## Screens

```screen gaps Overview after converge found gaps
title: Saved filters for the orders list
row:
  chip: IMPLEMENTED
  text: 9/12 tasks · 3 added by converge (new) (1)
  text: Tasks +3 in the rail (changed) (2)
row:
  text: Specify · Plan · Tasks · Implement
  chip: Converge 2m 31s · 3 gaps (new) (3)
  text: Implement round 2, waiting (new)
text: CONVERGE FOUND 3 GAPS (new) (4)
list: T013 title | T014 title | T015 title
row:
  text: Converge added 3 tasks (new)
  button: Implement 3 new tasks (new) (5)
```
1: **One count everywhere.** The fact, badge and button read the same open-added count.
2: **Badge on Tasks.** Counts added tasks still unchecked; hidden at zero.
3: **Amber pill.** Warning tint with a loop icon; replaces converge's plain dot.
4: **Gaps card.** Ids as chips, titles as text from tasks.md.
5: **Primary action.** Runs implement on this spec, beside a new Open tasks button; Mark Completed hides meanwhile.

```screen clean Overview after a clean converge
title: Saved filters for the orders list
row:
  chip: COMPLETED
  text: 12/12 tasks · converge clean (new)
row:
  text: Specify · Plan · Tasks · Implement
  chip: Converge 2 passes · clean (new) (1)
text: DONE, BY A CLEAN CONVERGE (new) (2)
list: PASS 1 3 gaps, added as T013 to T015 | PASS 2 nothing added | COMPLETED date, written by the extension
row:
  text: Run complete
  button: Converge again (changed) (3)
```
1: **Green pill.** Success tint; the one place converge glows green.
2: **Clean card.** One row per pass, then who completed it and when.
3: **Relabel only.** The existing Converge action, renamed on a cleanly completed spec.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. No new setting; the record field is additive and the schema allows extra fields. |
| II. Spec-Driven Workflow | PASS. Makes converge, the step that decides done, visible in the viewer. |
| III. Visual and Interactive | PASS. Built from the approved mock; stories and clips updated. |
| IV. Modular Architecture | PASS. Writer, one host derivation, and render-only webview surfaces stay in their layers; `core/` gains types only. |

Re-checked after design: no change.
