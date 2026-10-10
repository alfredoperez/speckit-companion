# Contract: the start hook and the preset cleanup

## `speckit.companion.before-step`

Registered for `before_specify`, `before_plan`, `before_tasks`, `before_implement`.

- For plan, tasks and implement it runs `write-context.py --step <step> --status <planning|tasking|implementing> --kind start --by extension`.
- For specify it runs no writer. It reads the clock in UTC and keeps the printed value for `after_specify`.
- It never asks the user anything and never fails the host command.

## `speckit.companion.after-specify`

- When a time was read: `write-context.py --step specify --status specifying --kind start --by extension --at <time>`.
- Always: `write-context.py --step specify --status specified --kind complete --by extension`.

## Preset cleanup at editor start

- Runs `specify preset remove <id>` for each of `companion-standard`, `companion-turbo`, `companion-lean`, `sdd-lean` whose folder exists under `.specify/presets/`.
- Never runs `specify preset add` or `specify preset enable`.
- A failing command is logged to the output channel and does not throw.

## Prompt prepended to a stock step

- A command whose name does not contain `companion` gets the full stock preamble, with or without the extension installed.
- That text does not contain `command's body carries the full`.
- A `/speckit.companion.*` command gets the same short text as before.
