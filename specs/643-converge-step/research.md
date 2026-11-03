# Research: Converge finishes a Companion spec

## Implement closes with --advance

- **Decision**: the `complete` node keeps the living-spec accounting and fold and closes implement with `--step implement --advance --set workflow=companion`.
- **Rationale**: the accounting belongs to the end of implement; only the status it leaves changes.
- **Alternatives considered**: deleting the node. Rejected: the fold would lose its home.

## The loop lives in prompts, the engine ends on converge

- **Decision**: auto repeats implement and converge up to three passes; the workflow YAML replaces its terminal mark-complete with a `speckit.converge` step.
- **Rationale**: the engine supports command, gate, switch and shell steps, no loop.
- **Alternatives considered**: a loop in the engine. Out of reach; upstream #4269.

## One narrow exception on completed specs

- **Decision**: `update_context` lets a converge start or finish through on a completed spec without writing status or currentStep; the finish adds a concern when converge appended tasks.
- **Rationale**: owner decision w8: keep completed, record a concern.
- **Alternatives considered**: widening `_is_more_advanced`. Rejected: it also guards `--advance` and derive-from-files.

## The doctor counts the converge finish

- **Decision**: a `converge-finish` trace op, counted as a completion attempt.
- **Rationale**: every hook call is traced as `hook`, which says nothing about completion.
- **Alternatives considered**: counting all hook calls. Rejected: false attempts.
