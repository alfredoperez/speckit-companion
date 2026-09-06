# Feature Specification: A living spec is read one requirement at a time

**Issue**: [#672](https://github.com/alfredoperez/speckit-companion/issues/672) — "Living specs: load, navigate and validate by requirement, not by file" (Wave 1 of 3)
**Branch**: `605-requirement-level-living-specs`
**Created**: 2026-09-05

## Context

The project keeps fourteen living specs, about 3,400 lines between them. Four are past 330 lines and the largest is 508. Every fold, sync and adoption makes them longer, and none of them ever gets shorter.

The cost lands on every run. A change touching one file in the viewer causes the first two steps to read that capability's whole 398-line spec and the 292-line core spec, most of which describes behaviour the change will never go near. This very feature's own run loaded five capabilities — roughly 1,900 lines — to describe a change to a handful of files.

The instinct is to add a folder tree. A tree would only re-encode what the registry already says with globs, and the resolver already orders a child capability ahead of its parent. The gap is not hierarchy. It is that a living spec is loaded and shown as one block when the thing it is made of is a requirement.

This wave makes the requirement the unit. Two later waves add validation and command-line reads; they are out of scope here.

## User Scenarios & Testing

### User Story 1 - A run reads only the requirements about the code it is changing (Priority: P1)

A developer starts a feature that touches one file in a large capability. The run reads that capability's purpose and the handful of requirements that describe that file, and nothing else. The run's own record names which requirements it read, so anyone reading the spec afterwards can see what the work was briefed on.

**Why this priority**: This is the entire point of the wave. Every other item exists to make this possible or to make it visible. It is also the item with a measurable outcome, so it is the one that proves the feature worked.

**Independent Test**: Add file markers to one large capability's requirements. Start a feature touching a single file that only one requirement claims. Confirm the run reads the purpose plus that requirement, that the recorded requirement list names it, and that the total lines read fall well below the whole spec.

**Acceptance Scenarios**

1. **Given** a capability whose requirements carry file markers, **When** a run begins on a change touching one file, **Then** it reads the capability's purpose, every requirement whose marker matches that file, and every requirement carrying no marker.
2. **Given** the same run, **When** it records what it loaded, **Then** the record names the requirements it read, alongside the existing list of capabilities.
3. **Given** a capability whose requirements carry no markers at all, **When** a run begins, **Then** the whole spec is read exactly as it is today.
4. **Given** a change touching files that several capabilities claim, **When** the run loads, **Then** each capability contributes only its own matching and unmarked requirements, in the order the resolver already puts capabilities in.

---

### User Story 2 - A requirement says which files it describes (Priority: P1)

A developer opens a living spec and can see, per requirement, which part of the codebase it is about. When the tooling writes or updates a requirement it records that itself, so the information is a by-product of normal work rather than a second thing to maintain.

**Why this priority**: Nothing in Story 1 can happen without the markers, and a marker nobody writes is a marker nobody has. Tying it to the two commands that already produce requirements is what stops this becoming manual bookkeeping.

**Independent Test**: Adopt a code area and confirm each produced requirement carries a marker naming files that were actually read for it. Then change one of those files, sync, and confirm the updated requirement's marker still covers it.

**Acceptance Scenarios**

1. **Given** a capability being adopted from existing code, **When** its requirements are written, **Then** each carries one marker naming the files that requirement was derived from.
2. **Given** a sync that updates a requirement, **When** the update is written, **Then** that requirement's marker names the changed files as well as what it already named.
3. **Given** a hand-written requirement with no marker, **When** anything reads the spec, **Then** it is treated as describing every file the capability claims, and nothing warns about it.
4. **Given** a spec file at rest, **When** any existing tool reads it — fold-back, drift, coverage, the viewer — **Then** the marker changes nothing about how that tool behaves.

---

### User Story 3 - A reader can find one requirement without scrolling (Priority: P2)

A developer opens a living spec of 400 lines and sees a list of its requirements beside the content. Each row says whether that requirement has known coverage and roughly how much of the codebase it claims. Clicking a row moves to it.

**Why this priority**: It is the human half of the same idea and the thing people actually ask for when they ask for a tree. It is genuinely useful on its own, but a run's cost is unaffected by it, so it ranks below the two items that change what a run reads.

**Independent Test**: Open a living spec with more than a handful of requirements and confirm the outline lists every one of them, that a row with known coverage is distinguishable from one without, and that clicking a row moves to that requirement.

**Acceptance Scenarios**

1. **Given** a living spec is open, **When** it renders, **Then** an outline lists its requirement headings in document order.
2. **Given** a requirement whose coverage is known, **When** the outline renders, **Then** its row shows that, and a requirement whose coverage is unknown is shown as unknown rather than as zero.
3. **Given** a requirement carrying a file marker, **When** the outline renders, **Then** its row indicates how many files that marker names.
4. **Given** a row is activated, **When** the reader clicks it or reaches it by keyboard, **Then** the view moves to that requirement.
5. **Given** a feature spec rather than a living spec, **When** it renders, **Then** no such outline appears.

---

## Edge Cases

- A marker naming a path that matches nothing on disk: the requirement is still loaded and shown, and nothing fails. Reporting an unmatched marker belongs to the validator in a later wave.
- A marker written inside a fenced code block, as an example: it is not a marker. Requirement and marker parsing both ignore fenced content, on both sides, or the outline and the coverage denominator disagree.
- Two requirements in one capability sharing a heading: the outline shows both; which requirement a heading refers to is a validation question for a later wave.
- A requirement with a marker that matches every file the capability claims: indistinguishable in effect from no marker, and that is correct.
- A capability spec with no purpose section: the load contributes its matching requirements and no purpose, rather than skipping the capability.
- A spec where every requirement carries a marker and none matches the change: the purpose alone is loaded. The capability is still recorded as loaded, because it was consulted.

## Requirements

### Functional Requirements

- **FR-001**: A requirement MAY carry one marker naming the files it describes, expressed so that every existing reader of the spec ignores it.
- **FR-002**: A requirement carrying no marker MUST be treated as describing every file its capability claims.
- **FR-003**: When a capability's spec carries at least one marker, a load MUST contribute the capability's purpose, every requirement whose marker matches a changed file, and every requirement carrying no marker — and nothing else.
- **FR-004**: When a capability's spec carries no markers, a load MUST contribute the whole spec, unchanged from today's behaviour.
- **FR-005**: A run MUST record which requirements it loaded, per capability, without altering the shape of the existing record of which capabilities it loaded.
- **FR-006**: Adoption MUST write a marker on each requirement it produces, naming the files that requirement was derived from.
- **FR-007**: A sync that updates a requirement MUST write or widen that requirement's marker to cover the files it changed.
- **FR-008**: Requirement parsing MUST ignore fenced code blocks, and the two implementations that parse requirements MUST count the same headings as each other.
- **FR-009**: A living spec MUST render an outline of its requirement headings, in document order, alongside its content.
- **FR-010**: An outline row MUST show that requirement's coverage where it is known, and MUST show unknown coverage as unknown rather than as none.
- **FR-011**: An outline row MUST indicate how many files that requirement's marker names, and MUST show nothing where there is no marker.
- **FR-012**: Activating an outline row MUST move the view to that requirement, by pointer and by keyboard alike.
- **FR-013**: A feature spec MUST NOT render the outline.
- **FR-014**: Fold-back, drift, sync, coverage and adoption MUST behave identically on a spec that carries no markers, and a marker MUST NOT change how any of them treat a spec that does.
- **FR-015**: The on-disk spec format MUST NOT otherwise change, and the registry and its ordering MUST NOT change.

## Key Entities

- **Requirement** — a named statement of behaviour within a capability, identified by its heading text. Already the unit that fold-back matches on, that coverage counts, and that the viewer draws as a card. This feature makes it the unit of loading and navigation too.
- **File marker** — an optional association from one requirement to the paths it describes. Written by the tools that produce requirements, read by the load and the outline, ignored by everything else.
- **Loaded-requirement record** — what a run read, per capability. A sibling of the existing record of which capabilities were loaded, never a replacement for it.

## Success Criteria

### Measurable Outcomes

- **SC-001**: For a change touching one file in the largest capability, the lines of living spec a run reads fall by at least 60% against reading the whole spec.
- **SC-002**: A run's record names the requirements it read, where today it names only the capabilities.
- **SC-003**: A capability whose spec carries no markers produces a byte-identical load to today's.
- **SC-004**: Adopting a code area produces requirements that all carry markers.
- **SC-005**: A reader can reach any requirement in a 400-line spec in one action from the outline.
- **SC-006**: Every existing living-spec behaviour — fold, drift, sync, coverage — passes its existing tests unchanged.

## Assumptions

- The marker's job is to narrow a load, not to be exhaustive. A marker that names fewer files than the requirement truly touches costs a run one missed requirement, which is why an unmarked requirement is always loaded. This is deliberate and is what makes partial adoption safe.
- Percentage in SC-001 is measured against the capability the change touches, not against every capability loaded.
- Coverage in the outline reuses whatever the viewer already computes per requirement; this feature adds no new coverage computation.

## Non-Goals

- **Validation.** Shape checks, the fold-back refusal, editor diagnostics and the retire guard are Wave 2 of the issue and are not in this spec.
- **Command-line reads.** Printing a requirement or a capability's headings from a terminal is Wave 3.
- **Splitting the four large specs.** The issue says to measure after this lands and split only what markers did not shrink enough. That measurement is an outcome of this wave, not part of it.
- **A cross-requirement graph.** Explicitly ruled out by the issue: nobody can maintain requirement-to-requirement links by hand.
- **Changing the registry or its glob ordering.**
- **Feature specs.** Untouched throughout.

## Verbatim Constraints

- `touches` — the marker's name
- `livingSpecs.loadedRequirements` — the new record, a sibling of `livingSpecs.loaded`
- `livingSpecs.loaded` — the existing record, whose shape must not change
- `requirementIds()` — the existing parser the new parsing sits beside
- `src/features/specs/livingSpecsModel.ts` — the extension-side home
- `resolve-spec-paths.py` — the spec-kit-side home
- `living-specs.yml` — the registry, unchanged

## ADDED Requirements
<!-- capability: capture-runtime -->

### A living-spec load is sliced by requirement, and a spec with no markers is read whole

The resolver SHALL report, for each capability a change matches, either that its spec is read whole — the case when the spec carries no file marker anywhere — or the capability's purpose plus the requirements to contribute: those whose marker matches a changed file, and every requirement carrying no marker. A capability whose markers all miss still appears, with its purpose and no requirements, because it was consulted and completion accounting must still see it. A marker can only narrow: an unmarked requirement is contributed by every load, so a missing or too-narrow marker costs a run an extra requirement rather than starving it of one.

#### Scenario: a marked capability and a change it claims
- **WHEN** a load resolves a capability whose requirements carry markers
- **THEN** it reports the purpose plus the matching and unmarked requirements, and not the whole file

#### Scenario: a capability with no markers
- **WHEN** a load resolves it
- **THEN** it is reported as read whole, byte-identical to the behaviour before markers existed

### Which requirements a run read is recorded beside which capabilities it loaded

The capture runtime SHALL record the requirement headings a run read, per capability, as a sibling of the existing loaded-capability list rather than as a change to it — that list is a plain list of names several readers already consume, including the completion accounting that requires every loaded capability to end with a delta or a recorded skip. A capability read whole receives no entry, because naming all of its requirements would say nothing the capability record does not. The write is additive and idempotent, and a failure to record it MUST NEVER fail the host command.

#### Scenario: a capability read by requirement
- **WHEN** the recorder runs
- **THEN** the sibling record names the requirements read, and the capability list keeps its plain-list shape

#### Scenario: a capability read whole
- **WHEN** the recorder runs
- **THEN** the capability is listed as loaded and the sibling record carries no entry for it

## ADDED Requirements
<!-- capability: companion-commands -->

### The load steps read a living spec by requirement, and fall back to the whole file

The specify and plan load steps SHALL ask the resolver what each capability should contribute for the files the change touches, and read only what it names. Where the resolver is unavailable or the call fails, they SHALL read each capability's spec whole exactly as before: the narrowing is an optimization, and it must never cost a step its brief.

#### Scenario: the resolver answers
- **WHEN** a load step runs against a capability carrying markers
- **THEN** it reads that capability's purpose and the named requirements only

#### Scenario: the resolver is unavailable
- **WHEN** the call fails
- **THEN** the step reads the whole spec and continues, without failing the command

### Adoption and sync write the file markers, so nobody maintains them by hand

Adoption SHALL write a marker under each requirement it produces, naming the files that requirement was derived from. A sync SHALL write or widen the marker of each requirement it updates, as the union of what the marker already named and the files it folded in — never narrowing, since a requirement that keeps claiming a file it no longer touches costs a run one extra requirement, where narrowing could cost it a needed one.

#### Scenario: a capability is adopted
- **WHEN** its requirements are written
- **THEN** each carries a marker naming the files it was derived from

#### Scenario: a sync updates a requirement
- **WHEN** the update is written
- **THEN** that requirement's marker names the changed files as well as what it already named

## ADDED Requirements
<!-- capability: specs -->

### Requirement slicing lives beside the requirement-id parser and counts the same headings

The extension SHALL parse a living spec into requirement slices — heading, optional file marker, body — next to the existing requirement-id parser, stripping fenced blocks with the same rule so an example in a snippet is never counted. The parser exists in two runtimes because neither can call the other, so both SHALL be held to one shared set of fixtures, and a fixture exercised by only one of them SHALL fail the build.

#### Scenario: a heading inside a fenced block
- **WHEN** either parser reads the spec
- **THEN** it is not a requirement, in both runtimes

#### Scenario: a fixture is added
- **WHEN** only one runtime's suite exercises it
- **THEN** the drift guard fails, because that is a case where the two are free to disagree

## ADDED Requirements
<!-- capability: viewer-ui -->

### A living spec is navigable by requirement

A living spec SHALL render an outline of its requirement headings, in document order, derived in the same pass that builds the requirement cards — a second parse is how a row and its card come to disagree. Each row SHALL show that requirement's coverage where it is known and as unknown where it is not, never as zero, and the number of files its marker names where it carries one. Activating a row SHALL move the view to that requirement, by pointer and by keyboard alike. A feature spec SHALL NOT render the outline.

#### Scenario: a large living spec is opened
- **WHEN** it renders
- **THEN** every requirement appears once in the outline, in document order

#### Scenario: a requirement whose coverage was never computed
- **WHEN** its row renders
- **THEN** it reads as unknown rather than as zero, which would mean none

#### Scenario: a heading inside a fenced block
- **WHEN** the cards and the outline are built
- **THEN** it is neither a card nor a row, matching what every other reader counts
