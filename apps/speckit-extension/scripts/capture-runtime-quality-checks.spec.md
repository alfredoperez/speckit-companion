# Capture runtime quality checks — Living Spec

## Purpose

The deterministic evals that grade a run after the fact: whether a spec's capture followed the schema, whether a living-spec fold applied its deltas correctly, whether the commands a step wrote stayed within budget, and how a step decides whether to dispatch subagents at all.

## Requirements

### A capture is graded against the schema it was written under, never a hardcoded copy
<!-- touches: apps/speckit-extension/scripts/check_capture.py -->

Checking a spec's `.spec-context.json` SHALL read the canonical steps and statuses from `spec-context.schema.json` when it can be found, and SHALL fall back to an inline copy only when the schema is unreadable.

#### Scenario: the schema file cannot be located
- **WHEN** the eval walks up from its own location and finds no schema
- **THEN** it still runs, scored against its built-in fallback list

### A handtyped timestamp fails the eval, a captured one does not
<!-- touches: apps/speckit-extension/scripts/check_capture.py -->

Every history entry's timestamp SHALL be checked for being real wall-clock capture rather than a round or hand-entered value, and SHALL be checked for staying monotonic across the file.

#### Scenario: a timestamp lands on an exact round second with no sub-second precision
- **WHEN** the eval scores realness
- **THEN** that entry is flagged as likely handtyped

#### Scenario: two entries are out of order
- **WHEN** the eval checks monotonicity
- **THEN** it fails, naming which pair is out of order

### A living-spec fold is checked against the deltas it claims to have applied
<!-- touches: apps/speckit-extension/scripts/check_living_spec.py -->

Given a feature spec's delta blocks and the living spec before and after a fold, the eval SHALL assert that every ADDED heading is now present, every REMOVED heading is now gone, every MODIFIED body actually changed, every RENAMED heading moved, the requirement-count change matches added minus removed, and re-applying the same deltas to the after-spec changes nothing.

#### Scenario: a MODIFIED requirement's body is byte-identical before and after
- **WHEN** the eval checks it
- **THEN** that check fails, naming the requirement as unchanged

#### Scenario: the deltas are re-applied to the already-folded spec
- **WHEN** the idempotency check runs
- **THEN** it passes only if the result is byte-identical to the input

### An oversized artifact warns or fails against a budget calibrated per kind
<!-- touches: apps/speckit-extension/scripts/check_quality.py -->

Each artifact a step wrote SHALL be scored against its own warn and fail line/character thresholds; missing or empty is reported informational, not a defect, because an absent artifact is a different problem this eval does not own.

#### Scenario: an artifact is absent
- **WHEN** the quality eval scores it
- **THEN** it is reported as absent and not scored, rather than as oversized

### A WARN-tier finding never fails a strict run; only FAIL does
<!-- touches: apps/speckit-extension/scripts/check_quality.py -->

The quality eval SHALL exit non-zero under `--strict` only when a FAIL-severity finding exists; any number of WARN or INFO findings SHALL leave the exit code unaffected.

#### Scenario: a run has a step-duration outlier and nothing else
- **WHEN** `--strict` is passed
- **THEN** the exit code is still zero, because an outlier is judgment-call severity

### A clarify-type command that never asks the user is a defect, not a style note
<!-- touches: apps/speckit-extension/scripts/check_quality.py -->

Scanning the command roster SHALL fail a clarify-type command that contains no instruction asking the user a question, and SHALL fail any other roster command that does contain one, since only the clarify family is meant to pause for an answer. A phrase that says the opposite — "never ask", "instead of asking" — SHALL NOT count as an ask instruction.

#### Scenario: a non-interactive command's source contains an ask-the-user instruction
- **WHEN** the roster scan runs
- **THEN** that command fails, naming the unexpected instruction

#### Scenario: a non-interactive command's source says "never ask the user"
- **WHEN** the roster scan runs
- **THEN** the negated phrase is not counted, and that command passes

### A completed spec accounts for every living-spec capability it loaded
<!-- touches: apps/speckit-extension/scripts/check_quality.py -->

Once a spec reaches `completed` or `archived`, every capability its record says it loaded SHALL be either folded or explicitly recorded as skipped; a loaded capability left as neither SHALL be reported, as a warning that never fails a strict run.

#### Scenario: a spec loaded two capabilities and folded only one, with no skip note for the other
- **WHEN** the spec is completed and the eval runs
- **THEN** the unaccounted capability is named in a warning

### A step dispatches subagents only when there is more than one brief to hand out
<!-- touches: apps/speckit-extension/scripts/dispatch-briefs.py -->

Printing briefs for a step SHALL produce one reader per recorded area up to a cap, one writer per Phase 1 design document, or one worker per Foundational wave of four or more tasks; a step producing fewer than two briefs SHALL run inline instead, because the decision is made from what was printed, not from prose in the command.

#### Scenario: a step's design documents total one
- **WHEN** briefs are requested for it
- **THEN** one writer brief is printed, which alone is not enough to justify dispatching

#### Scenario: two or more briefs are printed for a step
- **WHEN** the step reads that output
- **THEN** it dispatches all of them

### A Foundational wave too small to be worth splitting is built inline
<!-- touches: apps/speckit-extension/scripts/dispatch-briefs.py -->

Requesting wave briefs SHALL print worker briefs only for a wave of four or more pending tasks; a smaller wave SHALL be named for the caller to build directly, and a spec sized `simple` SHALL never receive design-document briefs at all.

#### Scenario: the next Foundational wave has three pending tasks
- **WHEN** `--waves` is run
- **THEN** the wave's task ids are printed to build inline, and no worker brief is issued

### Printing briefs never fails the step that asked for them
<!-- touches: apps/speckit-extension/scripts/dispatch-briefs.py -->

Any failure while composing or printing briefs, including a check-in write, SHALL be caught, reported on stderr, and exit cleanly, so a dispatch decision can never be the reason a step fails.

#### Scenario: the spec's trace file cannot be written during a check-in
- **WHEN** the failure is caught
- **THEN** it is reported and the process still exits 0

## Uncovered

_None: all four scripts were read in full._
