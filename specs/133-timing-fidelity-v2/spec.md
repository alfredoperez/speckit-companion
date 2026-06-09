# Feature Specification: Timing fidelity v2 — finish-only journaling + reconciler activation

**Feature Branch**: `133-timing-fidelity-v2`  
**Created**: 2026-06-08  
**Status**: Draft  
**Input**: GitHub issue [#215](https://github.com/alfredoperez/speckit-companion/issues/215) — "Timing fidelity v2: finish-only journaling + reconciler activation"

## Overview

Two end-to-end runs (standard + lean profile on the same feature) confirmed the headline timing fix from #213 — the specify step now records a real begin→end span — but exposed two remaining problems. First, the per-task and per-substep timeline is still misleading: it shows unattributed gaps between tasks, zero-duration ticks where a task's start and finish land on the same instant, and "bursts" where two substeps share one timestamp. Second, toggling the template-profile setting in the GUI records the user's intent but never actually activates the matching preset, so the only working profile switch is the per-spec right-click menu.

This feature makes the spec timeline honest (finish-only journaling) and makes the profile setting actually switch profiles (reconciler activation). The audience is the developer running the spec-driven pipeline who reads durations in the spec viewer, and the maintainer who relies on the capture eval to guarantee that fidelity.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Honest per-task and per-substep timing (Priority: P1)

A developer runs the spec-driven pipeline and opens the spec viewer to see how long each step and each task took. Every task shows a real duration, every substep boundary reflects when work actually moved on, and nothing reads as instantaneous or unaccounted-for.

**Why this priority**: Misleading durations are the headline complaint that motivated this follow-up. Inaccurate timing erodes trust in the whole capture system — if a task shows `0s` or an 18-second gap appears between two tasks, the developer can't reason about where time went. This is the core value of the feature.

**Independent Test**: Run a full pipeline (specify → plan → tasks → implement) and inspect the resulting timeline. It can be validated independently of the profile-switching work: confirm there are no zero-duration task ticks, no unattributed gaps between consecutive tasks, and no two substeps stamped at the same instant.

**Acceptance Scenarios**:

1. **Given** a step with several sequential tasks, **When** the pipeline finishes the step, **Then** each task records a single finish event and its duration is the elapsed time since the previous task's finish (the first task measured from the step's start), with no separate start/finish pair that could collapse to zero.
2. **Given** a step that has substeps (e.g. plan's research and design phases), **When** the step completes, **Then** each substep records its own finish event at a distinct time and no two substeps share a single timestamp.
3. **Given** the specify step, **When** it runs, **Then** its genuine begin→end span is preserved unchanged (it has a real start *and* end), rather than being collapsed into the finish-only model.
4. **Given** a step boundary, **When** it is recorded, **Then** the step-level start and complete remain script/host-stamped at full precision and in monotonic order.

---

### User Story 2 - Template-profile setting actually switches profiles (Priority: P1)

A developer changes the template-profile setting (standard ↔ lean ↔ off) in VS Code settings and the next pipeline run produces that profile's document shape — without the developer having to run any manual installation command.

**Why this priority**: This is a pre-publish blocker. Today the setting is effectively inert in real projects — the default-on profile never activates, so the advertised "switch profiles from settings" capability silently does nothing. Shipping with a dead setting is not acceptable.

**Independent Test**: Fully testable on its own — change the setting, run the pipeline, and confirm the produced artifacts match the selected profile's shape (e.g. lean drops data-model/research/contracts/quickstart/checklist), with no manual command in between.

**Acceptance Scenarios**:

1. **Given** the profile setting is changed to lean, **When** the developer runs the next pipeline step, **Then** the lean profile is active and produces the lean document shape, with no manual activation command required.
2. **Given** the profile setting is changed to standard, **When** the next step runs, **Then** the standard profile is active and the lean profile is not (the two are mutually exclusive).
3. **Given** the profile setting is set to off, **When** the next step runs, **Then** no profile preset is active and the core (un-overridden) command behavior is used.

---

### User Story 3 - Timeline stays complete regardless of AI behavior (Priority: P2)

A developer's run records every executed task in the timeline even when the implementing assistant closes the implement step before each task was individually journaled. No task silently disappears from the record.

**Why this priority**: Resilience backstop. The live per-task capture depends on the assistant running the finish-stamp at each task; if it instead closes the whole step first, the journal must still be filled in. This keeps the record trustworthy without depending on perfect assistant discipline, but the timeline is still useful without it, so it ranks below the two primary fixes.

**Independent Test**: Simulate the assistant self-closing the implement step before per-task journaling, then let the end-of-implement backstop run; confirm every task ends up with a finish event in the timeline.

**Acceptance Scenarios**:

1. **Given** the implement step was already closed, **When** the end-of-implement backstop runs, **Then** it still journals each task's finish (same-step writes are not rejected by the no-backward-clobber guard).
2. **Given** some tasks were already journaled live, **When** the backstop runs, **Then** it does not duplicate those tasks' finish entries.

---

### Edge Cases

- **Parallel `[P]` tasks**: the finish-delta model attributes a parallel batch to whichever task finishes last, since they don't have distinct sequential boundaries. This is an accepted limitation for the common sequential case and must be documented where the timing model is described.
- **First task / first substep in a step**: has no prior finish to subtract from, so its duration is anchored to the owning step's start.
- **A step with a single task or zero tasks**: produces a coherent timeline (single duration from step start; or just the step span) without phantom entries.
- **Profile switched mid-spec**: the next dispatched step uses the newly selected profile; already-captured history is not rewritten.
- **Both live capture and backstop fire for the same task**: the task appears exactly once (no duplicate finish entry).
- **Currently-deployed (old) extension still running**: until the rebuilt extension is installed, the old dispatch instructions override the new behavior and the timeline reverts to the old shape (see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

#### Finish-only timing model

- **FR-001**: The system MUST record a single finish event per task — not a start/complete pair — so that a task can never collapse to a zero-duration tick.
- **FR-002**: The system MUST record a single finish event per substep (e.g. plan's research and design, tasks' generate) at the moment that substep ends.
- **FR-003**: The system MUST derive each task's and substep's duration from the delta between consecutive finish events, anchoring the first finish in a step to that step's start.
- **FR-004**: The system MUST preserve the specify step's existing genuine begin→end span unchanged; the finish-only model applies to per-task and per-substep timing, not to that step bracket.
- **FR-005**: The system MUST keep step-level start/complete writes deterministic (host- or script-stamped at full precision, monotonic), distinct from the per-task/substep journaling.
- **FR-006**: The finish event for a task or substep MUST be stamped from a script's own clock when a script records it, rather than hand-authored, so timestamps are precise and free of format drift.
- **FR-007**: The timing instructions MUST be consistent across every dispatch surface the assistant receives them from (the profile command bodies and the GUI dispatch preamble), so the same finish-only model applies regardless of how the command was launched.
- **FR-015**: Per-task marker detection MUST recognize both `tasks.md` formats — the bold lean/companion form (`- [x] **T001**`) and the plain standard-template form (`- [x] T001 …`) — so per-task journaling and implement-step auto-close fire regardless of which profile produced the task list.

#### Resilient backstop journaling

- **FR-008**: The end-of-implement backstop MUST be able to journal per-task finish events even when the implement step has already been closed (same-step writes MUST NOT be blocked by the no-backward-clobber guard).
- **FR-009**: The backstop MUST NOT create duplicate finish entries for tasks that were already journaled.

#### Profile reconciler activation

- **FR-010**: Changing the template-profile setting MUST activate the matching bundled profile for subsequent runs with no manual command required from the user.
- **FR-011**: The standard and lean profiles MUST be mutually exclusive; selecting one MUST deactivate the other.
- **FR-012**: Setting the profile to off MUST leave no profile preset active.

#### Verification & documentation

- **FR-013**: The capture verification (eval) MUST validate the finish-only model and pass for both a fresh standard-profile run and a fresh lean-profile run.
- **FR-014**: The capture-and-timing and template-profile reference docs MUST be updated to describe the finish-only model, the backstop behavior, the reconciler activation, and the parallel-task limitation, in the same change as the behavior.

### Key Entities *(include if feature involves data)*

- **Spec timeline record**: the per-spec history of step/substep/task events that drives the durations shown in the viewer. Under this feature, per-task and per-substep entries become single finish events rather than start+complete pairs.
- **Timeline event**: one entry in that record — identified by its step, optional substep, optional task, the kind of event (e.g. start, complete/finish), who recorded it (host/script vs. assistant), and its timestamp.
- **Derived duration**: a computed value (not stored) equal to the delta between consecutive finish events, with the first anchored to the step start; this is what the viewer presents.
- **Template profile**: the selectable document shape (standard / lean / off) chosen via the setting; selecting a value activates the corresponding bundled profile.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A full pipeline run produces a timeline with zero zero-duration task ticks, zero unattributed gaps between consecutive tasks, and zero instances of two substeps sharing a single timestamp.
- **SC-002**: Per-task durations in the timeline reflect actual elapsed work time — verifiably non-zero where real work occurred (honest deltas, not an end-of-step burst of identical timestamps).
- **SC-003**: Changing the template-profile setting causes the next run to produce the selected profile's document shape with zero additional manual steps from the user.
- **SC-004**: Every executed task appears exactly once in the timeline, including when the implement step was closed before per-task journaling completed (no lost or duplicated tasks).
- **SC-005**: The capture verification passes on both a fresh standard-profile run and a fresh lean-profile run.

## Assumptions

- **Deployment precondition**: The rebuilt extension must be installed before the new behavior is observable. The currently-deployed (pre-#213) extension's dispatch instructions still drive the old per-task journaling and override the new command bodies; nothing in this spec is verifiable until that rebuild is installed. This is an operational precondition, not a functional requirement of the feature.
- **Parallel-task limitation accepted**: The finish-delta model cannot give each task in a parallel `[P]` batch its own duration; the batch is attributed to the last finisher. This is acceptable for the common sequential case and will be documented rather than solved.
- **Live capture via script, backstop for completeness**: Honest per-task cadence comes from the assistant running a finish-stamp script at each task as it completes; the end-of-implement backstop exists to fill in any tasks not captured live. Both paths stamp from a real clock.
- **Profiles share identical timing instructions**: Switching profile changes the document shape, not the timing-capture behavior; a lean run exhibits the same finish-only timing as a standard run.
- **Reconciler activates from the locally-bundled profiles**: The profiles are not published to a remote catalog, so activation works against the bundled copy. The exact activation mechanism is left to planning.

## Dependencies

- Builds directly on #213 (deterministic timing capture) and the capture/timing architecture described in `docs/capture-and-timing.md` (the specify begin→end bracket and deterministic step boundaries are retained from that work).
- The capture eval is the regression gate for the timing changes; it must be kept in sync with the timeline schema in the same change.
