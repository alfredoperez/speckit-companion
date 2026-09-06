# Feature Specification: Living specs — trust the fold

**Feature**: Wave 2 of living specs by requirement ([#672](https://github.com/alfredoperez/speckit-companion/issues/672))
**Created**: 2026-09-06
**Status**: Specifying

A living spec is only worth keeping if what gets folded into it is trustworthy. Today nothing checks the shape of one before it is written to, so a requirement with no scenario, a scenario missing its outcome, or a delta pointing at a heading that does not exist all land silently and are discovered much later by a person reading the file. This feature makes the shape checkable, tells the author about a break while they are still typing it, and stops a fold that would damage the record.

## User Scenarios & Testing

### User Story 1 - A shape check anyone can run (Priority: P1)

A maintainer wants to know whether the project's living specs are well-formed before trusting anything that reads them. They run one command and get a list: which spec, which line, what is wrong, and the one thing to do about it. Nothing is changed on disk, and the command never fails the shell it runs in, so it is safe in a script or a hook.

**Why this priority**: Every other part of this feature consumes these findings. Without the check there is nothing for the fold to refuse on and nothing for the editor to show.

**Independent Test**: Run the check against this repository's fourteen capabilities. It prints real findings, exits successfully, and changes no file.

**Acceptance Scenarios**:

1. **Given** a capability whose spec has a requirement with no scenario under it, **When** the check runs, **Then** it reports that requirement with its file and line and a one-line fix.
2. **Given** a scenario with a WHEN and no THEN, **When** the check runs, **Then** it reports the scenario and names which half is missing.
3. **Given** two requirements with the same heading in one capability, **When** the check runs, **Then** it reports the duplicate and names both lines.
4. **Given** a requirement whose file marker names a pattern matching nothing on disk, **When** the check runs, **Then** it reports the marker at warning severity, because a pattern that matches nothing today may match tomorrow.
5. **Given** any project at all, including one with living specs turned off, **When** the check runs, **Then** it exits successfully.
6. **Given** the machine-readable form is asked for, **When** the check runs, **Then** each finding carries a severity, a stable code, the file it is about, the line, and a one-line fix.

### User Story 2 - A fold that refuses to damage the record (Priority: P1)

A feature completes and its requirement deltas are folded into the living specs. Before anything is written, the same shape check runs against the deltas. A delta that would corrupt the record — a modification or removal naming a heading the target does not have, a block marked for a capability the registry does not know — stops the fold for that capability, and the refusal names the finding so the author knows what to fix. A merely untidy delta does not stop anything.

**Why this priority**: This is the whole point of the wave. A check nobody consumes changes nothing; the fold is the moment the record can be damaged.

**Independent Test**: Complete a feature whose delta modifies a heading that does not exist in the target spec. The fold refuses, names that heading, and the spec on disk is untouched.

**Acceptance Scenarios**:

1. **Given** a delta modifying a heading the target spec does not carry, **When** the fold runs, **Then** it refuses for that capability, names the heading, and leaves the file byte-for-byte unchanged.
2. **Given** a delta block marked for a capability the registry does not list, **When** the fold runs, **Then** it refuses and names the capability.
3. **Given** a delta carrying only untidiness — a requirement with no scenario — **When** the fold runs, **Then** it applies normally and the untidiness is reported, not enforced.
4. **Given** a feature spec with several capability blocks and a break in one of them, **When** the fold runs, **Then** the sound blocks are still applied and only the broken one is refused.

### User Story 3 - A break caught while you are typing it (Priority: P2)

Someone editing a spec file saves it. If the shape is broken, the problem appears in the editor's own problem list, on the line it is about, immediately. They fix it there rather than discovering it at completion, days later, in a refusal message.

**Why this priority**: It shortens the loop from days to seconds, but the fold's refusal already prevents the damage. Valuable, not load-bearing.

**Independent Test**: Save a spec file whose scenario has no THEN. A problem appears against that file at that line, and disappears when the line is fixed.

**Acceptance Scenarios**:

1. **Given** a spec file with a scenario missing its outcome, **When** it is saved, **Then** a problem appears against that file at the scenario's line.
2. **Given** the problem is then fixed and the file saved again, **When** the check re-runs, **Then** the problem is gone.
3. **Given** a file that is not a spec file, **When** it is saved, **Then** nothing is checked and no problem appears.
4. **Given** living specs are turned off for the project, **When** a spec file is saved, **Then** nothing is checked.

### User Story 4 - A spec cannot be emptied by accident (Priority: P2)

A fold that would remove the last requirement from a capability's spec stops, and says which capability it stopped on. Emptying a spec is a deliberate act — retiring a capability — so it has to be declared as one. A capability that has declared it proceeds without argument.

**Why this priority**: Rare, but the damage is total and silent. A stale spec is recoverable; an emptied one has lost the thing that made it worth keeping.

**Independent Test**: Fold a delta removing every requirement from a capability that has not declared retirement. It refuses and names the capability. Declare retirement and the same fold succeeds.

**Acceptance Scenarios**:

1. **Given** a fold that would leave a capability's spec with no requirements, **When** it runs and the capability has not declared retirement, **Then** it refuses and names the capability.
2. **Given** the same fold and the capability has declared retirement, **When** it runs, **Then** it applies and the spec is left with no requirements.
3. **Given** a fold that removes some but not all requirements, **When** it runs, **Then** it applies regardless of whether retirement is declared.

## Edge Cases

- A spec file that cannot be read or parsed: reported as one finding about the file, never as a crash, and never as a reason to refuse a fold for an unrelated capability.
- A file marker whose pattern is malformed rather than merely unmatched.
- A feature spec with no delta sections at all: the fold's check has nothing to say and the fold behaves exactly as it does today.
- Two capabilities whose specs both carry the same requirement heading: not a duplicate, because the check is per capability.
- A scenario heading with no bullets under it at all.
- A spec whose requirements all sit past the uncovered-files section, which fold-back appends to.
- Retirement declared for a capability that is not being emptied: no effect, no finding.
- A project with living specs turned off: every part of this feature is inert.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide a read-only shape check over every registered living spec and over the delta sections of active feature specs, making no change to any file.
- **FR-002**: The check MUST report a requirement that carries no scenario.
- **FR-003**: The check MUST report a scenario missing its condition or its outcome, naming which is absent.
- **FR-004**: The check MUST report two requirements sharing one heading within a single capability, and MUST NOT report the same heading appearing in two different capabilities.
- **FR-005**: The check MUST report a delta block whose capability marker names a capability the registry does not list.
- **FR-006**: The check MUST report a delta entry that modifies or removes a heading the target spec does not carry.
- **FR-007**: The check MUST report a file marker whose pattern matches nothing on disk.
- **FR-008**: The check MUST always exit successfully, whatever it finds and whatever state the project is in.
- **FR-009**: The check MUST offer a machine-readable form in which each finding carries a severity, a stable code, the path it is about, the line, and a one-line fix.
- **FR-010**: The check MUST be inert when living specs are not enabled for the project, reporting that and exiting successfully.
- **FR-011**: The fold MUST run the same check against a feature spec's deltas before writing anything.
- **FR-012**: The fold MUST refuse to apply a capability's delta when the check reports an error-level finding for it, and the refusal MUST name the finding.
- **FR-013**: The fold MUST apply normally when the check reports only warning-level findings.
- **FR-014**: A refusal for one capability MUST NOT prevent another capability's sound delta from being applied in the same fold.
- **FR-015**: The editor MUST run the same checks when a spec file is saved and publish the findings against that file at their lines.
- **FR-016**: Editor findings MUST clear when the underlying problem is fixed.
- **FR-017**: The editor MUST check nothing when the saved file is not a spec file, or when living specs are not enabled.
- **FR-018**: The fold MUST refuse to leave a capability's spec with no requirements unless that capability has declared retirement in the registry, and the refusal MUST name the capability.
- **FR-019**: The registry MUST accept an optional per-capability retirement declaration, and MUST behave exactly as today for every capability that omits it.
- **FR-020**: Where the same checks exist in two runtimes, both MUST be held to one shared set of example specs, and an example exercised by only one of them MUST fail the build.
- **FR-021**: Drift reporting, sync, coverage, adoption, and the requirement-level load MUST behave exactly as they do today for a project that adopts none of this.

## Key Entities

- **Finding** — one thing wrong with one spec. Carries a severity that decides whether a fold stops, a stable code so a finding can be recognised across runs, the file and line it is about, a human sentence, and a one-line fix.
- **Severity** — error or warning. Error means the record would be damaged; warning means the record would merely be untidy. Only error stops a fold.
- **Retirement declaration** — a per-capability statement in the registry that emptying its spec is intended.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The check runs over all fourteen of this repository's capabilities and exits successfully.
- **SC-002**: Every one of the six finding kinds is demonstrated by an example spec that produces it and an example that does not.
- **SC-003**: A fold carrying an error-level finding leaves its target file byte-for-byte unchanged.
- **SC-004**: A fold carrying only warning-level findings produces the same result as it does today.
- **SC-005**: A fold that would empty a spec is refused when retirement is undeclared and applied when it is declared.
- **SC-006**: Saving a spec file with a broken scenario surfaces a problem on that scenario's line.
- **SC-007**: Every existing test for drift, sync, coverage, adoption, and the requirement-level load passes unchanged.
- **SC-008**: Every shared example is exercised by both runtimes, enforced by a check that fails when one of them skips an example.

## Assumptions

- Severity is two values, not a scale. The only decision it drives is whether a fold stops, so a third value would have no meaning.
- A file marker matching nothing is a warning, not an error. A pattern can legitimately describe a directory that does not exist yet.
- A requirement with no scenario is a warning. It is untidy and worth reporting, but folding it damages nothing.
- The retirement declaration lives beside the capability it is about, in the same registry entry as its patterns and its spec path.
- The editor performs its own checks rather than shelling out to the script, because the shipped extension cannot assume the scripts are installed.

## Verbatim Constraints

- The command is `living-validate`.
- The machine-readable flag is `--json`.
- The registry key for retirement is `retire: true`.
- The file marker whose pattern is checked is `touches`.
- The delta capability marker is `<!-- capability: <name> -->`.
- The delta verbs are `MODIFIED` and `REMOVED`.
- The shared example directory is modelled on `speckit-extension/tests/fixtures/requirement-slices/`.

## ADDED Requirements

<!-- capability: capture-runtime -->

### A living spec's shape is checkable, and the fold refuses to write a break
<!-- touches: speckit-extension/scripts/living_validate.py, speckit-extension/scripts/living_spec_fold.py -->

The capture runtime SHALL provide a read-only check over every registered living spec and over the delta sections of active feature specs, reporting a requirement carrying no scenario, a scenario missing its condition or its outcome, two requirements sharing a heading inside one capability, a delta block marked for a capability the registry does not list, a delta entry naming a heading the target spec does not carry, and a file marker matching nothing on disk. Each finding SHALL carry a severity, a stable code, the path, the line, a sentence and a one-line fix, and the check SHALL always exit successfully — a report that can fail the shell it runs in is a gate wearing a report's clothes. Severity SHALL answer exactly one question, whether the fold stops, so error means the durable record would be damaged and warning means it would be untidy. The fold SHALL run the same check in-process before writing anything and refuse, per capability, on an error-level finding, naming it; a correctness gate that a missing interpreter or a subprocess failing for its own reasons can turn into "no findings" is not a gate. A refusal for one capability SHALL NOT prevent another's sound delta from being applied in the same run.

#### Scenario: a delta would fold in a scenario nobody can check
- **WHEN** the fold runs
- **THEN** that capability is refused, the finding is named, and its spec is left byte for byte unchanged

#### Scenario: a delta names a heading the target does not carry
- **WHEN** the fold runs
- **THEN** it applies, because the fold promotes an unmatched modification into an addition and that is a defined outcome rather than damage, and the finding is reported as a warning

#### Scenario: one capability is refused and another is sound
- **WHEN** the fold runs
- **THEN** the sound capability is written and only the broken one is refused

#### Scenario: the check itself fails
- **WHEN** it raises
- **THEN** the fold proceeds, because a broken check must never block a sound fold

### A fold cannot empty a spec unless the capability declared its retirement
<!-- touches: speckit-extension/scripts/living_spec_fold.py, speckit-extension/scripts/companion_config.py, speckit-extension/scripts/resolve-spec-paths.py -->

A fold that would leave a capability's spec with no requirements at all SHALL be refused, naming the capability, unless that capability declares its retirement in the registry. A stale spec is recoverable where an emptied one has lost the thing that made it worth keeping, so emptying one is a deliberate act and has to be declared as one. The declaration SHALL be optional and its absence SHALL read as false, and it SHALL be carried through to the shape the fold actually sees rather than left behind in the registry the fold never reads.

#### Scenario: a fold would remove the last requirement and retirement is not declared
- **WHEN** the fold runs
- **THEN** it refuses, names the capability, and says how to declare the retirement

#### Scenario: the capability declared its retirement
- **WHEN** the same fold runs
- **THEN** it applies

#### Scenario: a fold removes some requirements but not all
- **WHEN** it runs
- **THEN** it applies whether or not retirement is declared

## ADDED Requirements

<!-- capability: companion-commands -->

### The shape check is a command, and it reports rather than gates
<!-- touches: speckit-extension/commands/speckit.companion.living-validate.md -->

The command that checks living-spec shape SHALL act only when the project has opted in, SHALL make no edits, and SHALL never fail the run. Its output MUST state both what was examined and what was skipped with a reason, so a clean report can never be read as a verdict on files that were never examined. The body SHALL NOT direct the assistant to edit a spec to satisfy a finding: fixing is the author's decision, made with the finding in front of them, and a command that quietly rewrites a spec to silence its own report is the opposite of a check.

#### Scenario: the command runs on a project with findings
- **WHEN** it reports
- **THEN** it names each finding's file, line and fix, and edits nothing

#### Scenario: living specs are off for the project
- **WHEN** the command runs
- **THEN** it says so and exits successfully

## ADDED Requirements

<!-- capability: specs -->

### The editor checks a spec's shape on save, in its own process
<!-- touches: src/features/specs/specShapeCheck.ts, src/features/specs/specShapeDiagnostics.ts -->

The extension SHALL run the living-spec shape checks whenever a `*.spec.md` is saved and publish each finding against that file at its line, clearing them when the underlying problem is fixed. The checks SHALL run in the extension's own process rather than by invoking the spec-kit scripts: the shipped extension is only what is in its package and cannot assume those scripts are installed, and a subprocess in the save path is a cost paid on every write. That makes the checks exist in two runtimes, so both SHALL be held to one shared set of example specs and an example exercised by only one of them SHALL fail the build. Nothing SHALL be checked for a file that is not a spec file, or for a project that has not enabled living specs.

#### Scenario: a spec is saved with a scenario missing its outcome
- **WHEN** the save completes
- **THEN** a problem appears against that file on the scenario's line

#### Scenario: the problem is fixed and the file saved again
- **WHEN** the check re-runs
- **THEN** the problem is gone, because the findings are replaced rather than the entry deleted

#### Scenario: a file that is not a spec file is saved
- **WHEN** the save completes
- **THEN** nothing is checked and no problem appears

### The registry carries a capability's retirement declaration
<!-- touches: src/features/specs/livingSpecsModel.ts -->

The registry reader SHALL carry each capability's optional retirement declaration onto the resolved capability, defaulting to false when absent, so both runtimes read the same registry the same way.

#### Scenario: a capability omits the declaration
- **WHEN** the registry is read
- **THEN** it resolves as not retiring, which is every capability that never says otherwise
