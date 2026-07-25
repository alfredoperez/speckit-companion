# Research: Default workflow to Companion when installed

## Decision: Where the resolver lives

**Decision**: Add `resolveEffectiveDefaultWorkflow(root)` and its pure core `pickEffectiveDefaultWorkflow(inspected, companionInstalled)` in `src/features/workflows/workflowManager.ts`, re-exported from `src/features/workflows/index.ts`.

**Rationale**: `workflowManager.ts` is the selection-model hub and already holds `isCompanionSelectable()`, which imports `isCompanionInstalled` and `vscode`. Both workflow-pick consumers (`workflowSelector.ts`, `specEditorProvider.ts`) already import from the `../workflows` barrel, so no new dependency edge is introduced.

**Alternatives considered**: A standalone `defaultWorkflowResolver.ts` module — rejected as unnecessary surface for two small functions; the hub keeps the selection logic in one place.

## Decision: How to tell "unset" from "explicit speckit"

**Decision**: Use `config.inspect<string>('defaultWorkflow')` and read `globalValue`, `workspaceValue`, `workspaceFolderValue`. The setting is "explicit" when any of those is a non-empty string; most-specific scope wins (`workspaceFolderValue ?? workspaceValue ?? globalValue`).

**Rationale**: `config.get('defaultWorkflow', 'speckit')` returns `'speckit'` for both an unset value and an explicit `'speckit'`, so it cannot honor an explicit stock choice against the install-aware default. `inspect()` exposes the per-scope values with `undefined` meaning "not set at this scope". This is the same mechanism `settingsMigration.ts` already uses.

**Alternatives considered**: Comparing `get()` to the schema default — the exact ambiguity that causes the bug. Rejected.

## Decision: Keep telemetry on the raw value

**Decision**: `buildBetaSnapshot` continues to report `defaultWorkflowTelemetryId(config.get('defaultWorkflow', 'speckit'))` — the raw configured value, unset reported as `speckit`.

**Rationale**: The companion-adoption metric must count only deliberate opt-in. Reporting the resolved effective `companion` for every install would inflate the denominator with users who never chose companion. A one-line comment at the call site pins this intent so a future edit does not "helpfully" switch it to the effective value.

**Alternatives considered**: Report the effective value — rejected; it makes the adoption metric meaningless.

## Decision: Detector reuse

**Decision**: Reuse `isCompanionInstalled(root)` from `companionPresetReconciler.ts`. Thread the workspace root (`vscode.workspace.workspaceFolders?.[0]?.uri.fsPath`) into the resolver; when no root is available, the resolver treats companion as not-installed and returns `speckit`.

**Rationale**: The detector, its context-key mirror (`refreshCompanionInstalledContext`), and `isCompanionSelectable()` already key off the same on-disk signal; a second detection path would drift (one-fact-one-derivation).
