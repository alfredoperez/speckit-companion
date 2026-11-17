# Contract: Companion workflow on the Spec Kit engine

The feature exposes a CLI and file-schema surface: the workflow file, its inputs, two script flags and a doctor check. No API or UI routes.

## CLI commands a consumer or test codes against

| Command | Behaviour |
|---|---|
| `specify workflow run` (`specify workflow run speckit-companion`) | Starts the Companion workflow on the engine. |
| `specify workflow resume <run id> --input` | Resumes a paused run, e.g. `--input review_spec=approve`. |
| `specify workflow list` | Lists registered workflows; must include `speckit-companion` after install plus the doctor fix. |
| `specify workflow add` | Registers the shipped workflow (`apps/speckit-extension/workflows/speckit-companion.workflow.yml`); run by the doctor fix. |

## Workflow inputs (gate verdicts)

| Gate | `verdict_input` | Enum | Default |
|---|---|---|---|
| spec review | `review_spec` | `["", "approve", "reject"]` | `""` |
| plan review | `review_plan` | `["", "approve", "reject"]` | `""` |

- Empty pauses the gate, `approve` continues, `reject` aborts the run.
- One input per gate; the oversized and default routes share them (only one route runs). Passing one gate never passes the next.
- The `scope` input is removed.

## Size step and route switch

- Step `size` (type `shell`) runs `python3 .specify/extensions/companion/scripts/status-context.py --size`.
- Output `steps.size.output.stdout`: one of `simple`, `normal`, `oversized`, or empty.
- `route` (switch on `steps.size.output.stdout`):

| Value | Route |
|---|---|
| `simple` | implement only; skips plan, tasks and both gates |
| `oversized` | warn, gate `review_spec`, plan, gate `review_plan`, tasks, implement |
| default (`normal`, empty, unknown) | gate `review_spec`, plan, gate `review_plan`, tasks, implement |

- Case keys equal the verdicts in `nodes/specify/_order.yml` that fold or warn; `normal` has no case.
- Verdicts: `simple`, `normal`, `oversized`.

## `status-context.py --size`

- Reads the size from `.spec-context.json` found through `.specify/feature.json`; read-only.
- Prints the recorded size, or nothing; always exits 0 (missing `.specify/feature.json`, missing record or read error print nothing).

## Doctor

- `doctor.py` gains a project-level `workflow` check (`check_workflow(root)` in `doctor_checks.py`): reports a missing or stale `.specify/workflows/speckit-companion/workflow.yml` with the exact `specify workflow add` command; reports nothing when registered and current.
- `doctor.py --fix` runs `specify workflow add` on the shipped file; if `specify` is not on the PATH it prints the command instead of failing.

## Unchanged

- `speckit.companion.auto` behaves as before; `.spec-context.json` history lists the same steps in the same order on engine and auto runs.
