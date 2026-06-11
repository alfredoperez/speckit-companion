# Spec-viewer: status-driven in-flight indicator, banner placement, sub-nav dot

## Overview

Three follow-ups to the in-flight sync glyph (#229) in the spec-viewer. The in-flight spinner must stop the moment a step's transition status settles even when the self-close history entry is missing; the viewer install banner must live inside the Activity panel rather than full-width above the whole viewer; and the Specification sub-nav must drop a stray trailing middot. The goal is a viewer whose progress indicators reflect the real lifecycle status and whose chrome reads clean.

## Functional Requirements

- **FR-001** The step in-flight indicator MUST be driven by the spec transition `status`, not solely by step-history `completedAt`. In-flight statuses (`specifying`, `planning`, `tasking`, `implementing`) MUST spin their corresponding step; settled statuses (`specified`, `planned`, `ready-to-implement`, `implemented`) MUST NOT spin any step.
- **FR-002** A step whose status has settled MUST stop spinning even if the self-close `complete` history entry for that step never landed (a missing `completedAt`).
- **FR-003** A genuinely-running step (its in-flight status is the active one) MUST still spin.
- **FR-004** The status-to-step mapping MUST be: `specifying`→`specify`, `planning`→`plan`, `tasking`→`tasks`, `implementing`→`implement`. Only the step matching the current in-flight status is eligible to spin from status; all other steps are not in-flight from status.
- **FR-005** The viewer install banner MUST render inside the Activity panel region, not full-width above the stepper / `#app-root`.
- **FR-006** The install banner's existing actions (`installSpecKitExtension`, `openReadme`) MUST keep working after relocation — clicking Install or Learn more posts the same messages to the extension.
- **FR-007** The Create-Spec panel install banner MUST remain unchanged — only the viewer placement changes.
- **FR-008** The Specification sub-nav MUST NOT render a stray trailing dot/middot after the parent chip.
- **FR-009** No regression to the #229 sync glyph for a genuinely-running step, nor to the done checkmark for a completed step.

## Success Criteria

- **SC-001** Given a step whose transition status is settled (e.g. `ready-to-implement`) and whose `completedAt` is missing, the step does not show the spinner. (pass/fail)
- **SC-002** Given a step whose transition status is its in-flight value (e.g. `implementing` for the implement step), the step shows the spinner. (pass/fail)
- **SC-003** The viewer install banner DOM node renders within the Activity panel subtree, not as a sibling above `#app-root`. (pass/fail)
- **SC-004** Clicking the relocated banner's two buttons still dispatches `installSpecKitExtension` and `openReadme`. (pass/fail)
- **SC-005** The parent sub-nav chip renders no `::after` middot content. (pass/fail)
- **SC-006** Existing spec-viewer unit tests pass, and a new/extended test asserts a settled status does not spin even with a missing `completedAt`. (pass/fail)

## Assumptions

- The spec-level `status` already reaches the webview via `ViewerState.status` (`stateDerivation.ts` sets `status: ctx.status`); no new plumbing from the extension is required for the in-flight derivation.
- The install banner visibility decision (`shouldShowInstallPrompt`) stays server-side; only the render location and the click-wiring surface change. The banner markup (id `install-banner`, `data-action` buttons) stays identical so the action contract is unchanged.
- Relocating the banner into the Preact Activity panel means the click listener must survive a late Preact mount; delegating from `document` (rather than binding to the element at load time) is the chosen mechanism.
- The middot is purely decorative (`::after` pseudo-element, `pointer-events: none`); removing it has no behavioral effect.
