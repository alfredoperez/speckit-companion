### One idea, four phases

You describe the feature once. Each phase turns the last one into something more concrete, and each writes a file you can read and correct before the next one starts.

| Phase | What lands in `specs/<your-feature>/` |
| --- | --- |
| specify | `spec.md`, the prioritized user stories |
| plan | `plan.md`, the approach and the design artifacts |
| tasks | `tasks.md`, phased and dependency ordered |
| implement | the code, with tasks ticking over live |

Alongside them sits `.spec-context.json`, the small state file that lets the viewer show status, timing, and the Resume button.

### You stay in the loop

The pipeline rail unlocks one phase at a time and one button always offers the next step. Nothing runs ahead of you, and you can leave a review comment on any line before approving a phase.
