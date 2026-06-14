# Contract: Settings & Runtime Gates

**Spec**: [../spec.md](../spec.md) · **Date**: 2026-06-14

This extension exposes no network API. Its "contract" is the VS Code **configuration schema** it contributes and the **runtime gate functions** other modules depend on. This file pins the observable interface so tests and reviewers have a fixed target.

## Configuration contract (`package.json` → `contributes.configuration`)

### Added

```jsonc
"speckit.companion.workflowBeta": {
  "type": "boolean",
  "default": false,
  "scope": "window",
  "order": 5,
  "markdownDescription": "Enable the **SpecKit Companion** workflow (beta). Adds the SpecKit / SpecKit Companion picker to Create Spec (when the [companion spec-kit extension](https://github.com/alfredoperez/speckit-companion#install-the-spec-kit-extension) is installed) and enables the Continue/Resume button on sidebar specs. Off by default."
}
```
Group: **Beta Features**. Label rendered from the key — title "Enable SpecKit Companion workflow (beta)" (FR-001).

### Removed

```
"speckit.companion.resumeBeta"   // deleted from contributes.configuration (FR-003)
```

### Invariants

- Exactly one setting governs the Companion workflow surface (SC-001): `workflowBeta` present, `resumeBeta` absent from the schema.
- `speckit.defaultWorkflow` schema unchanged.

## Migration contract (`src/core/settingsMigration.ts`)

```ts
// NEW — copy the old opt-in into the new gate, then drop the old key.
export async function migrateResumeBetaToWorkflowBeta(): Promise<void>;
```

| Old `companion.resumeBeta` (per scope) | Result on `companion.workflowBeta` (same scope) | Old key after |
|----------------------------------------|--------------------------------------------------|---------------|
| `true` | `true` | deleted |
| `"on"` / `"beta"` | `true` | deleted |
| `false` / `"off"` | unchanged (stays default/off) | deleted |
| unset | unchanged | (nothing to delete) |
| any other value | unchanged (off) — no throw | deleted |

Behavioral guarantees:
- **Idempotent**: re-running writes nothing new and deletes nothing already gone.
- **Scope-preserving**: a value set at Global stays Global; Workspace stays Workspace.
- **Non-fatal**: invoked from `activate()` inside try/catch; any error is logged and swallowed — activation completes for every stored value (FR-005, SC-002).
- Does not overwrite a `workflowBeta` already explicitly set by the user at that scope.

## Workflow-list contract (`src/features/workflows/workflowManager.ts`)

```ts
getWorkflows(outputChannel?)   // SELECTION surface (picker/spec-editor)
getAllWorkflows()              // RESOLUTION surface (existing spec's steps)
```

| Condition | `getWorkflows()` includes Companion? | `getAllWorkflows()` includes Companion? |
|-----------|--------------------------------------|------------------------------------------|
| beta on AND installed | **yes** | yes |
| beta off | **no** | yes |
| beta on, not installed | **no** | yes |

- Picker is shown by the webview iff the selection list length > 1. With Companion gated out and no custom workflows, length is 1 → no picker (FR-006, SC-004/SC-005).
- `getAllWorkflows()` ALWAYS includes Companion so `getWorkflow('companion')` still resolves the real steps for an already-created Companion spec — regardless of beta/installed state.

## Resume gate contract (`src/extension.ts` + `src/core/constants.ts`)

- Context key `speckit.resumeBeta` is set from `speckit.companion.workflowBeta` at activation and on `onDidChangeConfiguration` (FR-008).
- `ConfigKeys.resumeBeta` constant points at `speckit.companion.workflowBeta`.
- The sidebar resume `▶` menu `when` clause (`speckit.resumeBeta`) is unchanged.

## Telemetry contract (`src/core/telemetry.ts`)

- `BetaSnapshot` field `resumeBeta` → `workflowBeta`, sourced from `companion.workflowBeta` (boolean string). Privacy contract unchanged (boolean only, no content).

## Install-prompt contract (unchanged — verified, not modified)

- When beta is on and the companion piece is not installed, the install offer (`speckit.companion.installPrompt` banner + sidebar install affordance) remains reachable (FR-009, SC-004). No change required; this contract is asserted by an acceptance check, not new code.
