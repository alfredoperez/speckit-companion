# Workflow Picker — One Choice: SpecKit or SpecKit Companion

## Overview

The extension today scatters its spec-driven behavior across several overlapping toggles — a template profile, a turbo workflow picker, and a complexity fast-path beta flag — which is confusing and redundant now that the Companion pipeline ships as a single first-class workflow. This change collapses all of that into **one decision the user makes once**: run the stock SpecKit workflow or the SpecKit Companion workflow. That single choice appears in settings and in the Create-Spec picker, dispatches the matching workflow for the whole run, and is visualized in the viewer through to its completed terminal state. It also lets the Companion workflow (shipped in #292) be selected and exercised end-to-end from the GUI.

## Functional Requirements

- **FR-001** — The extension MUST expose `speckit.defaultWorkflow` as a single enumerated choice with exactly two allowed values: stock SpecKit and SpecKit Companion.
- **FR-002** — The Create-Spec picker MUST offer exactly those two workflows and no others, pre-selecting the one configured in `speckit.defaultWorkflow`.
- **FR-003** — Choosing a workflow MUST dispatch that workflow's command family for every pipeline step of the run (specify → … → mark-complete for Companion; the stock step commands for SpecKit).
- **FR-004** — The three legacy settings — `speckit.companion.templateProfile`, `speckit.companion.turboWorkflowPicker`, and `speckit.companion.complexityFastPath` — MUST be removed from the configuration contribution and from any per-spec controls that surfaced them.
- **FR-005** — Extension activation MUST succeed without error when a user's existing settings still contain persisted values for any of the three removed keys; stale values are ignored or migrated, never read as a crash-inducing missing path.
- **FR-006** — The lean output shape previously selected via the "turbo" profile MUST be produced by the Companion workflow itself, with no separate profile setting required to obtain it.
- **FR-007** — Right-sizing a small versus oversized change (the former fast-path behavior) MUST be governed by the Companion workflow's routing step, not by any user-facing setting.
- **FR-008** — The spec viewer MUST visualize a Companion workflow run, including its terminal mark-complete step reaching the completed state.
- **FR-009** — The preset reconciler and any other extension code MUST contain no live references to the three removed setting keys.
- **FR-010** — README and the settings/configuration documentation MUST describe the single two-value picker and MUST NOT document the three removed settings.

## Success Criteria

- **SC-001** — The settings UI and the Create-Spec picker each present exactly two workflow choices.
- **SC-002** — Activating the extension with all three removed keys present in a user's settings produces zero activation errors across 100% of attempts.
- **SC-003** — Selecting SpecKit Companion in Create-Spec runs the full pipeline end-to-end from the GUI, and the viewer shows the run reaching its completed terminal state.
- **SC-004** — Zero references to the three removed setting keys remain in shipped extension code or in user-facing docs.
- **SC-005** — Selecting either workflow dispatches the correct command family for 100% of pipeline steps in a run (no cross-workflow command leakage).

## Assumptions

- The Companion workflow definition from W1·1 (#292) is present and runnable; this change is the GUI wiring and the deletion of the legacy toggles, not new pipeline logic.
- `speckit.defaultWorkflow` keeps its current default of stock SpecKit, so existing users see no behavior change until they opt into Companion.
- "Migrate" means the removed keys are silently ignored (and dropped if convenient) rather than having their old semantics preserved — fast-path and lean-shape behavior now live inside the Companion workflow, so there is nothing to carry forward.
- The two workflow identities map to the existing `speckit` value and a `companion` value for `speckit.defaultWorkflow`; the picker shows human-readable labels for each.
- Visualization reuses the existing viewer lifecycle/history machinery; the terminal mark-complete step is already emitted by the Companion workflow and only needs to render.
