# Harden spec-context capture: verify cadence + lock the record shape

> Source: [#233](https://github.com/alfredoperez/speckit-companion/issues/233)

## Overview

Spec-context capture currently trusts that per-task timing was journaled honestly and accepts whatever record shape lands on disk. This feature makes capture *verifiable* — a run whose task completions are dumped in one end-of-step burst is caught instead of passing as "live" — and makes the on-disk record *self-describing*, so malformed or redundant entries are rejected rather than silently accepted.

## Functional Requirements

- **FR-001** The capture evaluation MUST compare the span of recorded task-finish events against the span of the step they belong to (start → complete), and MUST fail the run when the finishes are clustered into a tiny fraction of the step's real duration, even when the gaps between individual finishes are non-zero.
- **FR-002** The cadence check MUST flag the known spec-136 pattern — 13 task finishes occupying ~0.2% of a 6m40s step — as a failure, where the prior check graded it as passing.
- **FR-003** The capture record's history entries MUST be validated against a defined item format that constrains each field's type and allowed values (the step name, the event kind, the substep, the author, and the timestamp), so a malformed or incomplete entry is caught at check time.
- **FR-004** The record format definition and the actual on-disk record MUST agree in both directions: every field the writer emits MUST be declared in the format, and the format MUST NOT declare fields the writer never emits.
- **FR-005** Each written history entry MUST NOT carry a field whose value duplicates another field in the same entry verbatim.
- **FR-006** Each written history entry MUST NOT carry a field whose value is fully derivable from the surrounding entries rather than recording new information.
- **FR-007** The record's "last updated" marker MUST be at least as precise as the timestamped events it summarizes, or MUST be dropped in favor of those events.
- **FR-008** The allowed-value lists the evaluation enforces (authors, step names, statuses) MUST stay consistent with the record format definition, so the two cannot drift apart.
- **FR-009** The instruction text dispatched to the AI MUST ask it to journal each task finish at the moment that task completes, rather than as a single end-of-step batch.
- **FR-010** Specs captured before this change MUST continue to pass the checker and render correctly in the viewer — no regression in evaluation or display of existing records.
- **FR-011** Any one-shot combined-artifact capture path (the complexity fast-path, which records folded plan/tasks steps) MUST emit history entries in the same validated format, so the format covers every entry variant that can be written.

## Success Criteria

- **SC-001** A run whose task finishes are clustered into a tiny fraction of the step duration is reported as a failure by the evaluation; a run whose finishes are spread across the step's real duration passes.
- **SC-002** 100% of history entries in a captured record are checked against the defined format, and a single malformed or incomplete entry causes the check to fail.
- **SC-003** Zero history entries contain a field that duplicates another field's value, and zero fields are declared in the format but never written (or written but never declared).
- **SC-004** The "last updated" marker carries at least the same timestamp precision as the events it summarizes, or is absent.
- **SC-005** Every previously captured spec re-checked after the change passes the checker and renders in the viewer identically to before — measured as zero newly-failing prior specs.

## Assumptions

- "Tiny fraction" for the cadence failure threshold is an informed default (finishes spanning a low single-digit percentage of the step's start→complete duration are treated as a clustered burst); the exact percentage is tuned during planning against the spec-136 baseline (~0.2%) and a known-good spread run.
- In-flight rendering ("running now" from a step start anchor) is explicitly out of scope here and tracked separately in [#229]; this feature is finish-only and does not introduce a per-task start event.
- The two redundant fields removed are the per-entry duplicate of the substep identifier and the derivable "from" pointer; dropping them is backward-readable because existing records that still contain them remain valid for the checker and viewer (FR-010).
- The fast-path combined-artifact path already writes through the shared capture writer, so aligning it to the validated format is a format/definition change rather than a new write site.
