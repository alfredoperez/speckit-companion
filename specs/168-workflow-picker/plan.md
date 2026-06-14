# Plan — Workflow Picker: One Choice, SpecKit or SpecKit Companion

## Summary

Collapse the three overlapping spec-driven toggles (`templateProfile`, `turboWorkflowPicker`, `complexityFastPath`) into a single two-value choice on `speckit.defaultWorkflow`: stock **SpecKit** or **SpecKit Companion**. The technical approach is to make `companion` a *first-class built-in workflow* in `workflowManager` whose steps map to the `/speckit.companion.*` command family (with the terminal `mark-complete`). Once Companion is a real workflow, the existing workflow-step dispatch machinery carries it end-to-end, so the per-spec "turbo profile" routing (`profileDispatch.ts`) and the synthetic turbo picker entry are deleted rather than rewired. The legacy settings, their config-change watchers, their `.specify/companion.yml` mirrors, and their telemetry dimensions are removed; activation tolerates their stale persisted values.

## Technical Context

- **Language/Runtime**: TypeScript 5.3+ (ES2022, strict), VS Code Extension API `^1.84.0`, Webpack 5; Preact-free vanilla webview for the spec editor.
- **Storage**: `.spec-context.json` per spec (records `workflow`); `.specify/companion.yml` (project mirror — the `templateProfile`/`complexityFastPath` keys it carried are being retired).
- **Testing**: Jest (`ts-jest`, `tsconfig.test.json`), VS Code mock at `tests/__mocks__/vscode.ts`. Relevant existing suites: `settingsMigration.test.ts`, `companionPresetReconciler.test.ts`, `telemetry.test.ts`.
- **Target**: VS Code extension (the GUI side). The Companion *workflow definition* itself already ships from #292 on the spec-kit engine — this change is GUI wiring + toggle deletion, not new pipeline logic.
- **Constraints**: Activation MUST NOT crash on stale persisted keys (FR-005). No live references to the three removed keys may remain in shipped code (FR-009). The `companion` step commands only resolve when the spec-kit companion extension is installed — preserve the missing-extension fallback so a Companion pick downgrades to stock rather than dispatching an unresolvable `/speckit.companion.*`.

## Key Decision

**Companion becomes a built-in workflow, not a profile pin.** Today "turbo" is a *per-spec profile* swapped in at dispatch time by `profileDispatch.ts`, surfaced through a *synthetic* picker entry (`buildTurboWorkflowEntry`) that seeds `workflow: speckit` + `profile: turbo`. The cleaner model the spec asks for is two real workflows. So we add a `COMPANION_WORKFLOW` constant alongside `DEFAULT_WORKFLOW`, let the spec record `workflow: companion`, and let `resolveStepCommand`/the workflow step list dispatch `/speckit.companion.*` for every step. This deletes the profile axis entirely (no `profile` field seeding, no turbo-twin map, no `seedProfileForNewSpec`). The single remaining behavior to preserve from `profileDispatch` is the **missing-extension fallback** (`fellBack`): fold it into the workflow dispatch path so a Companion step whose extension is absent downgrades to its stock twin and warns.

## Approach & Structure

Order of attack — settings contribution first (drives the rest), then the workflow model, then dispatch, then cleanup, then docs.

1. **`package.json` — config contribution.** Change `speckit.defaultWorkflow` from a free-form string to `"enum": ["speckit", "companion"]` with `enumDescriptions` and human labels; keep `default: "speckit"`. Delete the three property blocks `speckit.companion.templateProfile`, `speckit.companion.turboWorkflowPicker`, `speckit.companion.complexityFastPath` from `contributes.configuration`.

2. **`src/core/constants.ts`** — remove `templateProfile`, `turboWorkflowPicker`, `complexityFastPath` from `ConfigKeys`. Add a `COMPANION_WORKFLOW_NAME = 'companion'` (or reuse existing companion constant).

3. **`src/features/workflows/workflowManager.ts`** — add `COMPANION_WORKFLOW: WorkflowConfig` mirroring `DEFAULT_WORKFLOW` but with steps/`step-*` mapped to `speckit.companion.specify|plan|tasks|implement` and a terminal `mark-complete` step. Include it in `getWorkflows()` so the built-in list is exactly `[speckit, companion]` (+ user custom workflows). Ensure `getWorkflow('companion')` resolves it.

4. **`src/features/specs/profileDispatch.ts`** — delete the profile/turbo-twin machinery (`TURBO_COMMAND_BY_STOCK`, `resolveProfileCommand`, `resolveNewSpecProfileCommand`, `seedProfileForNewSpec`). Keep a single workflow-aware dispatch resolver that, given a spec's `workflow`, returns its step command and applies the missing-extension fallback (`isCompanionInstalled` → downgrade `speckit.companion.*` to stock, `fellBack: true`). Update all callers (viewer footer, sidebar resume, command palette, spec-editor specify) to route through it.

5. **`src/features/spec-editor/specEditorProvider.ts`** — delete `buildTurboWorkflowEntry`, `TURBO_WORKFLOW_NAME`, the reserved-name guard, and the `pickedTurbo`/`seedProfile` branch in `handleSubmit`. The picker now lists the two built-in workflows from `getWorkflows()`; the selected `workflowName` is seeded verbatim into `.spec-context.json` (`companion` seeds `companion`). Apply the missing-extension fallback when the chosen workflow is `companion`.

6. **`src/extension.ts`** — remove the `onDidChangeConfiguration` watchers for `templateProfile` and `complexityFastPath` and the activation-time `writeTemplateProfile` / `resolveComplexityFastPath` mirrors. Keep the companion-family *ensure* (so `/speckit.companion.*` stays materialized) but key it off "companion workflow is selectable / extension installed," not off `templateProfile`.

7. **`src/features/settings/companionPresetReconciler.ts`** — drop `readTemplateProfile`, `writeTemplateProfile`, `writeComplexityFastPath`, `resolveComplexityFastPath`, and `shouldEnsureStandard`'s `templateProfile` dependence. The reconciler's job narrows to: ensure the companion command family is present when needed (FR-009 — zero live refs to removed keys).

8. **`src/core/telemetry.ts`** — remove the `templateProfile`/`complexityFastPath`/`turboWorkflowPicker` settings dimensions and `templateProfileTelemetryId`; replace with a single `defaultWorkflow` dimension (`'speckit' | 'companion'`). Update `telemetry.test.ts`.

9. **`src/core/settingsMigration.ts`** — remove `companion.turboWorkflowPicker` from `BETA_BOOLEAN_SETTINGS`. Add a one-time, idempotent cleanup that *removes* the three retired keys from `settings.json` at every scope (or simply leaves them — VS Code ignores unknown keys, satisfying FR-005). Removal is the cleaner path; update `settingsMigration.test.ts`.

10. **`src/ai-providers/promptBuilder.ts`** — strip the stale `templateProfile` comment/logic at line ~264; the specify preamble no longer seeds a `profile`.

11. **Viewer terminal state (FR-008)** — confirm `deriveViewerState` already renders the Companion `mark-complete` → `completed` terminal step (the spec assumes the history machinery handles it). Add coverage only if a gap surfaces; no new rendering expected.

12. **Docs (FR-010)** — README "Configuration" + Spec Context "Status vocabulary": replace the three-setting description with the single two-value picker. Update `docs/template-profiles.md` (retire the profiles model — now a workflow choice), `docs/capture-and-timing.md` (drop the `templateProfile` mirror from the capture path), `docs/sidebar.md` if it referenced the picker, and `CHANGELOG.md` (user-facing: "one workflow choice, three beta toggles removed"). Per the Feature→README map: a removed setting touches the Configuration section; a workflow-identity change touches the Custom Workflows / picker copy.

## Out of Scope

- No changes to the Companion *workflow definition* (`speckit-extension/workflows/speckit-companion.workflow.yml`) or its `classify`/routing/`mark-complete` command bodies — those shipped in #292 and the right-sizing now lives there (FR-007).
- No new pipeline logic, no new command twins — only GUI wiring and toggle removal.
- No preservation of old semantics for the removed keys (Assumption: stale values are silently ignored/dropped, not migrated to equivalent behavior).
- No spec-kit-extension version bump or its README/CHANGELOG — this is a root VS Code-extension change.

## Constitution Check

- **I. Extensibility & Configuration** — PASS. The two-value picker is still a VS Code setting; user-defined custom workflows remain alongside the two built-ins. Net reduction in redundant configuration improves clarity (a stated goal of the principle).
- **II. Spec-Driven Workflow** — PASS. The Specify→Plan→Tasks→Implement pipeline is preserved by both workflows; Companion adds the terminal `mark-complete` consistent with the managed lifecycle (transitions stay explicit user actions).
- **III. Visual & Interactive** — PASS. Viewer reuses existing lifecycle/history rendering (FR-008).
- **IV. Modular Architecture** — PASS. Change stays within the existing manager/provider seams; deletes a cross-cutting profile axis rather than adding one.

No violations to justify — Complexity-Tracking table omitted.
