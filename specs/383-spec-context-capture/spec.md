# Feature Specification: Capture the full reasoning trail in the spec context

**Feature**: 383-spec-context-capture
**Source**: [#392](https://github.com/alfredoperez/speckit-companion/issues/392)

## Overview

A spec-driven run generates a rich reasoning trail — the choices made and the ones rejected, what was verified and the result, the original goal and what was deliberately left out, which requirement each task covers — but today almost none of it is persisted where a tool can read it. The spec context can say *what step you're on* but not *what you decided, what you verified, or what you were trying to do*. This feature records that trail as additive, queryable fields, plus two integrity fixes so the existing timeline can't be misread.

## User Scenarios & Testing

### User Story 1 - Capture the goal and non-goals (Priority: P1)

When a spec is specified, the underlying intent (the one-line goal) and the explicit non-goals (what was deliberately left out of scope) are recorded, so anyone resuming, handing off, or auditing the work can see what it was *for* without re-reading the whole spec.

**Why this priority**: The goal and the out-of-scope fence are the first things a resume or a colliding future spec needs, and the intent field is the cheapest to capture (a scalar that the writer already supports).

**Independent Test**: Run a spec through specify; confirm the recorded context carries an `intent` string and an `expectations` list matching the spec's goal and out-of-scope items.

**Acceptance Scenarios**:
1. **Given** a spec whose description states a goal and some out-of-scope items, **When** specify completes, **Then** the context records `intent` (the goal) and `expectations` (the out-of-scope list).
2. **Given** a spec with no stated non-goals, **When** specify completes, **Then** `intent` is recorded and `expectations` is absent or empty — never an error.

### User Story 2 - Capture decisions and what was verified (Priority: P1)

As plan and implement proceed, the decisions made (with the reasoning and the rejected alternative) and the verifications run (what was checked, the command, the result, and any warnings dismissed) are recorded, so the *why* behind the code and the proof it works survive the session.

**Why this priority**: Decisions with rejected alternatives are the most likely thing to be re-litigated on resume, and a verification record is the single most audit-critical fact — today "tests pass" survives only as a stray sentence, if at all.

**Independent Test**: Run a spec through plan and implement; confirm `decisions[]` entries carry a decision + why (+ optional rejected) and `verified[]` entries carry what/result (+ optional command/warnings).

**Acceptance Scenarios**:
1. **Given** a plan step that chose an approach over an alternative, **When** plan completes, **Then** the context has a `decisions[]` entry with the decision and its rationale.
2. **Given** an implement step that ran the test suite, **When** implement completes, **Then** the context has a `verified[]` entry naming what was checked and the result.
3. **Given** the same decision recorded twice, **When** the writer runs again, **Then** it is not duplicated (de-duped, additive).

### User Story 3 - Answer "is this requirement covered?" from the context (Priority: P2)

The mapping from each requirement to the tasks that implement it and the tests that cover it is recorded, so a tool or a reviewer can answer "is FR-004 tested?" directly from the context file instead of reconstructing it.

**Why this priority**: The requirement→task→test map is the richest structured signal a run produces and today is entirely lost; it makes coverage queryable but is not needed for the MVP capture.

**Independent Test**: Run a spec through tasks and implement; confirm `coverage[]` maps requirement ids to task ids and test references.

**Acceptance Scenarios**:
1. **Given** tasks generated from requirements, **When** tasks completes, **Then** `coverage[]` records each requirement with the tasks that cover it.
2. **Given** implement wrote tests, **When** implement completes, **Then** the matching `coverage[]` entries gain their test references.

### User Story 4 - Fill the slots that already exist but nothing writes (Priority: P2)

The reasoning slots the schema already declares but the writer never fills — the approach summary, concerns/friction, per-step summaries, the last action, and the size-classification inputs — get recorded reliably at the right lifecycle points.

**Why this priority**: These homes already exist and carry real value when present, but today they're best-effort and mostly empty; making them reliable is high value at low cost.

**Independent Test**: Run a spec end to end; confirm `approach`, `concerns[]`, `step_summaries`, `last_action`, and `classification` are populated.

**Acceptance Scenarios**:
1. **Given** a plan step, **When** it completes, **Then** `approach` records the how-summary.
2. **Given** a run that hit a workaround, **When** the step records it, **Then** `concerns[]` carries the note; a clean run may assert zero concerns.
3. **Given** the size step, **When** it classifies, **Then** `classification` records the projected files/tasks/scope-signal behind the verdict, not just the verdict.

### User Story 5 - Keep the timeline honest (Priority: P3)

The timeline distinguishes durations it measured from timestamps it merely journaled, and it records when a lifecycle path (a hook, a living-specs load) was evaluated and correctly did nothing.

**Why this priority**: Prevents bogus duration analytics and lets an audit tell "capture is broken" from "correctly no-op"; important for trust but not blocking the capture itself.

**Independent Test**: Run a spec; confirm AI-journaled history entries are flagged non-durational and a skipped hook leaves a one-line marker.

**Acceptance Scenarios**:
1. **Given** an AI-journaled step finish, **When** it is recorded, **Then** the entry is flagged so duration derivation ignores it.
2. **Given** hooks or living specs gated off, **When** the step evaluates them, **Then** a one-line skipped/no-op marker is recorded.

## Edge Cases

- A field's value is absent (no non-goals, no concerns) → the field is simply not written; never an error.
- The same decision/verification/expectation recorded twice → de-duped, additive; re-running the writer is idempotent.
- The writer runs where `python3` is unavailable → capture is best-effort and skipped without failing the host command.
- A consumer reads the context before the new fields exist → additive fields are tolerated (`additionalProperties: true`); older readers ignore them.
- Model, tokens, and precise per-step durations are **not** obtainable (one-way dispatch) → explicitly out of scope, not faked.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST record an `intent` string (the goal) at specify completion.
- **FR-002**: The system MUST record an `expectations` list (explicit non-goals / out-of-scope) at specify completion, additively and de-duped.
- **FR-003**: The system MUST record `decisions[]` entries — each a decision with its rationale and an optional rejected alternative — at plan completion and implement close.
- **FR-004**: The system MUST record `verified[]` entries — each with what was checked and the result, plus optional command and warnings — at implement completion.
- **FR-005**: The system MUST record `coverage[]` mapping each requirement id to its tasks and tests, at tasks completion (initial) and implement close (final).
- **FR-006**: The system MUST record `concerns[]` (friction/workarounds, or an explicit clean-run assertion) when a step encounters or clears them.
- **FR-007**: The system MUST record `approach` (the how-summary) at plan completion.
- **FR-008**: The system MUST record `step_summaries` per step and a `last_action` breadcrumb.
- **FR-009**: The system MUST record `classification` (projected files, projected tasks, scope signal, verdict) at the classify/size step.
- **FR-010**: The system MUST flag AI-journaled `history[]` entries so duration derivation trusts only extension-stamped boundaries.
- **FR-011**: The system MUST record a one-line marker when hooks or living specs are evaluated and skipped.
- **FR-012**: All new fields MUST be additive and backward-compatible — absent config or older readers behave exactly as before; capture failures MUST never fail the host command.
- **FR-013**: Each new list/map field MUST reuse an existing writer mechanism (a `--set` scalar, a de-duped append flag modeled on the living-specs writer, or a keyed-map upsert modeled on task summaries) — no schema redesign.
- **FR-014**: The schema type definitions and the JSON schema MUST be updated to declare every new field, and the user-facing capture/schema docs MUST describe them.

### Key Entities

- **Decision**: a choice made during the run — `decision` (what), `why` (rationale), `rejected` (optional alternative not taken).
- **Verification**: proof a step's work is sound — `what` (checked), `result`, optional `command` and `warnings`.
- **Coverage entry**: traceability for one requirement — `req` id, `tasks[]`, `tests[]`.
- **Concern**: a friction point or risk — `note`, optional `step` and `kind`.
- **Classification**: the size decision's inputs — `projectedFiles`, `projectedTasks`, `scopeSignal`, `verdict`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: After a fresh run, the context file contains a non-empty `intent` and (when the spec has non-goals) `expectations` — 100% of specify completions.
- **SC-002**: After a fresh run that made a decision and ran tests, `decisions[]` and `verified[]` are each non-empty — where today both are absent.
- **SC-003**: "Is requirement X covered?" is answerable from `coverage[]` alone, with no re-reading of tasks.md.
- **SC-004**: All five previously-unwritten slots (`approach`, `concerns`, `step_summaries`, `last_action`, `classification`) are populated on a normal run.
- **SC-005**: A stock spec-kit run and any older reader are byte-for-byte unaffected; disabling/absent capture produces identical behavior to today.
- **SC-006**: Duration analytics over the timeline never counts an AI-journaled timestamp as a measured duration.

## Assumptions

- Intent/expectations are distilled by the AI from the spec at specify time (not read back from a model response — dispatch is one-way).
- Existing slots (`decisions`, `concerns`, `approach`, `step_summaries`, `last_action`) keep their current shapes where already declared; new fields (`verified`, `coverage`, `intent`, `expectations`, `classification`) are added.
- Model identity, token counts, and precise per-step wall-clock durations are out of scope (unobtainable via one-way dispatch).
- The work targets the spec-kit extension's `write-context.py` plus the VS Code type/schema and the command bodies that emit the calls; it is additive plumbing, not a redesign.
