---
id: handoff
name: Hand off to the next step
kind: control
command: implement
reads: []
last: true
---
<!-- speckit-companion:part timing -->

<!-- /speckit-companion:part timing -->

**Nothing follows.** This step's own final node wrote `completed`; the run is over.

<!-- speckit-companion:part self-advance -->

<!-- /speckit-companion:part self-advance -->

**Pin the workflow identity in the same call that closes the step.** Record that this spec runs the **Companion** workflow, so the next dispatch is a Companion command and not a stock one. A spec that joined Companion after `specify` has never had this written, and the shared writer defaults `workflow` to `speckit` — so without it the footer advance silently dispatches the stock successor. `--set` writes a plain field and appends no history, so it rides alongside `--advance` rather than costing a call of its own:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step <this step> --advance --by ai --set workflow=companion
```

Idempotent, and a required deterministic write — skip only if `python3` is genuinely unavailable. This replaces the bare `--advance` the timing rules describe; run one or the other, never both.
