# Feature Specification: Fast-path runs get trusted timing and living-spec context

**Feature Branch**: `513-fast-path-capture`
**Created**: 2026-07-21
**Status**: Draft
**Input**: Issues #514 (fast-path runs show 0 timing coverage) and #515 (fast-path runs skip living specs entirely) — one defect family: the fast-path fold predates the #509 capture model and the living-spec loading model, so a `simple`-classified run loses both the timing display and the living-spec context that full-path runs get.

## User Scenarios & Testing

### User Story 1 - A small change shows real timing coverage (Priority: P1)

A developer runs a small change through the Companion pipeline. The change classifies `simple`, the fast path folds plan and tasks into the specify run, and the developer implements and finishes. When they open the finished spec, the timing display counts specify, plan, tasks, and implement as measured phases with real durations — exactly like a full-path run — instead of showing "Timing coverage: 0 of N phases".

**Why this priority**: The timing display is a flagship surface, and the fast path is the default route for small changes — today every one of those runs zeroes it. This is the P1 defect (#514).

**Independent Test**: Record a folded lifecycle history with the corrected fold commands and derive step history — specify, plan, and tasks must each come out duration-trusted under both the viewer derivation and the eval's parity copy.

**Acceptance Scenarios**:

1. **Given** a spec classified `simple` whose history carries the corrected fold (ordered, extension-stamped, step-level start+complete pairs for plan and tasks after specify's own pair), **When** the viewer derives step history, **Then** specify, plan, and tasks each report `durationTrusted: true`.
2. **Given** the same folded history, **When** the quality eval computes trusted spans, **Then** the same three steps are trusted — the Python parity copy agrees with the viewer.
3. **Given** a folded spec that then runs implement to completion, **When** timing coverage is derived, **Then** all expected phases count as measured and the run reports a wall-clock elapsed time.
4. **Given** a legacy spec folded under the old model (`by: ai`, fast-path-tagged entries), **When** the viewer derives step history, **Then** those spans stay untrusted — history is never rewritten to look better than it was.

### User Story 2 - A small change still gets living-spec context (Priority: P2)

A developer makes a small change inside an area covered by a registered living spec. Even though the fast path skips the plan step (where full-path runs load living specs a second time, with the touched files known), the run still resolves the touched area's capabilities, reads their living specs, and records what it loaded — so the Overview shows the living-spec chips, and completion can fold the feature's deltas back into the capability specs.

**Why this priority**: Small changes are where living-spec context is cheapest and most useful, and where skipping it silently erodes the living-spec system (no chips, no fold-back, no drift bookkeeping). P2 because it degrades a feature rather than zeroing a display (#515).

**Independent Test**: Run the fast-path branch of the specify command in a project with registered capabilities and confirm the spec's context records the loaded capability names.

**Acceptance Scenarios**:

1. **Given** a `simple`-classified run in a project with living specs enabled whose touched files fall inside registered capabilities, **When** the fast-path branch completes, **Then** the spec's context records the loaded capability names and the Overview shows them.
2. **Given** the pre-draft load already recorded loaded capabilities, **When** the fast-path branch runs, **Then** it does not re-resolve or duplicate the record.
3. **Given** a fast-path spec with recorded loads that reaches completion, **When** mark-complete runs, **Then** the fold-back works from the recorded loads exactly as on the full path.
4. **Given** a project without living specs configured, **When** the fast-path branch runs, **Then** the load is skipped silently and the run is never blocked.

### User Story 3 - The eval catches a future fold regression (Priority: P3)

A maintainer changes the capture model or the fold text. The capture and quality evals both exercise a folded history, so a regression that breaks fast-path trust or shape fails a committed check instead of surviving unnoticed (the current gap survived precisely because every eval fixture was a full-path run).

**Why this priority**: Regression protection — valuable, but only after the defect itself is fixed.

**Independent Test**: Run the capture eval and the quality eval against a committed fast-path fixture; both must pass on the corrected shape and the quality eval must report the folded steps as trusted.

**Acceptance Scenarios**:

1. **Given** a committed fast-path fixture spec with the corrected folded history, **When** the capture eval runs over it, **Then** the fold assertions pass (ordered extension-stamped pairs, real timestamps, landed at ready-to-implement or later).
2. **Given** the same fixture, **When** the quality eval runs strict, **Then** every reached step is trusted and the run passes.
3. **Given** a synthetic history with the old `by: ai` fold shape, **When** the derivation tests run, **Then** they pin that shape as untrusted (one test per drift direction).

## Edge Cases

- A folded spec whose developer later dispatches a real plan run anyway: the fold's step-level entries already mark plan started/completed, so the re-run appends nothing new at step level (same idempotent behavior as re-running a completed step on the full path) and never regresses status.
- A fast-path spec parked at ready-to-implement with a fully-checked tasks.md: the tasks watcher must still not auto-close implement (the park guard keys off "no implement step recorded", which the corrected fold preserves — it writes no implement entry).
- The GUI Implement button on a folded spec: tasks already carries a step-level completion, so the button must not append a duplicate close (it consults the same completion query as before).
- Living-spec load at fold time when the resolver, config, or python3 is unavailable: skip silently, never block the fold.
- A legacy folded spec (old `by: ai` + fast-path-tagged shape) evaluated today: the capture eval must still recognize it and not crash; its spans stay untrusted.
- Re-running the fold commands (a resumed or repeated specify): the writer's dedup on step-level pairs must keep the history free of duplicates.

## Requirements

### Functional Requirements

- **FR-001**: The fast-path fold MUST record the folded plan and tasks steps as ordered, extension-stamped, step-level start+complete pairs (plan start, plan complete, tasks start, tasks complete — each stamped by the writer script's own clock, in sequence, after specify's own completion), so a folded run satisfies the existing duration-trust rule with no derivation changes.
- **FR-002**: A folded run MUST derive trusted spans for specify, plan, and tasks under both the viewer's derivation (`deriveStepHistory`) and the eval's parity copy (`check_quality.py`), and MUST reach full timing coverage once implement completes.
- **FR-003**: The corrected fold MUST NOT break the fast-path park (a folded spec with checked tasks is not auto-closed), the GUI implement transition (no duplicate tasks close), resume (the spec still reads as ready for implement), or the after-implement hook.
- **FR-004**: The fast-path branch MUST resolve and load living specs for the touched area once the touched files are known, and record the loaded capability names, unless a load was already recorded earlier in the run — reusing the same single-sourced instruction text as the pre-draft load (no forked copy).
- **FR-005**: The living-spec load at fold time MUST stay best-effort, opt-in, and read-only: any missing prerequisite skips silently and never fails or slows the command.
- **FR-006**: The capture eval's fast-path assertions MUST match the corrected contract (detect a fast-tracked spec, assert ordered extension-stamped pairs and landing status) while still recognizing the legacy fold shape without crashing.
- **FR-007**: Both evals MUST gain fast-path coverage: a committed folded-history fixture exercised by the capture and quality checks, plus derivation tests pinning the corrected shape as trusted and the legacy shape as untrusted.
- **FR-008**: Every surface that teaches the fold MUST be swept in the same change: the node source, the assembled command bodies and their golden baselines (re-blessed deliberately), the capture-and-timing reference, and the spec-kit extension's README and changelog — never the root README/CHANGELOG, never the extension manifest version.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A `simple`-classified run's derived step history reports specify, plan, and tasks as duration-trusted (previously 0 trusted), verified by unit tests on both derivations.
- **SC-002**: The quality eval reports 100% of reached steps trusted on the committed fast-path fixture, and stays green on the existing full-path fixture specs (509, 510, 511).
- **SC-003**: A fast-path run in a capability-covered area records at least one loaded living spec name, verified by the fixture and the command-body instruction.
- **SC-004**: All existing test suites (TypeScript and Python) pass, and the command-body parity/emission gates pass after the re-bless.
- **SC-005**: Zero remaining teaching surfaces describe the old fold: no `--by ai` fold instruction and no fast-path-substep tagging survives in command sources, assembled bodies, goldens, or the capture reference.

## Assumptions

- The `substep: "fast-path"` tag on fold entries is dropped rather than taught to the trust rules: both derivations define a step boundary as a step-level entry (no substep, no task), and #509 deliberately fixed ordering to satisfy the existing rule rather than widening it. Fast-path provenance stays recorded in `size` and `classification.verdict` (both already written by the classify step), which no consumer of the tag outranks.
- The folded plan/tasks spans will be honestly near-zero (the fold commands run back-to-back); the real authoring work is inside the specify span. Near-zero trusted spans are correct — the steps genuinely took no separate time.
- Legacy folded specs (e.g. 512) keep their recorded history untouched; only new runs get the corrected shape.
- The stock preset command family has no fold (verified — `presets/companion-standard/commands/speckit.specify.md` carries no fast-path branch), so the sweep is bounded to the Companion-namespaced surfaces.

## Verbatim Constraints

- Fold calls MUST use `--by extension` and step-level entries (no `--substep` flag): `write-context.py --feature-dir <dir> --step plan --kind start --by extension` … ending `--step tasks --kind complete --status ready-to-implement --by extension`.
- The recorded loads land on `livingSpecs.loaded` via `write-context.py --living-specs <name>`.
- Golden re-bless order: `build-commands.py`, `assemble-nodes.py`, then `capture-golden.py`.
