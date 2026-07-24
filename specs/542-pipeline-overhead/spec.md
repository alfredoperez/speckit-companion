# Reduce per-step pipeline overhead: measure shared-part repeat + single-owner validation

Two independent extension-side overheads surfaced auditing a real end-to-end Companion **auto** run (issue #542). Both live in `speckit-extension`, not a consuming repo.

## User Scenarios & Testing

### User Story 1 - The shared-part repeat is measured, not guessed (Priority: P1)

A maintainer wants to know, with an honest and re-runnable number, how much boilerplate the Companion pipeline re-ships across an auto run before deciding whether to optimize it. The shared parts (`timing`, `orchestrator`, `self-advance`, `speckit-hooks`) are inlined verbatim into every `/speckit.companion.*` pipeline command body, so in a single-session auto run every step re-delivers the same protocol text.

**Why this priority**: The ticket's own gate ("measure before you optimize") requires a committed baseline before any dedupe is attempted. Without it, an optimization can't be justified or its improvement shown.

**Independent Test**: Run the measurement script against the assembled command bodies on disk; it prints a single "N redundant tokens after first delivery" number derived from the real files.

**Acceptance Scenarios**:
1. **Given** the four pipeline command bodies on disk, **When** the measurement script runs, **Then** it reports each shared part's dispatch count, footprint, and the total redundant-token count for a representative `specify → plan → tasks → implement` run.
2. **Given** a shared part is added, removed, or resized, **When** the script re-runs, **Then** the reported number tracks the actual files (it reads the fences, it does not hard-code the parts).

### User Story 2 - Validation runs in exactly one place (Priority: P1)

A project attaches a consolidated post-implement validation run (test/lint suites) as a review hook at `commands.implement.hooks.after.implement-exec`. Today the tasks command's Polish phase *also* generates a "validate against Success Criteria" suite-run task, so the project runs the same suites twice. The maintainer wants validation ownership in exactly one place.

**Why this priority**: This is the clean, safe, self-contained win in the ticket — a command-body wording change with no capture/dispatch risk.

**Independent Test**: A `tasks.md` generated for a project whose `companion.yml` declares an `implement-exec` review hook defers its Polish validation to that hook (no second suite run); a project without such a hook keeps generating its own validation task.

**Acceptance Scenarios**:
1. **Given** a project declares a review hook marked `owns: validation` under `commands.implement.hooks.after.implement-exec`, **When** the tasks command builds the Polish phase, **Then** the validation task defers to that hook and does not re-run the suites.
2. **Given** a project declares no hook marked `owns: validation` (none at all, or unmarked review/ship hooks), **When** the tasks command builds the Polish phase, **Then** Polish owns validation and generates the suite-run task as before.

### User Story 3 - The dedupe recommendation is documented, not forced (Priority: P2)

Given the baseline, the maintainer wants a clear, honest verdict on whether the shared-part repeat can be deduped safely — and, if not, a documented recommendation and a filed follow-up rather than a risky change to the dispatch/capture path.

**Why this priority**: The dispatch model (the extension sends a command *name*; the AI reads the whole command file including inlined parts) has no clean interception point for a per-dispatch strip that preserves the cold one-shot case. Forcing one would touch the repo's worst bug class.

**Independent Test**: The spec records the finding, the recommendation, and the escalation; no dispatch/capture code is changed for item 1.

**Acceptance Scenarios**:
1. **Given** the dispatch path was investigated, **When** the maintainer reads the spec, **Then** it states why no safe on-disk dedupe exists and what a real fix would require.
2. **Given** item 1 is escalated, **When** the loop completes, **Then** a focused follow-up is filed and no capture/timing behavior is altered.

### Edge Cases

- A project with `commands.implement.hooks.after.implement-exec` hooks that are *not* validation-owning (e.g. a PR/notify hook) — the Polish deferral is only correct when the hook owns validation; the instruction frames it as "a project that owns a consolidated validation run attaches it there," leaving the judgment to the generation step.
- A malformed/absent `companion.yml` — no hook is read, Polish owns validation (the safe default).
- The measurement script must never affect a real run — it is a `measure_*` file, skipped by `unittest discover`, and reads only.

## Requirements › Functional Requirements

- **FR-001**: A committed, re-runnable measurement MUST quantify the shared-part repeat from the assembled command bodies on disk and print a single "redundant tokens after first delivery" total for a representative auto run.
- **FR-002**: The measurement MUST derive the parts and their dispatch counts by reading the part fences, not by hard-coding a part list, so the number tracks the real files.
- **FR-003**: The tasks command's Polish phase MUST defer validation to a project-declared `commands.implement.hooks.after.implement-exec` hook explicitly marked `owns: validation`, and MUST keep generating its own validation task when no such marked hook is present (an unmarked review/ship tail must not suppress validation) — so the suites run in exactly one place.
- **FR-004**: The item 2 change MUST be a node-body edit that regenerates the assembled command body and re-blesses the golden, keeping `assemble-nodes.py --check`, `check-shape-parity.py`, `build-commands.py --check`, and `check-command-emissions.py` green.
- **FR-005**: Item 1 MUST NOT alter capture, timing, or dispatch behavior; if no safe dedupe exists it MUST be documented and escalated, not forced.

## Success Criteria › Measurable Outcomes

- **SC-001**: The measurement script prints a single redundant-token total and per-part breakdown for the `specify → plan → tasks → implement` run.
- **SC-002**: For a project with an `implement-exec` review hook, the generated Polish phase produces zero additional suite runs beyond the hook's.
- **SC-003**: All four `speckit-extension` gates plus `npm test` and the Python unittest suite stay green after the change.
- **SC-004**: Zero lines of capture/timing/dispatch code change for item 1.

## Assumptions

- "Redundant tokens" is estimated at ~4 chars/token (the common English heuristic); the exact tokenizer is irrelevant to the relative repeat-count the number expresses.
- The representative run is the four dispatching pipeline steps; the auto orchestrator body itself and the classify step are excluded to keep the number a clean lower bound.

## Approach

- **Item 1 (measure + escalate):** add `speckit-extension/tests/measure_pipeline_overhead.py` — reads the assembled pipeline bodies, tallies each shared part's footprint × (dispatches − 1), prints the total. Baseline: **9,492 redundant tokens** across the 4-step run (timing 4,056; orchestrator 2,157; speckit-hooks 2,133; self-advance 1,146). No dispatch/capture change — the extension sends a command name, the AI reads the whole file, so there is no safe on-disk strip that keeps the cold one-shot dispatch whole. Documented and escalated.
- **Item 2 (single-owner validation):** edit `nodes/tasks/tasks-doc.md` Polish phase to defer validation to a declared `implement-exec` review hook; regenerate `commands/speckit.companion.tasks.md`; re-bless the golden.

## ADDED Requirements

<!-- capability: companion-commands -->
### The tasks Polish phase validates the spec's Success Criteria in exactly one place

The tasks command's final Polish phase generates a task to validate the result against the spec's Success Criteria. When the project declares a consolidated post-implement validation run as a hook explicitly marked `owns: validation` after `implement-exec` (`commands.implement.hooks.after.implement-exec` in `.specify/companion.yml`), that hook owns the run, so the Polish phase MUST defer to it rather than generate a second suite run. When no hook carries that marker — none at all, or unmarked review/ship hooks that don't validate — the Polish phase owns validation and generates the run itself. Validation ownership therefore lives in exactly one place, and a project that owns its own run never executes the suites twice.

#### Scenario: a project owns a post-implement validation hook
- **WHEN** the tasks command builds the Polish phase and `commands.implement.hooks.after.implement-exec` declares a review hook
- **THEN** the Polish validation task defers to that hook and no second suite run is generated

#### Scenario: no post-implement validation hook is declared
- **WHEN** the tasks command builds the Polish phase and no such hook is present (or `companion.yml` is absent or malformed)
- **THEN** the Polish phase generates and owns the validation run, as before
