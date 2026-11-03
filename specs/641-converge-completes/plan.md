# Plan: A clean converge completes the spec

## Summary

After `write-context.py --hook finish --step converge` records converge's finish, the writer checks whether the spec can be completed: status `implemented`, every task checked, and `tasks.md` not modified since converge's start. If so it calls the existing `mark_spec_complete(feature_dir, "extension")`, the one writer of `completed`. The mark-complete command page shrinks to one sentence and one `--mark-complete` call, kept for manual use and as the workflow engine's terminal step.

## Project Structure

```text
apps/speckit-extension/
├── scripts/write-context.py                         # converge finish chains a gated mark_spec_complete
├── commands/speckit.companion.mark-complete.md      # one sentence, one command
├── extension.yml                                    # its description matches the page
├── docs/commands.md                                 # the converge hook completes a clean spec
├── tests/test_converge_completes.py                 # new
└── CHANGELOG.md
```

**Structure Decision**: the completion stays in `mark_spec_complete`; the converge hook only decides when to call it.

## Call paths

```calls a clean converge completes the spec
  _main() @ apps/speckit-extension/scripts/write-context.py:442
    update_context() @ apps/speckit-extension/scripts/write-context.py:161
+   _complete_after_clean_converge() @ apps/speckit-extension/scripts/write-context.py:557
      _feature_tasks_at_100() @ apps/speckit-extension/scripts/task_sync.py:133
      mark_spec_complete() @ apps/speckit-extension/scripts/write-context.py:557
```

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: works through spec-kit's own after_converge hook. |
| II. Spec-Driven Workflow | PASS: completed follows a clean converge, as the owner decided. |
| III. Visual and Interactive | PASS: finished stock runs show as completed. |
| IV. Modular Architecture | PASS: one writer of completed, called from one more place. |
