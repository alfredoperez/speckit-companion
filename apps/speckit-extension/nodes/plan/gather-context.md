---
id: gather-context
name: Gather context
kind: investigate
command: plan
reads: []
---
1. Read `.specify/feature.json` for the feature directory. The step's start is already stamped, above. Load the feature spec (`<feature_directory>/<short-name>.spec.md`, or `spec.md` in a project written before this) and `.specify/memory/constitution.md` if present. Those are the inputs the plan must satisfy. **Read what `specify` recorded before you open a file.** `specify` writes what it read onto `.spec-context.json` under `context`: the code areas it looked at and the constraints it found there. Read those entries first. They name where the feature attaches, so open the files they point at instead of rediscovering them. They carry locations, not content, so you still open the files that matter, filling gaps in a map you were handed. If no `context` entries were recorded, investigate from scratch as below.

Then **investigate the codebase** to understand where this feature attaches: the patterns it must follow (state/store, routing, persistence, component and test conventions) and the exact files it will touch.

**Before you open a source file, run this and do exactly what it prints:**

```bash
python3 .specify/extensions/companion/scripts/dispatch-briefs.py --feature-dir <feature_directory>
```

When it prints reader briefs, dispatch every one of them in a single message, unedited. That is not a judgement call: it holds in an auto run, for short features, and when specify already sent readers, because those mapped where the feature lands and these find the pattern to copy. When it prints `Working inline`, read the code yourself. Hand each worker the slice the load above already resolved for its area, so it reads code to fill the gaps rather than to relearn what is written down. Each worker returns a **distilled finding**: the pattern to copy, the concrete file paths, the conventions to match, and anything the code does that its slice does not account for. Never file contents. One area, or no subagent tool: read it yourself. Collect the findings as the research basis for the plan.
