# Implemented specs: Mark-as-Completed action + distinct Completed-group icon

## Overview

Specs that finish the pipeline land at status `implemented` and are grouped under the sidebar **Completed** section, but they still await the user's explicit confirmation that the work is truly done. Today they offer no sidebar action to confirm completion and share the same icon tint as in-progress specs, so within the Completed group they cannot be told apart from confirmed-completed specs. This delivers a right-click **Mark as Completed** action for implemented specs and a distinct icon tint so the two states read differently at a glance.

## Functional Requirements

- **FR-001** Right-clicking a spec at status `implemented` in the sidebar MUST offer a **Mark as Completed** action that transitions the spec to status `completed`.
- **FR-002** The **Mark as Completed** action MUST continue to be offered for specs at status `active` and `tasks-done` (existing behavior unchanged).
- **FR-003** A spec at status `implemented` MUST display an icon whose tint is visually distinct from both confirmed-completed specs (green) and in-progress specs (blue), signaling "done, awaiting confirmation."
- **FR-004** A spec at status `completed` MUST keep its existing green-tinted icon, and an in-progress spec MUST keep its existing blue tint.
- **FR-005** The sidebar Completed group MUST continue to contain both `implemented` and `completed` specs (grouping unchanged); only the within-group icon distinction and the new menu item are added.
- **FR-006** Active and archived specs MUST be unchanged in their menus, icons, and grouping.
- **FR-007** Sidebar documentation MUST state that the Completed group holds both confirmed-completed and implemented-awaiting-confirmation specs, and MUST document the new icon tint and the new menu item.

## Success Criteria

- **SC-001** Right-clicking an implemented spec surfaces a Mark-as-Completed entry that, when chosen, moves the spec to the confirmed-completed state.
- **SC-002** An implemented spec's row icon is rendered in a tint that differs from both the completed (green) and in-progress (blue) tints, with 100% of implemented specs receiving the distinct tint.
- **SC-003** No regression in the menus, icons, or grouping of active, completed, or archived specs.
- **SC-004** The sidebar reference and the README sidebar summary describe the Completed group's dual membership, the new icon tint, and the new menu item.

## Assumptions

- The distinct implemented tint uses a yellow theme color (`charts.yellow`), reading as "done, awaiting confirmation" against both the green completed and blue in-progress tints.
- The existing Mark-as-Completed command handler already accepts any non-completed status and no-ops on already-completed specs, so only the menu `when`-clause needs to admit the `implemented` context value — no handler change is required.
- The viewer footer's completion affordance is already correct and is out of scope.

## Approach

- `package.json` (`contributes.menus`): broaden the `speckit.markCompleted` menu `when` from `spec-active || spec-tasks-done` to also match `spec-implemented`.
- `src/features/specs/specExplorerProvider.ts` (icon branch in the `SpecItem` constructor): add a dedicated `implemented` branch before the generic `currentStep` (blue) fall-through, giving it `beaker` + `charts.yellow`.
- `src/features/specs/__tests__/specExplorerProvider.test.ts`: add a case asserting an `implemented` spec gets the yellow-tinted beaker (distinct from green/blue) and that `lifecycleContextValue('implemented')` is `spec-implemented` (markCompleted-eligible alongside active/tasks-done).
- Docs: `docs/sidebar.md` (spec groups, icon legend, context-menu section) + README "Sidebar at a Glance" + root `CHANGELOG.md` `[Unreleased]`.
