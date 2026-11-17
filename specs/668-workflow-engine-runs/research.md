# Research

Checked against the installed Spec Kit CLI 1.4.1.dev0 source.

## Where the size step gets its value

- **Decision**: a `shell` step runs `python3 .specify/extensions/companion/scripts/status-context.py --size` and the switch reads `steps.size.output.stdout`.
- **Rationale**: shell steps expose `stdout` in 1.4.1; the switch strips whitespace before matching. `status-context.py` already resolves the spec through `.specify/feature.json` and is the read side of the record.
- **Alternatives considered**: `capture: true` on the classify command (cannot produce `output.size`, adds a 600 s kill); a new script (two packing lists to update for one print).

## Missing or unknown size

- **Decision**: print nothing, exit 0; the switch falls to `default`, the full pipeline with gates.
- **Rationale**: never skip a phase on doubt; a failing step would abort the run instead.

## Gate verdicts

- **Decision**: one input per review, `review_spec` and `review_plan`, enum `["", "approve", "reject"]`, default `""`. The oversized and default routes share them since only one route runs.
- **Rationale**: a gate keeps a bound input after approve; one shared input would pass every later gate silently. The empty value is what pauses.
- **Alternatives considered**: a single `verdict` input (passes all gates at once).

## Registration

- **Decision**: the doctor's `workflow` check reports a missing or out-of-date `.specify/workflows/speckit-companion/workflow.yml`; `doctor.py --fix` runs `specify workflow add` on the shipped file.
- **Rationale**: extension manifests cannot ship workflows in 1.4.1, and there is no install hook. `workflow add` copies the file, so a Companion update leaves a stale copy the check also catches.
- **Alternatives considered**: registering from a step hook on every run (a write the user never asked for).

## Case keys

- **Decision**: the switch has a case for each verdict in `nodes/specify/_order.yml` that folds or warns; a verdict that does neither (`normal`) is the default route. A test holds this.
- **Rationale**: a `normal` case would duplicate the default steps under new ids.
