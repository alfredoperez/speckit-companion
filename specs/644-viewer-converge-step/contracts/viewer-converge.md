# Contract: the converge result

This feature exposes a record field, a host-derived viewer state field, two footer ids and the strings a test codes against.

## 1. Record: `.spec-context.json`

Field `convergePasses`, a list that only grows, written by the converge start and finish hooks in `apps/speckit-extension/scripts/write-context.py`.

| Key | Written by | Meaning |
|---|---|---|
| `startedAt` | start hook | Pass start time |
| `by` | start hook | `extension` or `ai` |
| `before` | start hook | Task ids in tasks.md at start; dropped at finish |
| `finishedAt` | finish hook | Pass finish time |
| `added` | finish hook | Ids present now and absent in `before`. `[]` is clean, ids is gaps, absent on a finished pass is unknown |
| `completed` | finish hook | `true` when this pass completed the spec |

A write merges, takes the one lock, and never fails the host command. A pass without `added` never reads as clean.

## 2. Host: `ViewerState.converge`

Produced once by `deriveConvergeResult(ctx, tasksContent)` in `apps/vscode/src/features/spec-viewer/convergeResult.ts`, mirrored in `apps/vscode/webview/src/spec-viewer/types.ts`. Absent when converge never ran.

- Outcome: one of gaps, clean, unknown, running.
- Pass rows: one per pass.
- Added tasks still in tasks.md: id, title, checked state.
- `openAdded`: count of those still unchecked.

The pill, card, rail badge, header fact and footer read only this field.

## 3. Footer ids

| Id | Label | Shown when | Effect |
|---|---|---|---|
| `implement-gaps` | `Implement 3 new tasks` (singular `Implement 1 new task`) | `openAdded > 0`; primary | Dispatches implement for this spec |
| `open-tasks` | `Open tasks` | `openAdded > 0` | Switches to the tasks document |

Also: Mark Completed hides while `openAdded > 0`. On a spec completed by a clean converge the existing Converge action is labelled `Converge again`, secondary.

## 4. Verbatim strings

- `CONVERGE FOUND 3 GAPS` (singular: `CONVERGE FOUND 1 GAP`)
- `DONE, BY A CLEAN CONVERGE`
- `Converge checked the code against the spec, plan and tasks, and added these to the end of tasks.md. The spec did not change. Implement them, and converge runs again.`
- `round 2, waiting`
- `2 passes · clean` (one pass: `clean`)
- `3 added by converge`
- `converge clean`
- `Converge added 3 tasks`
- `Open tasks`
- `Implement 3 new tasks`
- `Run complete`
- `Converge again`
- `nothing added`
- `written by the extension`

Card rows: `PASS 1: 3 gaps, added as T013 to T015`, `PASS 2: nothing added`, `COMPLETED: <date> at <time>, written by the extension`.

Rail badge: `+3` on the Tasks item, counting `openAdded`, hidden at zero.

## 5. Rules for consumers

- Task ids and titles reach the screen as text, never as markup.
- A spec where converge never ran renders exactly as before.
- Colours: gaps use `--warning` and `--warning-subtle`, clean uses `--success` and `--success-subtle`, pill text uses `--text-body`.
