# Implementation Plan: Turbo Workflow Picker

## Summary

Add a beta-gated, install-gated **"SpecKit Companion (Turbo)"** entry to the Create-New-Spec workflow dropdown. The extension computes the entry when the new `speckit.companion.turboWorkflowPicker` toggle is on AND the Companion preset is installed on disk, ships it in the `init` message as a synthetic workflow with a reserved name and a `beta` flag, and on submit recognizes that reserved name to (a) route specify to the turbo twin and (b) pin `profile: "turbo"` into the new spec's seed write — overriding the project default. Everything downstream (plan/tasks/implement routing) is already carried by `profileDispatch`.

## Technical Context

- **Language/version**: TypeScript (extension `src/`, compiled with `tsc`; webview bundled with webpack).
- **Primary dependencies**: VS Code extension API, `js-yaml` (already used by the reconciler). No new deps.
- **Testing**: Jest (`npm test`). New unit tests for the gating predicate and the seed-pin preamble.
- **Target platform**: VS Code extension (.vsix). Runtime code is confined to `src/`, `webview/`, `package.json`.
- **Hard constraints**: No runtime imports from `.claude/**` or `.specify/**`. Install detection reuses `companionPresetReconciler`'s on-disk signal (no marketplace lookup). Do not bump the version.

## Approach & Structure

Order of attack (dependencies first):

1. **`package.json`** — add `speckit.companion.turboWorkflowPicker` to the "Beta Features" group, modeled on `speckit.viewer.activityPanel` (`off|beta|on`, default `beta`, enumDescriptions, beta-aware description). Add the key to `ConfigKeys` in `src/core/constants.ts`.

2. **`src/features/settings/companionPresetReconciler.ts`** — export a small reusable predicate `isCompanionInstalled(workspaceRoot)` that returns true when the bundled Companion install is present on disk. Reuse the existing `isPresetInstalled`/`ALL_PRESET_IDS` (`companion-standard`/`companion-turbo`) signal plus the `.specify/extensions/companion/` directory check, so the gate matches the rest of the extension. (Keep existing exports intact.)

3. **`src/features/spec-editor/types.ts`** — add optional `beta?: boolean` to the src-side `WorkflowDefinition`. Add a reserved constant for the turbo entry's name (e.g. `TURBO_WORKFLOW_NAME = 'speckit-turbo'`).

4. **`src/ai-providers/promptBuilder.ts`** — extend `buildSpecifyCreationPreamble(workflowName, specDir, profile?)` and `renderSpecifyCreationLifecyclePreamble(...)` so that when `profile === 'turbo'` the seed-write JSON includes a `"profile": "turbo"` line. Default (no profile passed) leaves the seed JSON unchanged → preserves today's behavior.

5. **`src/features/spec-editor/specEditorProvider.ts`** —
   - In `getWorkflows()` (or a dedicated helper invoked from `handleReady`): after building the normal list, when `turboWorkflowPicker` resolves to `beta|on` AND `isCompanionInstalled(workspaceRoot)`, push the synthetic turbo `WorkflowDefinition` (`name: TURBO_WORKFLOW_NAME`, `displayName: 'SpecKit Companion (Turbo)'` + `' (beta)'` suffix when mode is `beta`, `stepSpecify` = turbo twin, `beta: true`). Cache it in `this.workflows` like the others so submit can look it up.
   - In `handleSubmit(...)`: when `workflowName === TURBO_WORKFLOW_NAME` and no custom command, set the specify command to the turbo twin unconditionally (bypass `resolveNewSpecProfileCommand`), and pass `profile: 'turbo'` into `buildSpecifyCreationPreamble`. For every other workflow, behavior is unchanged (default SpecKit still uses `resolveNewSpecProfileCommand`; no profile passed).

6. **`webview/src/spec-editor/index.ts` + `webview/src/spec-editor/types.ts`** — add optional `beta?: boolean` to the webview `WorkflowDefinition`; the option label already comes from `displayName`. (The `(beta)` suffix is baked into `displayName` extension-side, so the webview needs no rendering change beyond accepting the field. The `length <= 1` guard already shows the selector once a second entry exists.)

7. **`docs/template-profiles.md` (+ README mention if present)** — document the per-spec turbo choice at creation: where it appears (Create New Spec → Workflow dropdown), that it is beta-gated (`turboWorkflowPicker`) and install-gated (Companion preset present), and how it relates to the `templateProfile` project default (picker overrides the default seed for that one spec).

8. **Tests** — `companionPresetReconciler.test.ts`: cover `isCompanionInstalled` true/false. `promptBuilder.test.ts` (or new): the seed JSON includes `profile: turbo` only when passed. A spec-editor-level test for the three gating states if the provider is unit-testable; otherwise assert the gating helper in isolation.

## Out of Scope

- No changes to `profileDispatch.ts` routing (plan/tasks/implement already honor a `turbo` pin).
- No new config surface beyond the single beta toggle (the option is selection-only).
- No persisted `customWorkflows` entry for turbo (synthetic, computed per panel open).
- No change to the project-default `templateProfile` setting or its reconciliation.
- No marketplace/`vscode.extensions.getExtension` based install detection.
