# Data Model: The viewer shows converge as its own step

Two layers: the pass the writer records in `.spec-context.json`, and the converge result the host derives once for the viewer.

## 1. ConvergePass (stored)

One entry of the new top-level `SpecContext.convergePasses` list, written only by the converge start and finish hooks in `apps/speckit-extension/scripts/write-context.py`.

| Field | Type | Set by | Notes |
|---|---|---|---|
| `startedAt` | ISO timestamp | start hook | Always present. |
| `by` | `extension` or `ai` | start hook | Who wrote the pass. |
| `before` | string[] | start hook | Task ids in tasks.md at start. Dropped at finish. |
| `finishedAt` | ISO timestamp | finish hook | Absent while the pass is open. |
| `added` | string[] | finish hook | Ids present at finish and absent in `before`. Absent when no snapshot existed. |
| `completed` | boolean | finish hook | True only when this pass completed the spec. |

Validation rules:
- The list only grows. A start appends; a finish fills the last open pass and never rewrites an older one.
- Writes merge under the one cross-process lock and never touch `history`. A failure is swallowed by the existing wrapper and never fails the host command.
- `added` is a set difference of task ids, so it is stable and has no duplicates.
- `added: []` is clean. `added` with ids is gaps. A finished pass with no `added` key is unknown and must never read as clean (FR-010).
- `completed` requires `added: []` and every task checked.
- Converge run twice with no implement between writes two passes.
- A pass written before this change has no `before` or `added`, so it reads as unknown.

State of a pass: open (no `finishedAt`) to finished. It does not move back.

## 2. ConvergeResult (derived, `ViewerState.converge`)

Built once by `deriveConvergeResult(ctx, tasksContent)` in `apps/vscode/src/features/spec-viewer/convergeResult.ts`. Absent when `convergePasses` is empty, so a spec where converge never ran renders as before (SC-004). The webview keeps a mirror type in `webview/src/spec-viewer/types.ts` that changes in step with the host's.

| Field | Type | Meaning |
|---|---|---|
| `outcome` | `running`, `gaps`, `clean`, `unknown` | From the latest pass: open is running, non-empty `added` is gaps, empty is clean, missing is unknown. |
| `passCount` | number | Number of passes. |
| `passes` | PassRow[] | One row per pass, in order. |
| `addedTasks` | AddedTask[] | Ids from the latest pass's `added` that are still in tasks.md. |
| `openAdded` | number | Count of `addedTasks` still unchecked. |
| `completedBy` | `{ at, by }` or absent | From the pass with `completed: true`. Feeds the COMPLETED row. |

**PassRow**: `index` (1-based), `outcome` (gaps, clean, unknown, running), `addedIds` (string[]), so a row reads "3 gaps, added as T013 to T015" or "nothing added".

**AddedTask**: `id`, `title` (plain text from `taskTitle`), `checked` (boolean).

Validation rules:
- `addedTasks` lists only ids still in tasks.md. A deleted task drops out and the counts follow.
- Titles are text only. Task ids and titles reach the screen through text nodes, never markup (FR-012).
- `openAdded` is the one count. The header fact, the "+N" rail badge, the card heading and the footer button all read it (FR-009, SC-003). Singular "1 gap" and "1 new task" follow from the count.
- A latest pass that is gaps with `openAdded` of 0 stays gaps until converge runs again; badge and button counts show zero and hide.
- A completed spec whose latest pass added tasks reads amber gaps, not green.

## 3. Outcome transitions

| From | To | Trigger |
|---|---|---|
| none | running | Converge starts, a pass opens. |
| running | gaps | Finish writes non-empty `added`. |
| running | clean | Finish writes `added: []`. |
| running | unknown | Finish with no snapshot. |
| gaps, clean, unknown | running | Converge runs again. A new pass is appended. |

Clean with every task checked also sets `completed` on that pass, and the existing completion path moves the spec to completed.

## 4. Surfaces and what they read

| Surface | Reads | Shown when |
|---|---|---|
| Overview pill | `outcome`, `passCount`, `addedTasks.length` | Result present. Amber for gaps, green for clean. |
| Gaps card | `addedTasks` | `outcome` is gaps. Also a waiting implement round "round 2, waiting". |
| Clean card | `passes`, `completedBy` | `outcome` is clean and the spec completed. |
| Header fact | `openAdded`, `outcome` | "N added by converge" while `openAdded` > 0, "converge clean" when clean. |
| Rail badge on Tasks | `openAdded` | "+N" while `openAdded` > 0. |
| Footer | `openAdded`, `outcome` | `implement-gaps` (primary) and `open-tasks` while `openAdded` > 0, with Mark Completed hidden. "Converge again" and "Run complete" on a cleanly completed spec. |

## 5. Footer action ids

New catalogue ids in `core/constants.ts`: `implement-gaps` ("Implement N new tasks", dispatches implement for this spec through the existing step dispatch) and `open-tasks` ("Open tasks", switches to the tasks document). Converge is relabelled "Converge again" on a cleanly completed spec. No new setting is added.

## Out of scope

Per-round implement durations (FR-011) are deferred: writers record one implement start per spec, so a second round has no honest start to measure from.
