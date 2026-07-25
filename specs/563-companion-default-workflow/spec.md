# Feature Specification: Default workflow to Companion when the companion extension is installed

**Feature branch**: `563-companion-default-workflow`
**Issue**: #567
**Status**: specified

## User Scenarios & Testing

### User Story 1 - Companion is the pre-selected default once the extension is installed (Priority: P1)

A developer installs the companion spec-kit extension into their project but has never touched the `speckit.defaultWorkflow` setting. When they open Create New Spec or run a spec through the per-feature resolution, the workflow that is already selected for them is Companion — the richer pipeline they just opted into by installing the extension — instead of stock SpecKit.

**Why this priority**: This is the whole point of the feature. Installing the companion extension is itself the signal that the user wants the Companion pipeline; making them also flip a setting is friction that defeats the install. This slice delivers the value on its own.

**Independent Test**: With the companion extension present on disk and `speckit.defaultWorkflow` unset, confirm the effective default resolves to `companion` at the Create-Spec pre-selection and per-feature resolution sites.

**Acceptance Scenarios**:

1. **Given** the companion extension is installed and `speckit.defaultWorkflow` is unset, **When** the effective default workflow is resolved, **Then** it resolves to `companion`.
2. **Given** the companion extension is NOT installed and `speckit.defaultWorkflow` is unset, **When** the effective default workflow is resolved, **Then** it resolves to `speckit`.

### User Story 2 - An explicit setting is always honored (Priority: P1)

A developer who has deliberately set `speckit.defaultWorkflow` — to either `speckit` or `companion` — keeps exactly that choice. The install-aware default never overrides a value the user set on purpose, in either direction.

**Why this priority**: Silently overriding a user's explicit configuration is a trust violation and a regression. An explicit `speckit` must stay `speckit` even when the companion extension is installed.

**Independent Test**: With `speckit.defaultWorkflow` explicitly set, confirm the resolver returns that exact value regardless of whether the extension is installed.

**Acceptance Scenarios**:

1. **Given** `speckit.defaultWorkflow` is explicitly set to `speckit` and the companion extension is installed, **When** the effective default is resolved, **Then** it resolves to `speckit` (the explicit value wins).
2. **Given** `speckit.defaultWorkflow` is explicitly set to `companion`, **When** the effective default is resolved, **Then** it resolves to `companion`.

### User Story 3 - Adoption telemetry stays honest (Priority: P2)

The product team reading companion-adoption telemetry sees an explicit companion choice counted as companion, but an install-derived effective default is NOT reported as a companion choice — so the adoption metric reflects deliberate opt-in, not the install-aware convenience default.

**Why this priority**: Reporting the resolved effective value would inflate the companion-adoption denominator with users who never chose companion, making the metric useless for measuring real adoption.

**Independent Test**: With the extension installed and `speckit.defaultWorkflow` unset, confirm the activation snapshot reports the raw configured value (default `speckit`), not `companion`.

**Acceptance Scenarios**:

1. **Given** the companion extension is installed and `speckit.defaultWorkflow` is unset, **When** the activation telemetry snapshot is built, **Then** `defaultWorkflow` is reported as `speckit` (the raw configured value), not `companion`.
2. **Given** `speckit.defaultWorkflow` is explicitly `companion`, **When** the snapshot is built, **Then** `defaultWorkflow` is reported as `companion`.

## Edge Cases

- `speckit.defaultWorkflow` unset vs. explicitly set to `speckit` must be distinguishable — a plain `get(key, 'speckit')` cannot tell them apart, so the resolver must inspect the setting's per-scope values.
- No workspace root available (no folder open): the resolver cannot check for the extension, so it falls back to `speckit`.
- An explicit value that is neither `speckit` nor `companion` (a custom workflow name) is still an explicit value and must be returned as-is by the workflow-pick resolver (existing not-found fallback handles a name that resolves to no workflow).

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide a single resolver that returns the effective default workflow for a workspace root.
- **FR-002**: The resolver MUST return the explicitly-configured `speckit.defaultWorkflow` value when the user has set one at any scope (global, workspace, or workspace-folder), never overriding it.
- **FR-003**: The resolver MUST distinguish an unset `speckit.defaultWorkflow` from an explicit `speckit` using `config.inspect('defaultWorkflow')` rather than `config.get(key, 'speckit')`.
- **FR-004**: When `speckit.defaultWorkflow` is unset, the resolver MUST return `companion` if the companion extension is installed for the given root (via the existing `isCompanionInstalled` detector), else `speckit`.
- **FR-005**: The Create New Spec pre-selection MUST use the resolver so an unset default pre-selects Companion when the extension is installed.
- **FR-006**: The per-feature workflow resolution MUST use the resolver when no per-feature workflow has already been chosen.
- **FR-007**: Adoption telemetry (`buildBetaSnapshot`) MUST continue reporting the raw configured `defaultWorkflow` value (unset reported as the default `speckit`), NOT the resolved effective value.
- **FR-008**: The resolver MUST reuse the existing `isCompanionInstalled(root)` detector and MUST NOT reimplement extension detection.

## Success Criteria

### Measurable Outcomes

- **SC-001**: With the extension installed and the setting unset, 100% of workflow-pick reads resolve to `companion`.
- **SC-002**: With the setting explicitly set, 100% of resolver reads return the explicit value regardless of install state.
- **SC-003**: With the extension not installed and the setting unset, 100% of resolver reads return `speckit`.
- **SC-004**: An install-derived companion default contributes 0 to the companion count in adoption telemetry (only explicit companion choices count).

## Assumptions

- The install signal is the existing `isCompanionInstalled(root)` (the `.specify/extensions/companion/` dir on disk), the same signal the reconciler and the `speckit.companion.installed` context key already use.
- "Explicit" means any of `globalValue` / `workspaceValue` / `workspaceFolderValue` is a non-empty string on `config.inspect('defaultWorkflow')`; the schema `defaultValue` does not count as explicit.
- `workflowManager` validation and the telemetry read sites keep reading the raw configured value; only the two workflow-pick sites adopt the effective resolver.

## Verbatim Constraints

- Setting key: `speckit.defaultWorkflow`
- Workflow identifiers: `speckit`, `companion`
- Detector: `isCompanionInstalled(root)`
