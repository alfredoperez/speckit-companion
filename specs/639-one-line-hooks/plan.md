# Plan: One-line journaling hooks

## Summary

Each of the seven journaling hook pages shrinks to one sentence and one `write-context.py --hook start|finish --step <step>` call. The writer turns that call into exactly the flags the pages pass today (the same `update_context` and `sync_tasks` calls), so a stock run's history does not change. The specify start, which has no folder to write to yet, is saved to a small file beside the writer's lock files and recorded by the specify finish. The shared hooks part tells a Companion step to report an unreadable `.specify/extensions.yml` the way stock commands now do.

## Project Structure

```text
apps/speckit-extension/
├── scripts/write-context.py          # --hook: translate to today's flags; specify start saved, finish records it
├── scripts/spec_context.py           # pending-start path beside the lock root
├── commands/speckit.companion.{before-step,after-specify,after-plan,after-tasks,after-implement,before-converge,after-converge}.md
├── presets/_parts/speckit-hooks.md   # report an unparseable extensions.yml
├── commands/speckit.companion.{specify,plan,tasks,implement}.md   # rebuilt by build.py
├── extension.yml                     # hook descriptions stop restating the status table
├── docs/how-it-works.md, docs/commands.md
├── tests/test_before_step_hook.py    # rewritten for the one-line pages
├── tests/test_hook_mode.py           # new: parity with today's calls, specify handoff, exit 0
└── CHANGELOG.md
```

**Structure Decision**: the step-to-status table lives once, in the writer; pages, manifest descriptions and docs name the boundary and the step only.

## Call paths

```calls a hook page records a boundary
  _main() @ apps/speckit-extension/scripts/write-context.py:442
+   _apply_hook() @ apps/speckit-extension/scripts/write-context.py:442
      update_context() @ apps/speckit-extension/scripts/write-context.py:161
      sync_tasks() @ apps/speckit-extension/scripts/task_sync.py
+     pending_start_path() @ apps/speckit-extension/scripts/spec_context.py:397
```
note: every other line of `_main()` runs unchanged on the translated arguments, so tracing, the plan check and the output line need no new branch.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: hooks still fire through spec-kit's own `extensions.yml`. |
| II. Spec-Driven Workflow | PASS: a stock run records the same steps, with less for the assistant to get wrong. |
| III. Visual and Interactive | PASS: the viewer reads the same history. |
| IV. Modular Architecture | PASS: one table in one writer replaces seven pages and a manifest restating it. |
