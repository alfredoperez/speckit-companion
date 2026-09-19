---
id: handoff
name: Hand off to the next step
kind: control
command: tasks
reads: []
last: true
---
<!-- speckit-companion:part timing -->

<!-- /speckit-companion:part timing -->

**The next step is `implement`.** Dispatch `speckit.companion.implement <feature_dir>`.

<!-- speckit-companion:part self-advance -->

<!-- /speckit-companion:part self-advance -->

**Pin the workflow identity in the same call that closes the step.** Record that this spec runs the **Companion** workflow, so the next dispatch is a Companion command and not a stock one. The shared writer defaults `workflow` to `speckit`, so without this the footer advance dispatches the stock successor. `--set` writes a plain field and appends no history, so it rides along with `--advance`:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step <this step> --advance --by ai --set workflow=companion
```

Idempotent, and a required deterministic write. Skip only if `python3` is genuinely unavailable. This replaces the bare `--advance` the timing rules describe: run one or the other, never both.
