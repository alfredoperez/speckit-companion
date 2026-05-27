# Spec: Fix Approve Wrong Step

**Slug**: 116-fix-approve-wrong-step | **Date**: 2026-05-27

## Summary

The footer Approve button labels itself from `ctx.currentStep` but dispatches
its `/speckit.*` command based on the currently-viewed stepper tab (`docType`).
When the user navigates backward to a past tab after the spec has advanced,
the label and the dispatch diverge — clicking **Implement** from the
Specification tab fires `/speckit.plan`. This fix routes the dispatch off
`ctx.currentStep` so the label and the action always agree.

## Requirements

- **R001** (MUST): When `handleApprove` runs, the dispatched next-step command
  MUST be derived from `ctx.currentStep` (the spec's actual current step), not
  from `docType` (the viewed stepper tab).
- **R002** (MUST): When `ctx.currentStep` is a lifecycle step present in
  `navSteps`, the `docType`-based related-doc / parent-step fallback MUST NOT
  run. The fallback only applies when `ctx.currentStep` is not in `navSteps`
  (e.g., the `actionOnly` `implement` step).
- **R003** (MUST): The label-derivation path (`getFooterActions` call in
  `stateDerivation.ts`) MUST remain unchanged — it is already correct.
- **R004** (MUST): A unit test in `tests/unit/spec-viewer/` MUST construct a
  context with `currentStep = "tasks"` and `docType = "specify"`, invoke the
  approve handler, and assert the dispatched command is `/speckit.implement`
  (not `/speckit.plan`).

## Scenarios

### Approve from a past stepper tab

**When** the spec is at `currentStep = "tasks"` and the user clicks the
**Specification** tab, then clicks the footer **Implement** button
**Then** `/speckit.implement` is dispatched (not `/speckit.plan` or
`/speckit.tasks`), and the SpecKit output channel logs
`Executing step "Implement": /speckit.implement …`.

### Approve from the current stepper tab (no regression)

**When** the spec is at `currentStep = "tasks"` and the user is viewing the
Tasks tab, then clicks the footer **Implement** button
**Then** `/speckit.implement` is dispatched — same as today, no change.

### Approve while viewing a related (child) doc

**When** `ctx.currentStep` is a lifecycle step in `navSteps` and the user is
viewing a related doc whose `parentStep` is some earlier step
**Then** the dispatch still routes off `ctx.currentStep`; the
`relatedDoc.parentStep` fallback path does not override it.

## Out of Scope

- Removing the `step !== ctx.currentStep` guard (B2) in `shouldShowApprove` —
  stays as defense-in-depth.
- Any change to the label-derivation path.
- Any change to `actionOnly` step semantics.
- `handleRegenerate` and other sibling handlers — only `handleApprove` is in
  scope here (audit them if the same shape recurs, but no edits unless found).
