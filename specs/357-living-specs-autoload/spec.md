# Feature Specification: Auto-load living specs into specify & plan (LS·2)

**Feature**: Living Specs · Wave 4 · v1 read path
**Issue**: [#362](https://github.com/alfredoperez/speckit-companion/issues/362)
**Depends on**: #361 (LS·1 — capability resolver + `livingSpecs` config reader)

## User Scenarios & Testing

### User Story 1 - A change to a known area loads its living spec automatically (Priority: P1)

When a developer starts a feature whose files fall inside a configured capability, the assistant already knows that area's living spec and folds it into context before drafting — most-specific first, so the leaf capability is the primary frame and any parent capability sits behind it. The developer stops re-explaining the codebase.

**Why this priority**: This is the whole value of the read path — the assistant arrives pre-briefed. Without it, the LS·1 resolver is dead weight.

**Independent Test**: Configure a `checkout` capability with a populated living spec, start a feature touching that area, and confirm the assistant loaded the capability and the drafted spec reflects the living-spec content.

**Acceptance Scenarios**:
1. **Given** a project with `livingSpecs.enabled: true` and a `checkout` capability whose living spec is populated, **When** the developer runs the specify step for a change touching the checkout area, **Then** the assistant loads `checkout`'s living spec and records `checkout` as a loaded capability.
2. **Given** a change whose files match more than one capability, **When** the specify step resolves the in-scope capabilities, **Then** all matches are loaded in most-specific-first order (leaf primary, parent the frame).
3. **Given** the specify step recorded the loaded capabilities, **When** the plan step runs for the same feature, **Then** plan reuses the recorded capabilities instead of re-resolving from scratch.

### User Story 2 - Missing config or missing spec never blocks the pipeline (Priority: P1)

A project with no living-specs config, with the feature switched off, or with a capability whose spec file does not exist yet must run specify and plan exactly as they do today — no load, no recording, no error, no warning that stops the run.

**Why this priority**: Opt-in by presence is the safety contract. A read path that can break a stock run is unshippable.

**Independent Test**: Run specify in a repo with `livingSpecs.enabled: false` (and again with no config at all) and confirm nothing loads, no loaded-capabilities field is written, and the run completes normally.

**Acceptance Scenarios**:
1. **Given** `livingSpecs.enabled: false` (or no `.specify/companion.yml`), **When** the specify step runs, **Then** no capability is loaded and no loaded-capabilities field is written to the spec context.
2. **Given** a configured capability whose `spec.md` does not exist on disk, **When** the specify step resolves it, **Then** the missing spec is silently skipped and the run continues normally.

## Edge Cases

- No `.specify/companion.yml` present → resolver is inert, nothing loads, no field written.
- `livingSpecs.enabled: false` → same inert behavior even when capabilities are declared.
- A capability matches but its `spec.md` is absent → skip that one spec, still load the others.
- The same capability is resolved at specify and again at plan → plan reads the recorded list rather than re-resolving; recording is idempotent (no duplicate names).
- Resolver script or `python3` unavailable → the load step is best-effort and degrades to the stock behavior without failing the host command.
- Specify and plan must NEVER write a living spec (no `capabilities/<name>/spec.md` is created or edited from these steps — read-only).

## Requirements

### Functional Requirements

- **FR-001**: The specify command body MUST, when `livingSpecs.enabled` is true, call the LS·1 resolver with the in-scope changed files in `--changed … --json` mode to determine the capabilities in scope.
- **FR-002**: For each resolved capability the specify step MUST read its `capabilities/<name>/spec.md` into working context in most-specific-first order (leaf primary, parent the frame), skipping any capability whose spec file is absent.
- **FR-003**: The specify step MUST record the names of the loaded capabilities into the feature's `.spec-context.json` so later steps can reuse them.
- **FR-004**: The plan command body MUST reuse the capabilities recorded at specify time instead of re-resolving; if none were recorded it MAY resolve from the changed files.
- **FR-005**: With `livingSpecs.enabled` false or no config, specify and plan MUST behave byte-for-byte as today — no resolver call, no spec load, no loaded-capabilities field written.
- **FR-006**: A missing capability, missing spec file, missing config, or unavailable resolver MUST be silently skipped and MUST NEVER fail or block the specify/plan run.
- **FR-007**: Specify and plan MUST NOT write or modify any living spec file — the read path is strictly read-only.
- **FR-008**: The recording mechanism MUST NOT regress the strict capture schema or the capture eval — the loaded-capabilities data is stored under a non-lifecycle key that the existing schema's `additionalProperties` already permits, and lifecycle keys remain refused by the field setter.
- **FR-009**: The recording writer MUST merge onto the existing `.spec-context.json` record, never rebuild it, and MUST de-duplicate capability names.

### Key Entities

- **Loaded capabilities record**: the list of capability names whose living specs were folded into context for a feature, stored on `.spec-context.json` under a `livingSpecs` key (e.g. `{ "loaded": ["checkout-cart", "checkout"] }`), ordered most-specific-first. Read-only metadata for the read path — never a lifecycle field.
- **Living spec (capability spec.md)**: the existing LS·1 artifact at `capabilities/<name>/spec.md`. Read by specify/plan, never written by them.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A change touching a single configured capability records exactly that capability as loaded, with no manual pointing (100% of the time the capability + spec exist).
- **SC-002**: A multi-capability change records all matching capabilities in most-specific-first order.
- **SC-003**: The plan step reuses the recorded capabilities in 100% of runs where specify recorded at least one.
- **SC-004**: With the feature off or unconfigured, zero capabilities are loaded and zero loaded-capabilities fields are written.
- **SC-005**: Existing checks stay green: `npm test`, `pytest speckit-extension/tests/`, `check-shape-parity.py`, and the capture eval all pass with the new bodies.

## Assumptions

- The recording is stored under a top-level `livingSpecs` object on `.spec-context.json` (the schema already allows additional properties), keeping it out of the strict required set and out of `check_capture.py`'s lifecycle assertions.
- Because `--set` coerces values to scalars only, recording a list of names needs a dedicated, non-lifecycle write path on `write-context.py` rather than overloading `--set`.
- "In-scope changed files" at specify time are the files the assistant has identified as the feature's surface; when none are yet known, the step degrades to no load rather than guessing.
- The change keeps the existing per-step node-assembly model — specify and plan are already in the golden `INTENTIONALLY_CHANGED` exemption, so adding nodes there is expected; the golden is re-blessed deliberately after the edit.
