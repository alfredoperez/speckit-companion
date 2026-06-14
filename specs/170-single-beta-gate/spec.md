# Feature Specification: One Beta Gate for the SpecKit Companion Workflow

**Feature Branch**: `170-single-beta-gate`
**Created**: 2026-06-14
**Status**: Draft
**Input**: GitHub issue [#302](https://github.com/alfredoperez/speckit-companion/issues/302) — "feat(settings): one beta gate for the SpecKit Companion workflow (picker + resume)" (part of the composable-workflow epic #295, Wave 1 cleanup)

## Overview

Today, opting into the enhanced SpecKit Companion experience means juggling two unrelated switches with confusing behavior. One switch turns on the Continue/Resume button; a separate dropdown that picks the workflow for new specs is *always* visible — even for people who never installed the companion piece that makes it work, so choosing "Companion" quietly does nothing. This feature replaces that confusion with a single, honest opt-in: one beta toggle that turns the whole Companion workflow on, and only shows its options when the companion piece is actually installed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single switch turns on the whole Companion experience (Priority: P1)

A user who wants the enhanced spec workflow flips one beta setting. With the companion piece installed, they immediately get both the workflow picker on the Create Spec screen and the Continue/Resume button — no second switch to find.

**Why this priority**: This is the core promise of the change — collapsing two gates into one. Without it, the feature does not exist.

**Independent Test**: Turn on the single beta setting in a workspace where the companion extension is installed; confirm the Create Spec picker appears and the resume button is enabled, without touching any other setting.

**Acceptance Scenarios**:

1. **Given** the companion piece is installed and the beta setting is off, **When** the user turns the beta setting on, **Then** the Create Spec screen shows the SpecKit / SpecKit Companion picker and the Continue/Resume button becomes available.
2. **Given** the beta setting is on and the companion piece is installed, **When** the user turns the beta setting off, **Then** the picker disappears and Continue/Resume is no longer available — only stock SpecKit behavior remains.

### User Story 2 - No hollow options when the companion piece is missing (Priority: P1)

A user turns on the beta setting but has not installed the companion piece. They should not be shown a workflow picker whose "Companion" choice silently falls back to stock — that is the dishonest surface this change removes. The standing offer to install the companion piece remains available.

**Why this priority**: Removing the silent-fallback surface is the explicit reason the issue exists; an option that does nothing is worse than no option.

**Independent Test**: With the companion piece not installed, turn the beta setting on and open Create Spec; confirm no picker appears and the install prompt is still reachable.

**Acceptance Scenarios**:

1. **Given** the beta setting is on but the companion piece is not installed, **When** the user opens Create Spec, **Then** no workflow picker is shown and new specs use stock SpecKit.
2. **Given** the beta setting is on but the companion piece is not installed, **When** the user looks for it, **Then** the prompt to install the companion piece is still available.

### User Story 3 - Existing opt-in carries over without breaking (Priority: P1)

A user who previously opted into the old resume toggle upgrades to this version. Their opt-in is preserved automatically — the new single setting comes up already on — and a stale or legacy stored value never prevents the extension from starting.

**Why this priority**: A migration that drops the user's preference or crashes startup would be a regression worse than the original confusion; the provider-rename lesson makes this a hard requirement.

**Independent Test**: Seed a workspace with each historical stored value for the old resume setting, upgrade, and confirm the extension activates cleanly and the new setting reflects the prior opt-in.

**Acceptance Scenarios**:

1. **Given** the old resume setting was previously on (including legacy string forms of "on"), **When** the user upgrades, **Then** the new single beta setting is on and the old setting no longer exists.
2. **Given** any stored value (current, legacy, or unexpected) for the old resume setting, **When** the extension activates after upgrade, **Then** activation completes without error.
3. **Given** the old resume setting was off or never set, **When** the user upgrades, **Then** the new beta setting is off (stock behavior).

### Edge Cases

- The companion piece is installed or uninstalled while the Create Spec screen is open — the picker's presence reflects the current installed state the next time the screen is shown.
- The beta setting is on and the companion piece present, but the user has no preferred default workflow recorded — the picker still appears with a sensible preselected choice.
- A future or unrecognized stored value for the old resume setting is encountered during migration — it is treated safely and never blocks activation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST provide a single beta setting, presented under the Beta Features group, labeled "Enable SpecKit Companion workflow (beta)", that governs the entire Companion workflow experience and defaults to off.
- **FR-002**: The single beta setting's description MUST explain that it adds the SpecKit / SpecKit Companion picker to Create Spec (when the companion piece is installed) and enables Continue/Resume.
- **FR-003**: The extension MUST remove the previous standalone resume opt-in setting so that exactly one setting governs the Companion workflow.
- **FR-004**: The extension MUST migrate any previously stored value of the old resume setting so that a prior opt-in (including legacy "on"-style values) results in the new beta setting being on.
- **FR-005**: Migration of the old resume setting MUST NOT cause the extension to fail activation for any stored value, including unexpected or legacy ones.
- **FR-006**: The Create Spec workflow picker MUST be shown only when the beta setting is on AND the companion piece is installed; otherwise Create Spec MUST use stock SpecKit with no picker.
- **FR-007**: When the picker is shown, the user's recorded default workflow MUST be used as the preselected choice; the default-workflow preference MUST surface only when the picker is shown.
- **FR-008**: The Continue/Resume capability MUST be enabled based on the single beta setting rather than the removed resume setting.
- **FR-009**: When the beta setting is on but the companion piece is not installed, the extension MUST NOT present any workflow picker, and the existing offer to install the companion piece MUST remain available.
- **FR-010**: User-facing documentation (README and settings docs) MUST be updated to describe the single beta setting and the removal of the old resume setting.

### Key Entities *(include if feature involves data)*

- **Companion workflow beta setting**: A single on/off user preference, off by default, that gates the entire Companion workflow surface (picker + resume).
- **Default workflow preference**: An existing preference naming the preselected workflow for new specs; relevant only while the picker is shown.
- **Companion-piece-installed signal**: An indication of whether the companion extension is present, used together with the beta setting to decide whether the picker appears and resume is enabled.
- **Legacy resume preference**: The removed standalone setting whose stored value must be migrated into the new beta setting.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Exactly one setting governs the Companion workflow; the old resume setting is absent from configuration.
- **SC-002**: 100% of historical stored values for the old resume setting result in successful extension activation after upgrade (no activation failures).
- **SC-003**: With the beta setting on and the companion piece installed, both the Create Spec picker and Continue/Resume are available in the same session, with no second setting to change.
- **SC-004**: With the beta setting on and the companion piece not installed, no workflow picker is shown (zero silent-fallback surfaces), while the install prompt remains reachable.
- **SC-005**: With the beta setting off, neither the picker nor Continue/Resume appears, and Create Spec produces stock SpecKit specs.
- **SC-006**: A prior opt-in to the old resume setting carries over to the new beta setting being on after upgrade.

## Assumptions

- The existing "companion piece installed" signal accurately reflects whether the companion spec-kit extension is present and is the correct condition to combine with the beta setting.
- The existing default-workflow preference is retained as-is and only its visibility is conditioned on the picker being shown.
- The historical values that must migrate to the new "on" state are the old setting being `true` plus the legacy string forms (e.g. "beta"/"on"); any other value migrates to off.
- "Stock SpecKit only" means the current behavior shipped to users who have not opted into any beta — no new surfaces are introduced when the gate is off.
