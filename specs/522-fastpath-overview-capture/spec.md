# Fast path fills the Overview — Approach card and living-spec chips

A fast-tracked (simple) spec should leave the viewer's Overview panel as complete as a full-pipeline spec does. Today a fast-path run ends with two blanks that a full run fills: the Overview's APPROACH card is empty, and no living-spec chips appear. Both come from the same root cause — the fast path records less into `.spec-context.json` than the Overview reads back.

## User Scenarios & Testing

### User Story 1 - Approach card is populated on a fast-tracked spec (Priority: P1)

A developer runs a small change through the SpecKit Companion pipeline. It classifies as simple and takes the fast path, so `specify` folds in `plan` and `tasks` and writes an Approach section into `spec.md`. When the developer opens the spec in the viewer, the Overview's APPROACH card shows the one-line approach — the same as it would on a full-pipeline spec.

**Why this priority**: This is the most visible half of the gap — the APPROACH card is a headline element of the Overview, and it reads empty on every fast-path spec today.

**Independent Test**: Run a simple-classified spec through `specify`; confirm its `.spec-context.json` carries a non-empty `approach` field and the viewer renders it.

**Acceptance Scenarios**:

1. **Given** a simple-classified change, **When** the `specify` fast-path finalize runs, **Then** `.spec-context.json` carries a non-empty `approach` string.
2. **Given** a fast-path spec whose `spec.md` has an `## Approach` section, **When** the viewer Overview renders, **Then** the APPROACH card shows the recorded approach rather than being blank.

### User Story 2 - Living-spec chips appear on a fast-tracked spec in a covered area (Priority: P1)

A developer runs a small change that touches a code area the project keeps a living spec for. The fast path never reaches `plan` (where a full run loads living specs a second time with the touched files known), so today nothing is recorded and the Overview shows no living-spec chips. After this change, the fast-path finalize deterministically records the capabilities that own the touched files, so the chips appear and mark-complete can fold deltas back.

**Why this priority**: Living specs are the second half of the same Overview gap. Without the recording, the fold-back at mark-complete has nothing to work from, so the feature silently disengages on every fast-path run.

**Independent Test**: Run `record-living-specs.py` against a spec dir with changed files that a covered capability owns; confirm `livingSpecs.loaded` is written with the matched capability names, leaf-first.

**Acceptance Scenarios**:

1. **Given** an enabled `living-specs.yml` and changed files a capability owns, **When** the deterministic recorder runs, **Then** `.spec-context.json` `livingSpecs.loaded` lists the matched capabilities in most-specific-first order.
2. **Given** `living-specs.yml` is absent or `enabled` is not true, **When** the recorder runs, **Then** it writes nothing and exits successfully.
3. **Given** changed files no capability owns, **When** the recorder runs, **Then** it writes nothing and exits successfully.

### User Story 3 - Recording never breaks the host command (Priority: P1)

The deterministic recorder is a passenger on the `specify` command, exactly like every other capture script. Any failure — no `python3`, no registry, an unresolvable feature dir, a malformed config — degrades to a gap in the record, never a halted or slowed command.

**Why this priority**: This is the capture runtime's core contract. A capture change that can fail the run is worse than the gap it fixes.

**Independent Test**: Run the recorder with a missing registry and with an unresolvable input; confirm exit code 0 and no context written.

**Acceptance Scenarios**:

1. **Given** no `living-specs.yml` in the project, **When** the recorder runs, **Then** it exits 0 and writes nothing.
2. **Given** an input the resolver cannot process, **When** the recorder runs, **Then** it reports on stderr and still exits 0.

## Edge Cases

- The pre-draft living-spec load already recorded capabilities (a full run, or a fast run where the surface was known early): the fast-path finalize must not re-resolve or duplicate — an already-populated `livingSpecs.loaded` is left untouched.
- A capability matches but its `spec` file does not exist on disk: it is still a capability in scope, so it may be recorded, but reading it is skipped (read-only, best-effort).
- The recorder is invoked by a shipped command body via the installed script path, so it must be packaged into the runtime archive or a real install breaks.

## Requirements

### Functional Requirements

- **FR-001**: The `specify` fast-path finalize MUST write a one-line `approach` field onto `.spec-context.json` (via `write-context.py --set approach=…`) whenever it writes an Approach section into `spec.md`, so the Overview APPROACH card reads it.
- **FR-002**: A new deterministic recorder script MUST read the project's living-specs registry (`living-specs.yml`, or the legacy `livingSpecs` block), gate on `enabled: true`, run the existing `resolve-spec-paths.py` resolver over the supplied changed files, and record the matched capability names onto `livingSpecs.loaded` (leaf-first) via the existing `write-context.py --living-specs` path.
- **FR-003**: The recorder MUST reuse the shipped resolver's matching logic rather than re-implementing glob/membership/ordering rules.
- **FR-004**: The `load-living-specs` and fast-path `finalize` command bodies MUST call the deterministic recorder with the touched files instead of asking the AI to gate-and-decide the recording. The AI's *reading* of the living specs for drafting stays as best-effort prose.
- **FR-005**: The recorder MUST be best-effort, opt-in, and read-only: a missing registry, disabled feature, absent `python3`, unresolvable feature dir, or resolver error MUST result in a silent no-op that exits successfully and never fails or slows the host command.
- **FR-006**: The recorder MUST NOT duplicate or re-resolve when `livingSpecs.loaded` is already populated for the spec — callers pass it only when nothing was recorded earlier.
- **FR-007**: The new script MUST be added to `package-manifest.py`'s `RUNTIME_SCRIPTS` so a real install ships it, and the manifest checks (`--check`) MUST pass.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A simple-classified spec ends `specify` with a non-empty `approach` field in `.spec-context.json` (0% today → 100%).
- **SC-002**: Running the recorder against changed files a covered capability owns writes `livingSpecs.loaded` with the correct matched names in most-specific-first order.
- **SC-003**: Running the recorder with no registry, a disabled feature, or an unresolvable input writes nothing and exits 0 in 100% of cases.
- **SC-004**: `package-manifest.py --check` and `check-shape-parity.py` pass, and the full Python test suite and TypeScript build stay green.

## Assumptions

- The centralized project registry file is `living-specs.yml` at repo root; the legacy `livingSpecs` block in `.specify/companion.yml` is handled by the same loader (`companion_config.resolve_living_specs`), so the recorder inherits both paths for free.
- Recording all matched capabilities (not only those whose `spec` file exists) is correct for the Overview chips and the fold-back, matching what the resolver returns for `--changed`.

## Verbatim Constraints

- Recorder call shape: `record-living-specs.py --feature-dir <fd> --changed <files…>`
- Approach write: `write-context.py --set approach="<one-line approach>"`
- Manifest set: `RUNTIME_SCRIPTS`

## ADDED Requirements
<!-- capability: capture-runtime -->

### Recording which living specs cover a change MUST be deterministic, not AI-judged

The capture runtime SHALL provide a script that, given a feature directory and the changed files, reads the living-specs registry, gates on `enabled: true`, runs the shipped resolver to find the capabilities that own those files, and records their names (most-specific first) onto `livingSpecs.loaded`. The specify command bodies call this script instead of asking the model to gate-and-decide, so the record cannot be lost to a misjudged "not configured." Like every capture script it is best-effort, opt-in, and read-only: any miss is a silent no-op that exits successfully.

#### Scenario: an enabled registry with a matching change
- **WHEN** the recorder runs with changed files a configured capability owns
- **THEN** `livingSpecs.loaded` lists the matched capabilities most-specific first
- **AND** the command is never failed or slowed by the recording

#### Scenario: the feature is off or nothing matches
- **WHEN** the registry is absent or disabled, or no capability owns the changed files
- **THEN** the recorder writes nothing and exits successfully
