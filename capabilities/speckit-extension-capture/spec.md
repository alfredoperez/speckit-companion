# SpecKit Extension Capture — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

This is the deterministic Python layer that records what a spec-driven run actually did — which step started and finished, when, which tasks completed, what was decided — into a per-spec `.spec-context.json` the GUI reads, plus the living-spec resolver, drift and coverage reporters that keep long-lived capability specs honest. Without it the host has no observable signal at all: the extension dispatches commands as text and never gets a completion callback, so anything these scripts don't stamp is simply unknown.

## Requirements

### Bookkeeping never fails the host command

A capture write MUST NOT propagate a failure into the spec-kit command that invoked it. An unresolvable feature directory, an unreadable or corrupt context file, or an unexpected exception SHALL be reported on stderr and skipped with a success exit, so a bookkeeping miss degrades the record rather than aborting the user's work. The one exception is caller error in the emitting command body (a malformed classification payload), which exits non-zero because it is a bug in the caller, not a runtime miss.

#### Scenario: No feature directory can be resolved
- **WHEN** none of the explicit argument, environment pointer, feature file, or branch prefix identifies a spec directory
- **THEN** the script explains which sources it checked and skips the write
- **AND** exits successfully so the surrounding command continues

#### Scenario: The context file on disk is corrupt
- **WHEN** the existing `.spec-context.json` is not valid JSON or not an object
- **THEN** it is treated as empty rather than raising
- **AND** the write proceeds from a clean state instead of crashing

### Recorded lifecycle state never moves backward

A write MUST NOT drag a spec to an earlier step or a less advanced status than the one already recorded. A late or re-fired hook for an earlier step SHALL leave the existing record fully intact, and a spec already at a terminal status SHALL refuse further lifecycle journaling.

#### Scenario: A hook fires after the spec already advanced
- **WHEN** a start for an earlier step arrives at a spec whose recorded step is further along
- **THEN** the existing step and status are left untouched
- **AND** the refusal names both the recorded position and the rejected one

#### Scenario: A shipped spec receives another finish
- **WHEN** a journal write targets a spec already completed or archived
- **THEN** nothing is written and the terminal status is reported back

### Step and task timing is stamped at the moment it happens

Every timestamp in the lifecycle record MUST come from the script's own clock at write time, never from a value handed in by a caller and never reconstructed after the fact. This is why the AI runs the writer instead of editing the file: a step's real begin-and-end span, and the gap between consecutive task finishes, are only honest if a script read the clock when the event occurred.

#### Scenario: A task finishes during implement
- **WHEN** a per-task finish is recorded
- **THEN** its timestamp is the current time as the script reads it
- **AND** the interval to the previous finish reflects the task's real duration

#### Scenario: A step is closed by its own command body
- **WHEN** a command brackets itself with a start at the beginning and a finish at the end
- **THEN** the recorded span is the real elapsed work, not a single instant synthesized at the next step's start

### Every context write is atomic and safely repeatable

A write MUST serialize to a temporary file and rename over the target so a reader never sees a half-written record, and MUST merge into the existing content rather than replace it. Re-running the same write SHALL be a no-op: a step start, a step or substep finish, and a per-task finish each dedupe on their own identity, and appended lists dedupe on their content.

#### Scenario: The same finish is recorded twice
- **WHEN** both the AI's self-close and a lifecycle hook record the same step's completion
- **THEN** exactly one completion event exists in the history
- **AND** the second invocation still exits successfully

#### Scenario: A write fails partway
- **WHEN** serialization to the temporary file fails
- **THEN** the temporary file is cleaned up and the existing record is left unchanged

### Only a genuinely finished spec reaches the terminal completed status

Promotion to `completed` MUST be reachable only through the dedicated terminal path (`--mark-complete`), and only for a spec whose implement step is actually finished — either already recorded as finished, or with every task marker checked off. A spec still mid-pipeline, or with work left, SHALL be refused. Re-running the promotion on an already-shipped spec SHALL leave it untouched.

#### Scenario: A stray promotion arrives early
- **WHEN** the terminal command runs against a spec still in specify or plan
- **THEN** the promotion is refused with the reason, and nothing is written

#### Scenario: Implement is done but the status was never flipped
- **WHEN** every task is checked and the spec is still recorded as implementing
- **THEN** the implement step is closed and the status becomes completed in one write

### Parallel task finishes are appended, then folded exactly once

When work fans out, each worker MUST be able to record its own task finish without reading or rewriting the shared record — a single append to a per-spec event log. Folding those appended lines into the durable record SHALL produce exactly what recording each one inline would have produced, and folding repeatedly SHALL NOT double-count. The task checkboxes are derived from the folded log by a single writer, never hand-edited alongside it.

#### Scenario: Two workers finish tasks at the same moment
- **WHEN** both append their finish while the shared record is untouched
- **THEN** neither contends on the shared file and both finishes survive the fold

#### Scenario: The log is folded after every batch
- **WHEN** the same event log is folded again after a later batch
- **THEN** already-folded finishes are recognized and not appended a second time

### The event log outlives the step and is cleared only at the terminal transition

The append log MUST survive step close, because a later wave may still append and re-folding is safe. It SHALL be removed only after the promotion to the terminal status has been durably written, so no un-folded finish is ever discarded and a re-run of the same spec directory cannot replay a prior run's finishes.

#### Scenario: A straggler finish was appended after the step closed
- **WHEN** the spec is marked complete
- **THEN** the pending appends are folded first
- **AND** only then is the event log removed

### Living specs stay inert until explicitly enabled

The living-spec capability layer MUST default to off. With no configuration, or with the feature unset, the resolver, drift and coverage commands SHALL report nothing and succeed rather than inventing capabilities or emitting noise. An absent configuration file is a normal state, not a warning.

#### Scenario: A repo has no companion configuration
- **WHEN** a living-spec command runs
- **THEN** it produces no findings and exits successfully

#### Scenario: The configuration exists but the feature is not enabled
- **THEN** the same inert result is reported

### A configuration the reader cannot parse is never overwritten

Registration MUST refuse to write when the existing configuration failed to parse, rather than rewriting it from the degraded defaults and destroying the user's content. Values that the constrained emitter cannot faithfully round-trip SHALL be rejected before any write. Registering a capability that already exists SHALL be a reported no-op that describes what is actually on disk, not what was requested.

#### Scenario: The config file is malformed
- **WHEN** registration is asked to append a capability
- **THEN** it refuses with the parse warning and exits non-zero, leaving the file byte-for-byte unchanged

#### Scenario: The capability is already registered
- **THEN** the existing spec path and match globs are reported and nothing is written

### Capability resolution picks the most specific code area first

When a changed file belongs to more than one capability, the resolver MUST rank the deeper, more specific code area ahead of a broader one, so the closest-fitting living spec is loaded first. Glob matching SHALL follow POSIX path semantics, where a single wildcard never crosses a directory boundary. A capability that cannot resolve a spec path is a configuration error the resolver surfaces rather than silently skipping.

#### Scenario: A file matches both a broad and a narrow capability
- **WHEN** capabilities are resolved for that file
- **THEN** the one whose matching pattern has the longer literal path prefix is ordered first
- **AND** ties fall back to a stable name ordering

#### Scenario: A spec file exists that no capability claims
- **WHEN** orphans are requested
- **THEN** it is reported, unless it is a reserved companion tier of a claimed spec or lives inside a claimed capability's directory

### Living-spec reporting observes, it never gates

Drift and coverage reporting MUST be read-only and MUST always succeed. They SHALL NOT edit a spec, a coverage file, or a context record, and SHALL NOT halt on findings — a surrounding workflow may choose to treat findings as a gate, but the commands themselves never do. A capability the reporter cannot evaluate is reported as skipped with the reason, not raised.

#### Scenario: Files changed since the living spec was last committed
- **WHEN** drift is computed
- **THEN** each drifted file is classified by whether the change went through the pipeline or bypassed it entirely
- **AND** the command still exits successfully

#### Scenario: A capability has no coverage tier
- **THEN** every requirement is reported uncovered, and the run still succeeds

### Shipped command bodies and scripts are verified against a single source

Shared instruction text MUST live in exactly one place and be assembled into the command bodies, and the build MUST be able to prove that no committed body has forked its copy or drifted from the frozen baseline. Separately, the set of scripts placed in the release archive MUST be cross-checked in both directions against what the shipped commands actually reach for, so neither a missing runtime dependency nor an unreachable file can ship unnoticed. Re-blessing the frozen baseline SHALL be an explicit, separate act, never something the build does for itself.

#### Scenario: A shared rule is edited in place inside one command body
- **WHEN** the parity check runs
- **THEN** it fails and names the command and the shared block that drifted

#### Scenario: A command reaches for a script that is not in the packing list
- **WHEN** the packaging check runs
- **THEN** it fails and names the script, because a real install would break on it

## Uncovered

- `write-context.py` (~1840 lines) was read at the surface only, per instruction: its argument parser, dispatch, and the lifecycle core (context update, atomic write, history migration, journal finish/advance, task fold and materialize, terminal promotion, no-regress guard). **Not read:** the bodies of roughly forty helpers — spec-delta parsing and the living-spec fold-back (`parse_spec_deltas`, `apply_deltas`, `fold_living_spec`, `_resolve_fold_targets`), coverage and step-summary upserts, classification storage, capture-entry coercion, task-marker parsing and checkbox writing, and `sync_tasks` internals. Requirements touching those paths are drawn from their docstrings and the capture-and-timing reference, not from the implementations.
- `check-coverage.py`, `status-context.py`, `package-manifest.py`, `check-shape-parity.py`, and `_command_parts.py` were read at module docstring plus signature level; their parsing and rendering bodies were not read line by line.
- `assemble-nodes.py` was read only through its assembly entry point; the node-ordering and orchestrator-append tail was not read.
