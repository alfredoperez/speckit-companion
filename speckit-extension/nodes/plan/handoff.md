---
id: handoff
name: Hand off to the next step
kind: control
command: plan
reads: []
last: true
---
<!-- speckit-companion:part timing -->

<!-- /speckit-companion:part timing -->

<!-- speckit-companion:part self-advance -->

<!-- /speckit-companion:part self-advance -->

**Pin the workflow identity before handing off.** Record that this spec runs the **Companion** workflow, so the next dispatch is a Companion command and not a stock one. A spec that joined Companion after `specify` has never had this written, and the shared writer defaults `workflow` to `speckit` — so without this the footer advance silently dispatches stock `/speckit.plan`'s successor. Idempotent, and a required deterministic write (skip only if `python3` is genuinely unavailable):

```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --set workflow=companion
```
