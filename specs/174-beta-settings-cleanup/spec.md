# Beta Settings Cleanup

## Overview

The Beta Features section of the extension's settings is hard to read: the Companion enable toggle shows up as the cryptic "Workflow Beta", the install-prompt setting acts on its own even though it only makes sense alongside the Companion workflow, and several descriptions run for paragraphs. This change gives the toggle a clear name, ties the install prompt to the Companion workflow, and trims every Beta setting description to one scannable line — without breaking any existing opt-in.

## Functional Requirements

- **FR-001** The Companion-enable setting MUST read as "SpecKit Companion Workflow" in the VS Code Settings UI (instead of the key-derived "Workflow Beta").
- **FR-002** If the setting KEY is renamed to achieve FR-001, a current opt-in (the old `speckit.companion.workflowBeta` value, including any value already carried over from the earlier `resumeBeta` migration) MUST be migrated to the new key at the same configuration scope, so an existing user stays opted in.
- **FR-003** Every reader of the Companion-enable setting MUST resolve the effective value correctly whether the persisted value lives under the old key or the new key, and activation MUST NOT throw for any persisted legacy value.
- **FR-004** The install prompt (`speckit.companion.installPrompt`) MUST only apply / be offered when the SpecKit Companion Workflow is enabled. When the workflow is off, no install prompt is shown regardless of the install-prompt setting's own value.
- **FR-005** Every `speckit.*` Beta-section setting description MUST be a single short, scannable line. The `speckit.telemetry` "collected / never collected" detail MUST move out of the setting description into the README, with the setting linking to it.
- **FR-006** The README Configuration section MUST match the final setting labels, descriptions, and the install-prompt-follows-workflow behavior.
- **FR-007** Telemetry that reports the beta-flag states MUST continue to report the Companion-enable flag and the install-prompt flag accurately after any key rename (no dropped or mislabeled flag).

## Success Criteria

- **SC-001** Opening VS Code Settings and searching for the Companion enable toggle shows a label containing "SpecKit Companion Workflow".
- **SC-002** A user who had the old enable setting on remains on after upgrade (effective value true), with zero activation errors logged.
- **SC-003** With the Companion workflow off, the install prompt never appears in the Create-Spec / Activity panels; turning the workflow on restores the prompt (when the extension is missing).
- **SC-004** Every Beta-section setting description fits on one line; telemetry's full detail is reachable from the README.
- **SC-005** `npm run compile` and `npm test` both pass.

## Assumptions

- Achieving FR-001 requires renaming the key, because VS Code derives the Settings label from the key path and `package.json` config offers no separate label override. The new key segment is chosen so its title-cased form reads "SpecKit Companion Workflow".
- The existing migration/coercion infrastructure (`coerceLegacyBoolean`, the per-scope `inspect()`/`update()` pattern in `settingsMigration.ts`) is the model for the new migration; the new migration runs once at activation inside the existing try/catch so it can never break activation.
- The install-prompt gating is applied at the existing install-prompt call site (`specKitExtensionInstall.ts`) by reading the Companion-enable value through the shared coercion helper.

## Approach

- **package.json** — rename the enable key from `speckit.companion.workflowBeta` to a segment whose title-case reads "SpecKit Companion Workflow" (`speckit.companion.speckitCompanionWorkflow`). Trim the descriptions of the enable toggle, `installPrompt`, `viewer.activityPanel`, `telemetry`, and `defaultWorkflow` to one line each; move telemetry's collected/never-collected list to the README and link it.
- **src/core/settingsMigration.ts** — add a one-time, idempotent `migrateWorkflowBetaKey()` that copies the old `companion.workflowBeta` value to the new key per scope (when the new key isn't already set) then deletes the old key, following the `migrateResumeBetaToWorkflowBeta` pattern. Update `BETA_BOOLEAN_SETTINGS` if needed.
- **src/extension.ts** — call the new migration in `activate()` inside the existing try/catch, ordered after `migrateResumeBetaToWorkflowBeta` so a resume→workflowBeta→new-key chain carries through. Update the two `get('companion.workflowBeta')` reads to the new key.
- **src/core/constants.ts** — update the constant pointing at the enable key.
- **src/features/workflows/workflowManager.ts** + **src/features/spec-editor/specEditorProvider.ts** — update reads to the new key.
- **src/core/telemetry.ts** — read the renamed key for the workflow-enable flag.
- **src/speckit/specKitExtensionInstall.ts** — gate the install prompt behind the Companion-enable value (FR-004).
- **README.md** — update the Configuration / Beta section to match labels, one-line descriptions, the telemetry detail block, and the install-prompt-follows-workflow rule.
- Add/extend unit tests for the new key migration (carry-over + activation safety).
