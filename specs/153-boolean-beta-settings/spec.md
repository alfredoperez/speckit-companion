# Specification: Collapse Beta Tri-State Settings to Boolean On/Off

## Overview

Three beta-gated settings (`speckit.viewer.activityPanel`, `speckit.companion.turboWorkflowPicker`, `speckit.companion.installPrompt`) are currently tri-state (`off`/`beta`/`on`), where `beta` and `on` produce identical behavior and differ only by whether a redundant in-UI "beta" badge renders. This change collapses the three settings to plain boolean on/off, removes the redundant in-UI beta badges, and migrates existing persisted string values so no user's effective on/off state flips.

## Functional Requirements

- **FR-001**: The settings `speckit.viewer.activityPanel`, `speckit.companion.turboWorkflowPicker`, and `speckit.companion.installPrompt` MUST be declared as `boolean` in `package.json`, with no tri-state `enum`/`enumDescriptions` remaining.
- **FR-002**: Default values MUST be `true` for all three settings (preserving today's effective defaults: `activityPanel` and `turboWorkflowPicker` defaulted to `beta` = shown; `installPrompt` defaulted to `on` = shown).
- **FR-003**: Each setting's `description` MUST retain the "opt-in beta" wording so users see the feature is experimental before enabling it.
- **FR-004**: The in-UI "(beta)" suffix on the "SpecKit Companion (Turbo)" workflow option MUST be removed.
- **FR-005**: The in-UI "beta" badge span on the viewer's Activity toggle MUST be removed (the markup and its dedicated CSS rule).
- **FR-006**: Every reader of the three settings MUST read a boolean. No reader may compare against `'off'`, `'beta'`, or `'on'` string literals as the live setting type.
- **FR-007**: A migration MUST run once at extension activation that rewrites any persisted legacy string value of the three settings: `'beta'` and `'on'` map to `true`, `'off'` maps to `false`. The migration MUST preserve the configuration scope (global/workspace/folder) at which the legacy value was set, and MUST NOT write a value where none was set.
- **FR-008**: Readers MUST defensively tolerate BOTH a legacy string AND a boolean during the in-flight transition (before migration completes or for an un-migrated scope), coercing a legacy string with the same mapping as FR-007.
- **FR-009**: No behavior MUST change beyond badge removal and the on/off simplification — a feature that was effectively shown stays shown, a feature that was off stays off.

## Success Criteria

- **SC-001**: A fresh install with no overrides shows the Activity toggle, offers the Turbo workflow option, and shows the install banner (when the extension is missing) — none with a "beta" badge.
- **SC-002**: A user with a persisted `"speckit.viewer.activityPanel": "beta"` (or `"on"`) ends up with the feature shown; a persisted `"off"` ends up hidden — identical effective state to before the change.
- **SC-003**: No "(beta)" suffix or "beta" badge renders for any of the three features in any setting state.
- **SC-004**: `npm run compile` and `npm test` pass; a unit test feeds legacy `"beta"`, `"on"`, and `"off"` strings through the coercion/migration and asserts the boolean outcome (`true`, `true`, `false`).
- **SC-005**: No tri-state `enum` for these three keys remains anywhere in `package.json` or in the TypeScript reader signatures.

## Assumptions

- The `beta` field on the synthetic turbo `WorkflowDefinition` is set but never read for rendering (the "(beta)" label suffix is the only badge); it can be dropped or left inert without behavior change. Removing it is preferred to avoid a dead field.
- The migration is best-effort and idempotent: re-running it on already-boolean values is a no-op.
- `installPrompt`'s `beta` enum value was documented as "reserved for parity" with no distinct behavior, so collapsing loses nothing.
- Scope precedence (folder > workspace > global) is preserved by migrating each scope where a legacy value is explicitly set, using VS Code's `inspect()` per-scope values.
