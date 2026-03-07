# Feature Specification: Flexible Workflow Steps

**Feature Branch**: `018-flexible-workflow-steps`
**Created**: 2026-03-06
**Status**: Draft
**Input**: User description: "Workflows should not use the same steps... we are forcing custom workflows to always use the same steps as speckit and they might not...also they might create different files...and some have sub files like we currently do for plan step"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Custom Workflow with Different Steps (Priority: P1)

A developer has configured a custom SDD (Spec-Driven Development) workflow that uses steps named `sdd.specify`, `sdd.plan`, `sdd.tasks`, and `sdd.implement`. The extension currently assumes all workflows must declare `step-specify`, `step-plan`, `step-tasks`, and `step-implement`. The developer wants their workflow to only declare the steps it actually uses without being forced to map all four speckit steps.

**Why this priority**: This is the core problem — custom workflows cannot deviate from the speckit step schema at all, making customization superficial. Fixing this unlocks all other flexible workflow scenarios.

**Independent Test**: Can be fully tested by configuring a workflow with only two custom steps and verifying the sidebar reflects only those steps without errors.

**Acceptance Scenarios**:

1. **Given** a custom workflow with only `step-specify` and `step-implement` defined, **When** a user opens a spec in the sidebar, **Then** only the Specify and Implement steps are shown — Plan and Tasks steps are absent.
2. **Given** a custom workflow with a step named `step-design` (not a standard speckit step), **When** the workflow is active, **Then** the sidebar shows the Design step without errors.
3. **Given** a workflow with no steps defined, **When** it is selected, **Then** the extension falls back gracefully (shows no step documents or a clear empty state) without crashing.

---

### User Story 2 - Custom Steps Produce Different Output Files (Priority: P2)

A developer's custom workflow uses a `step-design` step that produces `design.md` instead of `spec.md`. Another step, `step-prototype`, produces `prototype.md`. The extension currently hard-codes that `step-specify` maps to `spec.md`, `step-plan` maps to `plan.md`, and `step-tasks` maps to `tasks.md`. The developer wants the sidebar and spec viewer to show the correct file for each custom step.

**Why this priority**: Without file mapping, the sidebar cannot display the correct document for a custom step, making the sidebar useless for custom workflows even after P1 is resolved.

**Independent Test**: Can be fully tested by configuring a workflow step with a custom output file and verifying the sidebar opens the correct file on click.

**Acceptance Scenarios**:

1. **Given** a workflow step `step-design` configured with `file: "design.md"`, **When** the user clicks on the Design step in the sidebar, **Then** `design.md` opens in the spec viewer.
2. **Given** a workflow step with no `file` property, **When** the step is rendered in the sidebar, **Then** the extension uses a sensible default (step name + `.md`, e.g., `specify.md`) or shows the step as not yet started.
3. **Given** a standard speckit workflow with no `file` properties specified, **When** the sidebar renders, **Then** `spec.md`, `plan.md`, and `tasks.md` remain the defaults — no regression.

---

### User Story 3 - Steps with Sub-Files (Priority: P3)

A custom workflow has a `step-plan` that produces a primary `plan.md` and a set of sub-files in a `plan/` subdirectory (e.g., `plan/architecture.md`, `plan/api-design.md`). Similarly, a custom `step-design` step may produce `design.md` plus sub-files. The developer wants the sidebar to display these sub-files as children of the step row, just like the current plan step does for speckit.

**Why this priority**: Sub-file support unlocks richer workflow structures. It is lower priority than basic step and file flexibility but is needed for feature parity with the existing plan step behavior.

**Independent Test**: Can be fully tested by configuring a workflow step with sub-files and verifying child items appear under the step in the sidebar.

**Acceptance Scenarios**:

1. **Given** a workflow step configured with `subFiles: ["plan/architecture.md", "plan/api-design.md"]`, **When** the sidebar renders, **Then** those sub-files appear as expandable children under the step row.
2. **Given** a step with `subDir: "plan"`, **When** the sidebar renders, **Then** all `.md` files found in that subdirectory appear as children of the step.
3. **Given** a step with no sub-file configuration, **When** the sidebar renders, **Then** no child items appear for that step (no regression for simple steps).

---

### Edge Cases

- What happens when a configured output file does not exist yet? The step should appear in the sidebar as "not started" with an appropriate indicator, same as the current behavior for missing `spec.md`.
- What happens when two steps in the same workflow reference the same output file? The extension should show both steps but log a configuration warning to the output channel (not a popup).
- How does the system handle a step with a `subDir` that does not exist? The step renders without children and the missing directory is not treated as an error.
- What happens when the active workflow is the built-in speckit workflow? All existing defaults (`spec.md`, `plan.md`, `tasks.md`) continue to work unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `WorkflowConfig` type MUST allow workflows to declare any number of steps with arbitrary names (not limited to `step-specify`, `step-plan`, `step-tasks`, `step-implement`).
- **FR-002**: Each workflow step configuration MUST support an optional `file` property that declares the primary output file for that step (relative to the feature directory).
- **FR-003**: Each workflow step configuration MUST support an optional sub-file declaration (either an explicit `subFiles` list or a `subDir` to scan) so steps can expose child documents in the sidebar.
- **FR-004**: The sidebar (Spec Explorer) MUST render only the steps declared by the active workflow — no step is shown if it is not declared in the workflow config.
- **FR-005**: The sidebar MUST use each step's declared `file` property to determine which document to open; if `file` is absent, the extension MUST derive a default filename from the step name.
- **FR-006**: The spec viewer and workflow editor MUST open the correct file for each step, using the step's declared `file` (or derived default) rather than hard-coded filenames.
- **FR-007**: The built-in speckit workflow MUST continue to work exactly as before with `spec.md`, `plan.md`, and `tasks.md` as defaults — no regression.
- **FR-008**: When a configured step file does not exist, the step MUST appear in the sidebar as "not started" (same visual treatment as currently used for missing `spec.md`).
- **FR-009**: A workflow with zero declared steps MUST be handled gracefully — the sidebar shows an empty or informational state without crashing.

### Key Entities

- **WorkflowStep**: A single step within a workflow config. Has a name (key), an optional display label, an optional output file path, and optional sub-file configuration.
- **WorkflowConfig**: The top-level workflow definition. Contains an ordered list (or map) of `WorkflowStep` entries instead of the four fixed step keys.
- **StepFileMapping**: The resolved pairing of a step to its primary file and any sub-files, used by the sidebar and spec viewer to render and open documents.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A custom workflow with 2 non-standard steps can be configured and displayed in the sidebar without errors or missing UI elements.
- **SC-002**: The sidebar shows only the steps declared by the active workflow — zero phantom steps from the speckit defaults appear when a custom workflow is active.
- **SC-003**: Clicking a custom step row in the sidebar opens the correct configured file 100% of the time.
- **SC-004**: Sub-files configured on a step appear as child rows in the sidebar and open correctly on click.
- **SC-005**: Existing speckit-workflow users experience zero regressions — `spec.md`, `plan.md`, and `tasks.md` behavior is unchanged.
- **SC-006**: No error popups are shown to the user for any valid workflow configuration, including workflows with zero steps or steps with missing output files.

## Assumptions

- Workflow configurations continue to be defined in VS Code settings (`speckit.workflows`); the schema change is additive and backwards-compatible.
- The built-in speckit workflow is defined in code (not user settings) and will be explicitly updated to use the new flexible step schema internally while preserving its current behavior.
- Step ordering in the sidebar follows the declaration order in the workflow config.
- Sub-file scanning (when `subDir` is used) is non-recursive — only direct children of the subdirectory are included.

## Out of Scope

- A visual workflow editor UI for defining custom steps (already handled by the workflow editor feature).
- Validation UI for workflow configuration errors beyond output channel logging.
- Support for non-markdown step output files.
- Per-step checkpoint configuration (checkpoints remain at the workflow level).
