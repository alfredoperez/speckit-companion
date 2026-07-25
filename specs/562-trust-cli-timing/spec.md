# Trust timing (and traceability) from CLI-only runs

**Issue**: #562

## User Scenarios & Testing

### User Story 1 - A CLI-only run shows its timing coverage (Priority: P1)

A developer drives a spec entirely through an AI CLI/agent — no VS Code lifecycle-button clicks. The companion writer stamps each step's start and complete with its own clock (real, ms-precision, ordered), but stamps them `by:ai` rather than `by:extension`. When the developer opens the spec in the viewer Overview, the timing strip should report the phases it actually measured, not "Timing coverage: 0 of N phases."

**Why this priority**: This is the whole defect. A run that recorded honest, deterministic per-step timestamps reads as if nothing was measured, which makes the timing surface look broken for anyone who runs the pipeline from a terminal instead of clicking through the UI.

**Independent Test**: Feed the derivation a history whose four step-level start/complete pairs are all `by:ai`, ordered, with real timestamps, and confirm the timing summary reports 4 of 4 measured phases.

**Acceptance Scenarios**:
1. **Given** a spec whose `specify`/`plan`/`tasks`/`implement` steps each carry an ordered `by:ai` step-level start and complete, **When** the viewer derives its timing summary, **Then** all four phases count as measured.
2. **Given** the same spec, **When** the elapsed span is derived, **Then** it is computed from the recorded boundaries rather than withheld.

### User Story 2 - A premature AI finish still cannot fake a duration (Priority: P1)

The honest distinction the trust gate exists for must survive the loosening. When the extension stamps a step's start (a host-observed moment) and an AI journaling call writes a step-level complete a fraction of a second later — the pre-#509 masquerade where the AI's premature finish blocks the hook's real close — that span must stay untrusted. Likewise a phase that was only advanced (a complete written with no start) has no measured span and must not claim a duration.

**Why this priority**: Loosening the gate must not resurrect the exact dishonesty it was built to reject. An extension-started phase closed by a premature AI finish, and an AI-only-advanced phase, are genuinely un-measured and must read that way.

**Independent Test**: Derive a history with an extension start closed by an `ai` complete 100ms later, and separately a step with an `ai` complete and no start, and confirm neither is trusted.

**Acceptance Scenarios**:
1. **Given** a step with an extension-stamped start and an `ai`-stamped step-level complete immediately after, **When** timing is derived, **Then** that step is not trusted.
2. **Given** a step with a step-level complete but no start entry, **When** timing is derived, **Then** it claims no duration.

### User Story 3 - The Python quality eval agrees with the viewer (Priority: P2)

The quality eval (`check_quality.py`) re-implements the viewer's trust rule to grade recorded runs. It must draw the same line as the viewer so a CLI-only run that the viewer now trusts is not flagged untrusted by the eval, and the masquerade the viewer rejects is still rejected by the eval.

**Why this priority**: The two implementations are a known drift pair; a change to one that skips the other silently diverges the grade from the display.

**Independent Test**: Run the eval's trust derivation over an all-`by:ai` ordered history and confirm it reports the same measured phases the viewer does.

**Acceptance Scenarios**:
1. **Given** a CLI-only `by:ai` history, **When** the eval derives trusted spans, **Then** it trusts the same phases the viewer trusts.
2. **Given** the masquerade history, **When** the eval derives trusted spans, **Then** it withholds trust exactly as the viewer does.

## Edge Cases

- A step with more than one step-level start (a repeated/duplicated start) stays untrusted regardless of writer — the anomaly must remain visible.
- A legacy fast-path fold pair (`by:ai` with a `fast-path` substep) is not a step-level boundary and must stay untrusted.
- A phase advanced with a mix — extension start, `ai` close — is untrusted; the reverse coherent `ai`/`ai` pair is trusted.
- Unknown/unrecognized `by` values (outside the schema enum) never anchor a trusted span.

## Requirements

### Functional Requirements

- **FR-001**: The viewer's step-history derivation MUST treat a step's span as measured when the step carries exactly one step-level start from a deterministic writer and a deterministic close after it, where a deterministic writer is any recognized writer of the boundary (the extension/hook family OR an agent-journaled `ai` boundary), not `by:extension` alone.
- **FR-002**: A span's close MUST be at least as authoritative as its start: an agent-journaled (`ai`) close MUST NOT finalize an instrumented (extension/cli/derive/user) start, so a premature AI finish cannot masquerade as the boundary of a hook-instrumented run.
- **FR-003**: A phase with no step-level start (advanced with only a complete) or recorded only as AI prose MUST NOT claim a measured duration.
- **FR-004**: The existing anomaly guards MUST continue to hold under the loosened gate: more than one step-level start untrusts the span, a completion timestamped before the start untrusts it, and a competing later start within the span untrusts it.
- **FR-005**: The quality eval's trust derivation (`check_quality.py`) MUST mirror the viewer's rule exactly, including the writer-authority tiers, and MUST stay pinned by parity tests.
- **FR-006**: The traceability ("X/Y traced") count MUST populate for CLI-only runs; if and only if it shared the timing trust gating would it need a change — it reads recorded coverage rows independently, so it MUST remain independent of the timing trust rule.

## Key Entities

- **History entry**: a recorded lifecycle boundary carrying `step`, `kind` (`start`/`complete`), `substep`, `task`, `by` (`extension`/`user`/`cli`/`ai`/`derive`), and a timestamp `at`.
- **Boundary writer rank**: a derived authority tier for a boundary's `by` — instrumented (extension/cli/derive/user) outranks agent (`ai`), which outranks unrecognized.
- **Step history entry**: the derived per-step record carrying `startedAt`, `completedAt`, and `durationTrusted`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A CLI-only run whose four pipeline phases carry ordered `by:ai` step-level start/complete pairs reports 4 of 4 measured phases (previously 0).
- **SC-002**: The extension-start + premature-`ai`-close span, and an `ai`-complete-with-no-start phase, each remain untrusted (0 duration claimed).
- **SC-003**: The viewer derivation and the Python eval report identical trusted phases for the same history, pinned by parity tests on both sides.
- **SC-004**: All existing derivation and eval tests continue to pass unchanged.

## Assumptions

- All boundary writes in the current capture model go through a clock-stamping script (`write-context.py` or `specContextWriter`), so a recognized `by` value implies a script-stamped boundary; the honesty line is drawn on writer authority and boundary shape, not on hand-vs-script authorship (which no longer varies).
- The traceability count is not gated by the timing trust rule and needs no code change; a CLI run populates it whenever it recorded coverage rows.

## Verbatim Constraints

- `durationTrusted` — the derived per-step trust flag the viewer reads.
- `by:extension`, `by:ai` — the boundary writer stamps whose relative authority the fix hinges on.

## ADDED Requirements
<!-- capability: specs -->

### A step's duration is trusted from any deterministic writer, gated on writer authority

The shared step-history derivation SHALL count a step's span as measured when the step carries exactly one step-level start from a deterministic writer and an ordered close (its own step-level complete, or the next lifecycle step's start) whose writer is at least as authoritative as the start's. Writers rank in two tiers: instrumented (`extension`, `cli`, `derive`, `user` — host- or in-command-script-observed) outranks agent (`ai` — a CLI/agent run's own writer-script boundary), which outranks any unrecognized writer. A run driven entirely through the CLI, whose ordered step boundaries are stamped `by:ai`, is therefore trusted, while an `ai` close over an `extension`-stamped start (a premature-finish masquerade) and a phase advanced with only a complete and no start each claim no duration. The existing anomaly guards — a single start, no completion before the start, no competing later start, no cross-phase overlap — continue to apply on top, and the `folded` flag stays defined over `extension`-stamped fast-path pairs only.

#### Scenario: a CLI-only run's history is derived
- **WHEN** every pipeline step carries an ordered `by:ai` step-level start and complete
- **THEN** all four phases count as measured timing coverage

#### Scenario: a premature agent finish over an extension start
- **WHEN** a step's start is stamped `by:extension` and an `ai` step-level complete lands immediately after
- **THEN** that step's duration is not trusted
