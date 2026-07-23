# Nest a step's artifact files under it in the viewer rail

## User Scenarios & Testing

### User Story 1 - Read where a file comes from, in place (Priority: P1)

A developer opens a spec in the viewer and looks at the left document rail. Under the **Pipeline** heading they see the workflow steps (Specification, Plan, Tasks). The plan's artifact files (Data Model, Living Components, Research) sit **indented directly under Plan**, and the specification's Requirements file sits indented under Specification. The developer no longer has to scan separate "Plan files" / "Specification files" groups below the pipeline and mentally map each file back to its step — the nesting answers "where does this file come from" in place.

**Why this priority** — this is the whole point of the ticket: the current decoupled layout forces a mental re-join between a file and its step. Nesting removes that friction and is the MVP.

**Independent Test** — open a spec whose plan produced artifact docs; confirm those docs render as indented sub-items beneath the Plan step in the Pipeline group, not in a separate labeled group below it.

**Acceptance Scenarios**

1. **Given** a spec whose plan step owns Data Model, Living Components, and Research docs, **When** the rail renders, **Then** those three docs appear as indented sub-items directly under the Plan step and no separate "Plan files" group is rendered below the pipeline.
2. **Given** a spec whose specification step owns a Requirements doc, **When** the rail renders, **Then** Requirements appears indented under Specification.
3. **Given** the rail, **When** it renders, **Then** the Overview entry stays at the very top, above the Pipeline group.
4. **Given** a workflow with Implement and Mark Complete action steps, **When** the rail renders, **Then** those action steps do not appear as pipeline entries (regression guard for #516).

### User Story 2 - Every artifact stays one click away (Priority: P2)

A developer clicks a nested artifact sub-item and the viewer opens that document, exactly as it did when the file lived in a separate group. Selecting a sub-item highlights it, and the parent step keeps its own click target (opening the step's own document). No artifact becomes unreachable, including an artifact whose owning step is a hidden action step.

**Why this priority** — the nesting must not cost any reachability. It is a layout change, not a capability change.

**Independent Test** — click each nested sub-item and confirm it dispatches a `switchDocument` for that doc; confirm an artifact whose parent step is hidden still renders somewhere reachable.

**Acceptance Scenarios**

1. **Given** a nested artifact sub-item, **When** the developer clicks it, **Then** the viewer switches to that document and the sub-item shows as active.
2. **Given** an artifact doc whose `parentStep` is a hidden action step (e.g. Implement), **When** the rail renders, **Then** the artifact still renders in a fallback group so it stays reachable.
3. **Given** a step tab with nested children, **When** the developer clicks the step tab itself, **Then** the step's own document opens (the step click target is unchanged).

### Edge Cases

- A related doc with no `parentStep` nests under the first (root) pipeline step, matching the prior fallback.
- A related doc whose `parentStep` names a step that is not a rendered rail entry (a hidden action step, or a step absent from the workflow) renders in a fallback group so it is never dropped.
- A step with no related children renders exactly as today — no empty nested list.
- Living-spec mode (flat tier strip) is unaffected — it has no pipeline steps to nest under.

## Requirements

### Functional Requirements

- **FR-001**: The rail MUST render each step's existing related artifact docs as indented sub-items directly beneath that step inside the Pipeline group.
- **FR-002**: The rail MUST NOT render the former separate per-step "<Step> files" groups below the pipeline for artifacts whose owning step is a visible pipeline entry.
- **FR-003**: The Overview entry MUST remain the first entry in the rail, above the Pipeline group.
- **FR-004**: Action steps (Implement, Mark Complete, any document-less custom step) MUST NOT render as pipeline entries.
- **FR-005**: Clicking a nested artifact sub-item MUST switch the viewer to that document; the selected sub-item MUST show an active state.
- **FR-006**: Clicking a step tab MUST keep opening that step's own document, unchanged by the nesting.
- **FR-007**: An artifact doc whose `parentStep` is not a visible pipeline entry MUST still render in a reachable fallback group so no artifact is dropped.
- **FR-008**: The nested sub-items under a step MUST read as a nested list to assistive technology (list roles/semantics), not a flat run of buttons.
- **FR-009**: Existing rail behavior MUST be preserved: active/selected highlighting, per-step running indicator, task-completion percent host, keyboard focus, and step locking.

### Key Entities

- **SpecDocument** — a rail entry; `category` of `core` (pipeline step), `action` (hidden), or `related` (artifact). A `related` doc carries `parentStep` naming the step it belongs to.

## Success Criteria

### Measurable Outcomes

- **SC-001**: For a spec whose visible steps own artifact docs, zero separate "<Step> files" groups render below the pipeline; 100% of those artifacts render nested under their step.
- **SC-002**: 100% of artifact docs remain reachable by a single click (nested or fallback), with no regression in which document opens.
- **SC-003**: The Overview entry and the hiding of action steps are unchanged (verified by existing and new tests passing).

## Assumptions

- The nesting reuses the existing `.step-child` sub-item visual language, indented one level under the step, to keep the rail compact rather than adding a tall second row per step.
- The fallback group for hidden-parent artifacts keeps the existing "<Step> files" label so those artifacts read the same as before.

## ADDED Requirements

<!-- capability: viewer-ui -->

### A step's artifact files nest under it in the rail

Each pipeline step's related artifact documents MUST render as an indented sub-list directly beneath that step in the rail, not in separate per-step groups below it. A step owns a related document when the document names it as its parent step; a document with no parent step falls back to the first pipeline step. An artifact whose owning step has no rail entry — a hidden action step, or a step absent from the workflow — MUST still render in a labeled fallback group so no artifact is dropped.

#### Scenario: a step produced artifact documents
- **WHEN** a visible step owns one or more related documents
- **THEN** those documents render as indented sub-items under that step
- **AND** no separate "<step> files" group renders for them below the rail

#### Scenario: an artifact belongs to a hidden step
- **WHEN** a related document's owning step is not shown in the rail
- **THEN** the document renders in a labeled fallback group so it stays reachable

#### Scenario: an artifact sub-item is selected
- **WHEN** the reader clicks a nested artifact sub-item
- **THEN** the viewer switches to that document and the sub-item reads as current
- **AND** clicking the parent step still opens the step's own document
