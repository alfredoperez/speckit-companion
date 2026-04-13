# Spec: Viewer State Derivation Wiring

**Slug**: 063-viewer-state-derivation-wiring | **Date**: 2026-04-13

## Summary

Finish the rendering half of spec 060 by wiring the existing pure
`deriveViewerState` / `getFooterActions` modules into the spec-viewer
webview. The Preact components currently compute visibility and badge
state from a legacy `navState` fanout; migrate them to consume a single
`ViewerState` payload sent over the `contentUpdated` message so US4–US6
actually render.

## Requirements

- **R001** (MUST): Extension serializes `ViewerState` into the
  `contentUpdated` message alongside the existing `navState` fields.
  `footer` is sent as an array of `{ id, label, scope, tooltip }`; the
  `visibleWhen` function is not serialized.
- **R002** (MUST): `specViewerProvider.sendContentUpdateMessage` calls
  `deriveViewerState(ctx, activeStep)` and attaches the result under
  `viewerState` on the outgoing message.
- **R003** (MUST): `webview/src/types.ts` exports a `ViewerState` type
  matching `src/core/types/specContext::ViewerState`.
- **R004** (MUST): `FooterActions.tsx` iterates `viewerState.footer` to
  render buttons. Button `id` is sent back to the extension; the
  tooltip includes the scope suffix.
- **R005** (MUST): `messageHandlers.ts` dispatches footer clicks by the
  button `id` to the existing handlers (no new command surface).
- **R006** (MUST): Stepper renders `.step-tab.pulse` only when
  `viewerState.pulse === step`. `.step-tab.completed` is applied iff
  `viewerState.highlights.includes(step)`.
- **R007** (MUST): When `viewerState.activeSubstep.step === step`, the
  step tab renders a secondary label line with `activeSubstep.name`.
- **R008** (MUST): `SpecHeader.tsx` reads `viewerState.status` for the
  badge and removes the per-tab recomputation.
- **R009** (MUST): Legacy classes `.step-tab.in-progress` and
  `.step-tab.working` are removed from both the stepper renderer and
  CSS.
- **R010** (SHOULD): Unit coverage for `FooterActions` verifies
  rendered button count and scope-suffixed tooltips match the supplied
  `viewerState.footer`.
- **R011** (SHOULD): Preserve existing stepper layout, colors, fonts,
  and spacing — no visual redesign.

## Scenarios

### Completed spec opens

**When** a user opens a spec whose `.spec-context.json` has
`status: "completed"`
**Then** no step tab has `.pulse`, all completed steps have
`.completed`, and the header badge reads "Completed".

### Mid-plan spec, tab switching

**When** a spec is mid-plan (`stepHistory.plan.startedAt` set,
`completedAt` unset) and the user clicks between step tabs
**Then** the pulse stays on the Plan tab regardless of which tab is
active.

### Active substep label

**When** a running Companion step writes a substep into
`.spec-context.json` and the viewer receives the update
**Then** the matching step tab shows a small secondary line with the
substep name (e.g. "validating checklist").

### Footer scope suffix

**When** the user hovers each footer button on any step
**Then** the tooltip includes a scope suffix derived from
`viewerState.footer[i].scope`.

### Auto button visibility

**When** an `sdd`-workflow draft spec is viewed on the Specify step
**Then** the Auto footer button renders; switching to the Plan step
hides it, driven entirely by `viewerState.footer`.

## Non-Functional Requirements

- **NFR001** (SHOULD): No new network or filesystem reads in the
  webview — `ViewerState` is pushed from the extension.
- **NFR002** (SHOULD): CSS pulse/highlight animations consolidated to
  a single class per concept (`.pulse`, `.completed`).

## Out of Scope

- Adding new stepper steps or rearranging layout.
- Visual redesign (colors, typography, spacing).
- Backwards compatibility with older webview bundles — webview and
  extension ship together in the same `.vsix`.
- Changes to the pure derivation modules (already covered by spec 060).
