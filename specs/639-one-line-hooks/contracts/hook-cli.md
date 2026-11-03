# Contract: hook CLI

The writer, `apps/speckit-extension/scripts/write-context.py`, gains one form that each journaling hook page runs.

```text
write-context.py --hook start --step <step> [--feature-dir <dir>] [--at <time>]
write-context.py --hook finish --step <step> [--feature-dir <dir>] [--at <time>]
```

`--hook` takes `start` or `finish`. `--step` takes `specify`, `plan`, `tasks`, `implement` or `converge`. The writer picks the status itself, so a page never passes `--status`, `--kind` or `--tasks-file`.

## What each call stands for

| Boundary | Step | Same as today's flags |
|---|---|---|
| start | specify | saves the clock beside the lock files, writes no record |
| start | plan | `--kind start --status planning` |
| start | tasks | `--kind start --status tasking` |
| start | implement | `--kind start --status implementing` |
| start | converge | `--kind start`, no status |
| finish | specify | start with the saved `--at` and status `specifying`, then `--kind complete --status specified` |
| finish | plan | `--kind complete --status planned` |
| finish | tasks | `--kind complete --status ready-to-implement` |
| finish | implement | `--tasks-file <feature>/tasks.md` |
| finish | converge | `--kind complete`, no status |

## Rules

- `--at` and `--feature-dir` still pass through unchanged. The editor's own dispatch path keeps passing `--at` on the start call.
- A `--hook` call always exits 0. A failure that would exit non-zero is reported and turned into 0.
- Running the same call twice leaves one start and one finish for the step in the history.
- When no feature folder can be found, or the implement finish finds no tasks list, nothing is written and the exit is still 0.
- A saved specify start older than an hour before the new folder is ignored, and the saved file is deleted once the finish records it.
