# Move Turbo mode into the Create-Spec workflow picker (beta-gated)

## Overview

Let a developer choose **SpecKit Companion (Turbo)** mode for a single spec at the moment they create it, from the same **Workflow** dropdown in the "Create New Spec" editor. The choice is gated behind a new beta toggle and only surfaces when the Companion spec-kit extension is installed in the project. Picking it pins the `turbo` profile on the new spec so the whole pipeline runs turbo regardless of the project-default setting; not picking it preserves today's behavior. This makes per-spec turbo a one-click selection rather than a global default flip.

## Functional Requirements

- **FR-001**: The system MUST add a new beta toggle `speckit.companion.turboWorkflowPicker` (enum `off | beta | on`, default `beta`) under the "SpecKit Companion: Beta Features" group in `package.json`, mirroring the existing `speckit.viewer.activityPanel` shape (enum + per-value descriptions + beta badge semantics).
- **FR-002**: When the turbo-picker toggle resolves to `off`, the Create New Spec workflow dropdown MUST NOT include any turbo option (identical to today's dropdown contents).
- **FR-003**: When the toggle resolves to `beta` or `on` but the Companion spec-kit extension is NOT installed in the project, the dropdown MUST NOT include the turbo option.
- **FR-004**: When the toggle resolves to `beta` or `on` AND the Companion spec-kit extension IS installed in the project, the dropdown MUST offer a distinct **"SpecKit Companion (Turbo)"** choice in addition to the existing workflows.
- **FR-005**: Installed-in-project detection MUST reuse the existing on-disk signal used by `companionPresetReconciler` (the bundled Companion preset / `.specify/extensions/companion/` install), not a VS Code marketplace lookup, so it matches the rest of the extension's gating.
- **FR-006**: When the toggle resolves to `beta`, the turbo option MUST be labeled as beta in a way consistent with the extension's other beta features (e.g. a "(beta)" suffix on its display label); when `on`, the beta label MUST be dropped.
- **FR-007**: Choosing the turbo option at creation MUST pin `profile: "turbo"` on the new spec's `.spec-context.json` (via the seed write), overriding the project-default seed, so every subsequent pipeline step (specify/plan/tasks/implement) routes to its turbo twin through the existing `profileDispatch` routing.
- **FR-008**: Choosing the turbo option MUST route the first (specify) dispatch to the turbo specify twin (`speckit.companion.specify`) regardless of `speckit.companion.templateProfile`, so the created `spec.md` already has the turbo shape.
- **FR-009**: Submitting WITHOUT choosing the turbo option MUST preserve today's behavior exactly: specify routing and the seeded profile follow the project default (`resolveNewSpecProfileCommand` / `seedProfileForNewSpec`).
- **FR-010**: The turbo option MUST be a pure selection affordance — it carries no additional configuration UI; selecting it only changes which command family the new spec is created under.
- **FR-011**: Existing custom workflows and the default SpecKit workflow MUST continue to function unchanged whether or not the turbo option is present (no reordering, renaming, or filtering of existing entries).
- **FR-012**: User-facing documentation MUST describe the new per-spec turbo choice at creation — that it is beta-gated and install-gated — alongside the existing `speckit.companion.templateProfile` project-default setting.
- **FR-013**: The turbo option's selected value MUST flow from the webview to the extension on submit using the existing `workflow` message field (no new message type required for the common path), and the extension MUST recognize it as the turbo selection.

## Success Criteria

- **SC-001**: With the toggle off, the rendered workflow dropdown option set is byte-identical to the pre-change option set for the same project (zero turbo entries).
- **SC-002**: With the toggle on and no Companion install present, the dropdown contains zero turbo entries; with a Companion install present, it contains exactly one turbo entry.
- **SC-003**: A spec created via the turbo option has `profile: "turbo"` in its `.spec-context.json`, and all four pipeline steps resolve to their `speckit.companion.*` twins, even when `templateProfile` is `standard` or `off`.
- **SC-004**: A spec created without the turbo option has the same pinned profile and specify routing it would have had before this change, for each of the three `templateProfile` values.
- **SC-005**: `npm run compile` and `npm test` both pass with new unit coverage for the gating decision (off / on-no-install / on-install) and the turbo-pin seed.
- **SC-006**: No `src/` module gains a runtime import from `.claude/**` or `.specify/**`.

## Assumptions

- "Companion spec-kit extension installed in the project" is detected via the same on-disk Companion preset signal `companionPresetReconciler` already uses (`isPresetInstalled` / bundled `.specify/extensions/companion/` presence); a small reusable predicate is added for it.
- The turbo dropdown entry is modeled as a synthetic workflow entry with a reserved name (e.g. `speckit-turbo`) rather than a real `customWorkflows` config entry, so it never persists to user settings and is computed fresh per panel open.
- The toggle defaults to `beta` (visible with a badge) to match `activityPanel`, the closest precedent; install-gating still hides it when no Companion install is present, so the default is safe.
- Pinning is carried by adding an optional `profile` line to the spec-editor seed-write preamble (`buildSpecifyCreationPreamble`), reusing the existing seed path rather than introducing a new write channel; the extension does not know the spec dir at submit time, so the AI's seed write is the pin point.
- Documentation lives in the repo's user-facing docs/README section that already documents `templateProfile`; if no such section exists, the setting's `description` text plus a short docs note suffices.
