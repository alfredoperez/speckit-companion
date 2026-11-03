# Plan: Step boundaries from runtime events

## Summary

Companion declares two spec-kit runtime event handlers, one for `user_prompt_submit` and one for `stop`, each a command whose `scripts: py:` line runs `write-context.py --event <name>`. The writer gains an `--event` mode that reads the agent's JSON from stdin and turns it into the existing `--hook` rewrite: a typed step command becomes `--hook start`, and a stop becomes `--hook finish` only when a step is open, its document changed after its start, and for implement every task is checked. In event mode the writer prints nothing on either stream and always exits 0, because the dispatcher shows stdout to the agent and an exit of 2 blocks it. An older spec-kit ignores the `events:` key, so the hooks keep recording there.

## Project Structure

```text
apps/speckit-extension/
├── scripts/write-context.py                      # --event: stdin payload → _apply_hook; silent; exit 0
├── commands/speckit.companion.on-prompt.md       # scripts: py: scripts/write-context.py --event user_prompt_submit
├── commands/speckit.companion.on-stop.md         # scripts: py: scripts/write-context.py --event stop
├── extension.yml                                 # provides.commands + events: {user_prompt_submit, stop}
├── scripts/check_quality.py                      # NEVER_PROMPT lists the two handlers
├── README.md, docs/commands.md                   # name the handlers beside the hooks
├── tests/test_event_mode.py                      # new
└── CHANGELOG.md
```

**Structure Decision**: no new script. The handlers call the writer that already owns the hook rewrite, so the packing lists stay as they are.

## Call paths

```calls a typed step command stamps its start
  main() @ apps/speckit-extension/scripts/write-context.py:1243
~   _main() @ apps/speckit-extension/scripts/write-context.py:442
+     _apply_event() @ apps/speckit-extension/scripts/write-context.py:442
        _apply_hook() @ apps/speckit-extension/scripts/write-context.py:363
```
note: main() swaps both streams for a buffer in event mode and returns 0 whatever happens.

```calls a stop closes a finished step
  _apply_event() @ apps/speckit-extension/scripts/write-context.py:442
+   _open_step() @ apps/speckit-extension/scripts/write-context.py:442
+   _done_since_start() @ apps/speckit-extension/scripts/write-context.py:442
      _feature_tasks_at_100() @ apps/speckit-extension/scripts/task_sync.py
    _apply_hook() @ apps/speckit-extension/scripts/write-context.py:363
```

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: uses spec-kit's own runtime events; projects can turn events off with spec-kit's `--events false`. |
| II. Spec-Driven Workflow | PASS: step boundaries land closer to the real work. |
| III. Visual and Interactive | PASS: the viewer reads the same history with better times. |
| IV. Modular Architecture | PASS: one writer, one rewrite, two thin handlers. |
