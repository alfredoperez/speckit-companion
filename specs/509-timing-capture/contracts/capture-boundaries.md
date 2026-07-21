# Contract: capture invocations per surface

The writer script's CLI is the interface; these are the exact call shapes each surface must carry after the change. `W` = `python3 .specify/extensions/companion/scripts/write-context.py`.

## Step boundaries

| Surface | Invocation |
|---|---|
| `nodes/plan/gather-context.md` step 1 (new) | `W --feature-dir <feature_directory> --step plan --status planning --kind start --by extension` |
| `nodes/tasks/tasks-doc.md` step 1 (new) | `W --feature-dir <feature_directory> --step tasks --status tasking --kind start --by extension` |
| `commands/speckit.companion.after-plan.md` (changed) | `W --step plan --status planned --kind complete --by extension` |
| `commands/speckit.companion.after-tasks.md` (changed) | `W --step tasks --status ready-to-implement --kind complete --by extension` |
| `presets/_parts/timing.md` self-close (narrowed) | `W --feature-dir <feature_dir> --step <clarify|analyze> --finish --by ai` — plan/tasks/specify/implement excluded |

## Per-task cadence (implement)

| Surface | Invocation |
|---|---|
| Task finish (any agent, unchanged) | `W --feature-dir <feature_dir> --task <TaskID> --kind complete --by ai --did "…" --files "…" --append` |
| Fold (MAIN agent only, now per task) | `W --feature-dir <feature_dir> --materialize` — immediately after each task's finish lands (own work: right after the append; worker: as its result returns), foreground, one at a time; repeated at the wave join as a backstop |

## Unchanged invocations (context for reviewers)

- specify start/complete: body script `--step specify --status specifying|specified --kind start|complete --by extension`.
- implement start: body script `--step implement --status implementing --kind start --by extension`; implement close: `after_implement` hook (`--tasks-file`) / `tasks.md` watcher.
- Substep finishes: `--step <step> --substep <name> --finish --by ai` (plan: research, design; tasks: generate).
