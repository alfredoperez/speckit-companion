# Resume button: beta-gate it, and respect the command family the spec ran

## Overview

The sidebar resume (▶) button ships on for everyone and always dispatches the stock `/speckit.*` command for the next step, even on specs that ran the turbo `/speckit.companion.*` flow. This change hides resume behind an opt-in beta toggle (matching the complexity fast-path model) and makes it dispatch the same command family the spec has been using. It also tightens the verbose titles and descriptions of the existing Beta Features settings so they read cleanly in the VS Code settings UI.

## Functional Requirements

- **FR-001**: The system MUST add a boolean setting (e.g. `speckit.companion.resumeBeta`) under the **Beta Features** settings group, defaulting to `false` (opt-in).
- **FR-002**: The sidebar resume (▶) inline action and its context-menu entry MUST be hidden when the resume beta setting is `false`, and MUST appear once the setting is `true` — gated the same way other settings-driven menu items are (a context key the menu `when` clause reads), with the existing eligibility conditions (active / tasks-done specs) still applied.
- **FR-003**: Toggling the resume beta setting MUST update the button's visibility without requiring a window reload — the extension reacts to the configuration change and refreshes the gating context key.
- **FR-004**: When resume dispatches the next step, the command family MUST match the family the spec has been running: a spec on the turbo/companion flow resolves to `/speckit.companion.<step>`, and a spec on the stock flow resolves to `/speckit.<step>`.
- **FR-005**: The family decision MUST derive from the spec's recorded flow — the per-spec `profile` pin in `.spec-context.json` (`turbo` → companion family, `standard`/absent → stock family) — not from a hard-coded stock-only map.
- **FR-006**: Family-aware resolution MUST cover every dispatchable step resume can reach (plan, tasks, implement, and the finish-current-step and clarify/analyze fall-through cases), so the command shown in the terminal matches the spec's flow at every step.
- **FR-007**: A spec that has only ever used the stock flow MUST continue to dispatch the stock command (no regression).
- **FR-008**: The titles and descriptions of all Beta Features settings (Activity panel, template profile, complexity fast-path, and the new resume beta) MUST be rewritten to be concise and readable — lead with the observable effect, drop redundant internal detail — while preserving each setting's meaning and the "(opt-in beta)" / default signal.
- **FR-009**: The new resume beta setting and the resume button's beta-gated behavior MUST be documented in the README beta-features section, and the command-family behavior MUST be reflected in the spec-kit extension's README/CHANGELOG (the `status-context.py` change) and the root CHANGELOG (the gate/setting), each under its own extension's docs.

## Success Criteria

- **SC-001**: With the resume beta setting off (default), the resume (▶) button does not appear on any spec's inline actions or right-click menu; with it on, the button appears on eligible specs — verifiable in 100% of toggle cases.
- **SC-002**: Toggling the setting changes button visibility with zero window reloads.
- **SC-003**: For a spec whose `profile` is `turbo`, resuming dispatches a `/speckit.companion.<step>` command for every step that resume can advance (plan, tasks, implement); for a spec whose profile is `standard`/absent, resuming dispatches the matching `/speckit.<step>` command — 0 cross-family mismatches across the step set.
- **SC-004**: Each of the 4 Beta Features setting descriptions is at most ~2 lines in the settings UI and names the effect before the mechanism, with no loss of the meaning a user needs to decide whether to enable it.
- **SC-005**: Existing stock-flow specs show no change in the command resume dispatches (regression-free).

## Assumptions

- The source of truth for a spec's flow is the `profile` field already written into `.spec-context.json` (`standard` / `turbo`); when the field is absent, the spec is treated as stock (`standard`). History-based inference is not needed given this pin exists.
- The resume beta gate is a VS Code-extension concern (setting + menu `when` + context key); it does not need mirroring into `.specify/companion.yml`, unlike `complexityFastPath`. The setting lives only in VS Code settings.
- The family-selection logic belongs in the spec-kit extension's resume resolution (`status-context.py`'s `STEP_COMMAND` / `nextCommand` path), not in the sidebar dispatch — the sidebar keeps calling `/speckit.companion.resume` and the resolver picks the per-step family.
- "Concise and readable" copy keeps the setting keys and enum values unchanged (no breaking renames); only the human-facing `title`/`description`/`enumDescriptions` strings are rewritten.
- The new setting follows the existing naming convention (`speckit.companion.*`); the exact key (`resumeBeta`) can be finalized in plan without changing behavior.
