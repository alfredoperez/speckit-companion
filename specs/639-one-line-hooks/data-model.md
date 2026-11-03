# Data Model: One-line journaling hooks

No stored record changes shape. `.spec-context.json` history entries are the same as today's; the feature adds one call shape and one small file outside the project.

## Hook call

The single argument set a hook page passes to `write-context.py`.

| Field | Values | Rule |
|---|---|---|
| `--hook` | `start`, `finish` | The boundary. Required together with `--step`. |
| `--step` | `specify`, `plan`, `tasks`, `implement`, `converge` | The step the boundary belongs to. |

The writer translates the call into today's `--kind`, `--status` and `--tasks-file` values before the normal flow runs, so tracing, the plan check and the output line need no new branch. Any non-zero exit inside a hook call is reported and turned into 0 (FR-007). With no findable feature folder, or no tasks list on an implement finish, nothing is written and the exit is 0. A completed spec is never written to.

## Step-to-status table

The one place this table lives is the writer. Pages, manifest descriptions and docs name the boundary and the step only.

| Step | Start records | Finish records |
|---|---|---|
| specify | saved time only, no record | start at the saved time, then finish (status `specified`) |
| plan | start of plan | finish, status `planned` |
| tasks | start of tasks | finish, status `ready-to-implement` |
| implement | start of implement | finish with the finished tasks synced from the feature's tasks list |
| converge | start of converge | finish of converge |

Each boundary writes exactly the entries today's separate calls write, and running a hook twice leaves one start and one finish for the step.

## Saved specify start

A pending-start file that bridges the gap before the specify folder exists.

| Field | Detail |
|---|---|
| Location | Inside the writer's lock root, named by a hash of the project root, so it never shows in git and two projects never share a clock. |
| Content | The real clock time read by the script, never typed by the assistant. |
| Created by | `--hook start --step specify`. |
| Consumed by | `--hook finish --step specify`, which records it as the start and then deletes it. |

Lifetime and transitions:

- Absent to saved: the specify start hook runs. A leftover file from an abandoned run is overwritten.
- Saved to consumed: the specify finish hook runs on the new folder and the saved time is not older than an hour before the folder's creation.
- Saved to ignored: a saved time more than an hour older than the folder is dropped, and the finish records alone.
- Absent at finish: only the finish is recorded (or the start the editor already wrote through its own dispatch path, which still passes a time).
