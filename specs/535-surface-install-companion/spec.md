# Feature Specification: Surface "Install Companion" prominently

**Feature Branch**: `535-surface-install-companion`
**Status**: Ready for planning
**Input**: GitHub issue #543 — Surface "Install Companion" prominently: sidebar badge + CTA, and a first-class Companion option in Create Spec.

## Summary

Today the only nudge to install the Companion spec-kit extension is a badge buried in the Steering view (#381), which most users never see, and the SpecKit Companion workflow is filtered out of Create Spec entirely until installed. This feature makes the Companion value proposition visible at the moments that matter — starting a spec and glancing at the sidebar — without breaking the not-installed experience. The enabler is that Companion is already a graceful workflow: `profileDispatch` downgrades every `speckit.companion.*` command to its stock twin when the extension isn't installed, so surfacing Companion everywhere never breaks anything.

## User Scenarios

### US1 — First-class Companion option in Create Spec (Priority: P1)

As a user starting a new spec who has not installed Companion, I want to see SpecKit Companion offered as a workflow with its benefits, so I can choose it and be guided to install it at the highest-intent moment.

**Acceptance**:
- The Create Spec workflow picker always lists SpecKit Companion, even when the extension is not installed, marked with a benefits line and an "Install to enable" hint.
- Selecting Companion while not installed shows a benefits card with a one-click Install button first — no surprise install, no silent writes.
- Declining install still starts the spec via the graceful stock downgrade, with no error.
- Installing continues the spec creation with the Companion workflow seeded.

### US2 — Activity-bar badge (Priority: P1)

As a user who has not installed Companion, I want a badge on the SpecKit activity-bar icon, so I notice there is something to enable even when the view is collapsed.

**Acceptance**:
- When not installed, the Specs view carries `badge = { value: 1, tooltip: "Install SpecKit Companion" }`, which VS Code aggregates onto the activity-bar container icon.
- The badge disappears the moment the extension is installed, with no reload.

### US3 — Pinned CTA row atop the Specs tree (Priority: P2)

As a user with existing specs who has not installed Companion, I want a persistent, on-brand call-to-action at the top of the Specs tree, so a one-click install is always within reach.

**Acceptance**:
- When not installed and the tree has specs, a first row "Get Companion — living specs, capture, fast-path" appears with a yellow rocket icon.
- Clicking it runs the install command.
- The row vanishes when installed.

### US4 — Empty-state welcome button (Priority: P3)

As a user with an empty Specs view who has not installed Companion, I want a big install button in the empty state, so the value is visible even before I have any specs.

**Acceptance**:
- When the Specs view is empty and Companion is not installed, a welcome install button renders.
- This intrusive surface is dismissable and remembered — once dismissed it does not return.
- The button and dismiss vanish when installed.

### US5 — Retire the buried Steering badge (Priority: P2)

As a user, I should not see a redundant "Not installed" warning buried in the Steering view now that the value is surfaced where I actually look.

**Acceptance**:
- The Steering view no longer shows the Companion "Not installed" warning node when the extension is absent.
- When installed, the Steering Companion node with Configuration + Commands still works as before.

## Requirements

- **FR-001**: All install-nudge surfaces MUST be gated on `!speckit.companion.installed` and MUST vanish when the context key flips true, without a reload.
- **FR-002**: The Create Spec picker MUST always offer SpecKit Companion; the not-installed pick MUST present benefits + one-click install before dispatch.
- **FR-003**: Declining install on a Companion pick MUST fall through to the graceful stock downgrade and still create the spec.
- **FR-004**: The Specs activity-bar view MUST set the install badge when not installed and clear it when installed.
- **FR-005**: A pinned CTA row MUST appear atop the Specs tree (when specs exist) when not installed, using a real accent color (`charts.yellow`), not a muted/disabled token.
- **FR-006**: An empty-state welcome install button MUST render when the view is empty and not installed, and MUST be dismissable-and-remembered.
- **FR-007**: Ambient surfaces (create-spec option, badge, pinned row) MUST persist until installed; only the intrusive empty-state surface is dismissable.
- **FR-008**: Each surface MUST fire the `companion.installPrompt` telemetry with a per-surface tag (shown/clicked), coercing the surface value at the telemetry boundary.
- **FR-009**: The buried Steering "Not installed" badge MUST be retired.
- **FR-010**: Nothing may reintroduce a per-command enumerated guard; reuse the existing `speckit.companion.installed` context key, the `speckit.companion.installSpecKitExtension` command, and the `#506` install-prompt telemetry.

## Out of Scope

- Changing the graceful-downgrade mechanism itself (`profileDispatch`).
- New telemetry beyond the existing `companion.installPrompt` funnel.
- Toast/notification nags outside the four named surfaces.
