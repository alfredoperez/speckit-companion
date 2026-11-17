# Data Model

The feature adds no stored entity and no new field in `.spec-context.json`. It reads one existing field and reshapes two workflow-file constructs.

## Recorded size (existing, read only)

- **Where**: the `size` value the specify step records in the spec's `.spec-context.json`, found through `.specify/feature.json`.
- **Values**: `simple`, `normal`, `oversized`. Anything else, or no value, is treated as absent.
- **Read by**: `status-context.py --size`, which prints the value or nothing and always exits 0 (FR-001, edge cases).
- **Validation**: a missing `.specify/feature.json`, a missing record, a read error or an unknown value prints nothing (FR-003).

## Size step output

- **Shape**: `steps.size.output.stdout`, a string: `simple`, `normal`, `oversized` or empty. The switch strips whitespace before matching.
- **Replaces**: the `classify` command step and the unused `scope` input (FR-004).

## Route (switch on `steps.size.output.stdout`)

| Case key | Route |
|---|---|
| `simple` | implement only, no plan, tasks or gates |
| `oversized` | warn, then gate `review_spec`, plan, gate `review_plan`, tasks, implement |
| default (`normal`, empty, unknown) | gate `review_spec`, plan, gate `review_plan`, tasks, implement |

- **Rule**: case keys equal the verdicts in `nodes/specify/_order.yml` that fold or warn; `normal` has no case (FR-002, FR-007).
- **Transitions**: size read, then one route chosen, then converge. A route is never re-chosen in a run.

## Gate verdict inputs

| Input | Gate | Type | Default |
|---|---|---|---|
| `review_spec` | spec review | enum `["", "approve", "reject"]` | `""` |
| `review_plan` | plan review | enum `["", "approve", "reject"]` | `""` |

- **Rule**: each gate names its own input through `verdict_input` (FR-005). Oversized and default routes share them since only one route runs.
- **Gate states**: empty pauses the run; `approve` continues; `reject` aborts. Approving one gate leaves the other empty, so the next gate pauses again.

## Workflow registration

- **Entity**: `.specify/workflows/speckit-companion/workflow.yml`, a copy of the shipped `workflow.yml` made by `specify workflow add`.
- **States**: missing, stale (differs from the shipped file), registered.
- **Doctor `workflow` check**: reports missing or stale with the exact `specify workflow add` command; reports nothing when registered (FR-006).
- **`--fix`**: runs `specify workflow add` on the shipped file. When `specify` is not on the PATH it prints the command instead of failing.
- **Transitions**: missing or stale, then `--fix`, then registered.
