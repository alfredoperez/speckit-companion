# Research: The viewer shows converge as its own step

## 1. Where a pass is recorded

**Decision**: a new top-level list, `convergePasses`, written only by the converge start and finish hooks. The start hook appends `{startedAt, by, before}`, where `before` is the task ids in tasks.md. The finish hook fills the last open pass with `finishedAt`, `added` (ids now present that were absent in `before`), and `completed` when this pass completed the spec, then drops `before`.

**Rationale**: history keeps only the first converge start and the first finish (`_has_step_start`, `_has_complete`), so pass 2 onward cannot be read back from history. A field next to `convergeStartedAt`, written in the same locked turn, keeps every guarantee: history is untouched, the list only grows, the one lock already covers the hook, and the existing `except Exception` wrapper keeps it never-fail. Dropping `before` at finish keeps the record small.

**Alternatives considered**: history entries per pass, rejected because the dedupe rules exist on purpose and loosening them for one step would change every derivation that groups by step. A sidecar file, rejected because `.spec-context.json` is the one store.

## 2. What "clean" means

**Decision**: a pass with `added: []` is clean, `added` with ids is gaps, a finished pass with no `added` key is unknown. `_complete_after_clean_converge` uses the same rule when the open pass has a snapshot, and keeps today's modified-time rule only for a pass without one.

**Rationale**: the pill and the completion must never disagree. Under the old rule alone, a converge that rewords a task leaves the spec implemented while an id diff says clean. One rule, used by the writer and read by the viewer, removes that split. Tasks must still be all checked to complete, so unchecking a box still blocks completion.

**Alternatives considered**: keep the modified-time rule and have the viewer read `completed` as clean. Rejected: a converge on an already completed spec never completes anything, so its clean pass would read as unknown.

## 3. Who and when for the COMPLETED row

**Decision**: the pass that completed the spec carries `completed: true`, its `finishedAt` and `by`. The card's COMPLETED row reads those.

**Rationale**: `mark_spec_complete` writes no timestamp or author of its own, and adding one there would touch the manual path too. The pass already knows both.

## 4. One derivation for every surface

**Decision**: `deriveConvergeResult(ctx, tasksContent)` in `apps/vscode/src/features/spec-viewer/convergeResult.ts`, called once in `readViewerState`, stored as `ViewerState.converge`, and passed into `getFooterActions`. It returns the outcome, the pass rows, the added tasks still in tasks.md with title and checked state, and `openAdded`, the count of those still unchecked. The pill, card, rail badge, run-strip fact and footer read only this.

**Rationale**: the review checklist asks for one fact derived once. Context-only refreshes skip the tasks.md read, which is the refresh converge's finish triggers, so `readViewerState` reads tasks.md itself when passes exist.

**Alternatives considered**: deriving in the webview, rejected because the webview never touches files and the footer is built on the host.

## 5. Task titles

**Decision**: a `taskTitle(rawLine)` helper beside `taskId` in `taskCheckboxes.ts`, reading the raw line after the id so backticked text survives.

**Rationale**: it is the one TypeScript task reader and already shares its grammar with `task_sync.py`.

## 6. The footer

**Decision**: two new catalogue ids. `implement-gaps` ("Implement N new tasks", primary) shows while `openAdded > 0` and dispatches the implement command for this spec through the same path the step dispatch uses. `open-tasks` ("Open tasks") switches the viewer to the tasks document. Mark Completed hides while `openAdded > 0`. On a spec whose latest pass is clean and which is completed, Converge is relabelled "Converge again". The context line reads "Converge added N tasks" while `openAdded > 0`.

**Rationale**: no implement action exists, and approve or regenerate route on `currentStep`, which is `converge` here. A dedicated id dispatches implement explicitly. A second implement run's step start is deduped by the writers; that is fine, because task closes still land and the next converge pass closes the round.

## 7. Per-round implement durations (FR-011)

**Decision**: deferred. The implement entry keeps its current duration.

**Rationale**: the writers record one implement start per spec, so round 2 has no recorded start. Measuring from pass 1's finish would bill the wait before round 2 as work, which the project forbids (active span, not wall clock). A round start needs its own record, a separate change. The "round N, waiting" phase still shows that a second round is due.

## 8. Colour

**Decision**: gaps use `--warning` and `--warning-subtle`, clean uses `--success` and `--success-subtle`, text inside the pills uses `--text-body`. The pill keeps its own shape so its green reads apart from the plain done dots.

**Rationale**: DESIGN.md allows green for the pipeline's done state and forbids raw hex in partials.
