# Data Model: One Beta Gate for the SpecKit Companion Workflow

**Spec**: [spec.md](./spec.md) · **Date**: 2026-06-14

No persistent data structures change. The "entities" here are **VS Code configuration settings** and **derived runtime gates**. This document records their shapes, transitions, and validation.

## Settings (persisted in `settings.json`, any scope)

### Companion workflow beta setting — `speckit.companion.workflowBeta` (NEW)

| Field | Value |
|-------|-------|
| Type | `boolean` |
| Default | `false` |
| Scope | `window` |
| Group | Beta Features |
| Label | "Enable SpecKit Companion workflow (beta)" |

**Description (FR-002)**: adds the SpecKit / SpecKit Companion picker to Create Spec (when the companion piece is installed) and enables Continue/Resume.

**Validation**: VS Code enforces boolean. Readers also pass the live value through `coerceLegacyBoolean(value, false)` so an un-migrated or unexpected stored value resolves to `false` rather than throwing.

### Legacy resume setting — `speckit.companion.resumeBeta` (REMOVED)

| Field | Value |
|-------|-------|
| Status | Removed from `contributes.configuration` |
| Migration source | Yes — value carried into `workflowBeta` |
| Cleanup | Deleted from `settings.json` at every scope on activation |

Historical values to handle: `true` (current boolean), `"on"` / `"beta"` (legacy strings — both mean on), `false` / `"off"` / unset (off), any other value (treated as off, must not crash).

### Default workflow preference — `speckit.defaultWorkflow` (UNCHANGED)

Existing enum `speckit | companion`, default `speckit`. **Only its visibility changes**: it is consumed as the picker's preselected choice and is relevant solely when the picker is shown (FR-007). No schema change.

## Derived runtime gates (not persisted)

### `pickerShown` (computed per Create-Spec open)

```
pickerShown = workflowBeta(on) AND companionInstalled(root)
```

Realized as: `COMPANION_WORKFLOW` is added to the selection list returned by `getWorkflows()` only when both hold; the webview shows the picker when that list has more than one entry. (Custom workflows independently can also make the list > 1 — out of scope.)

### `resumeEnabled` (context key `speckit.resumeBeta`)

```
resumeEnabled = workflowBeta(on)
```

Drives the sidebar resume `▶` menu `when` clause. Sourced from the new setting; companion-command dispatch still degrades safely when the extension is absent (existing `resolveDispatchForRoot` fallback).

### `companionInstalled` (context key `speckit.companion.installed`)

Unchanged — on-disk presence of `.specify/extensions/companion/`. Combined with `workflowBeta` to compute `pickerShown`.

## State transitions

| From | Event | To | Observable effect |
|------|-------|----|----|
| beta off, installed | user turns beta on | beta on, installed | picker appears, resume available (US1 §1) |
| beta on, installed | user turns beta off | beta off | picker gone, resume gone, stock only (US1 §2) |
| beta on, not installed | open Create Spec | — | no picker, stock specs, install prompt still reachable (US2) |
| old `resumeBeta` on | upgrade activation | `workflowBeta` on, old key deleted | prior opt-in preserved (US3 §1) |
| any old `resumeBeta` value | upgrade activation | activation succeeds | no crash for any stored value (US3 §2, FR-005) |
| old `resumeBeta` off/unset | upgrade activation | `workflowBeta` off | stock behavior (US3 §3) |

## Migration validation rules

- Per-scope (`Global` / `Workspace` / `WorkspaceFolder`) via `inspect()` — a global vs. workspace opt-in is preserved at its own scope, not relocated.
- Copy is conditional: only write `workflowBeta` at a scope where the old value coerces to `true` AND `workflowBeta` isn't already explicitly set there → idempotent, re-run safe.
- Old key deleted at every scope where it was set (`update(key, undefined, scope)`).
- Whole operation wrapped in try/catch that logs and continues — activation never fails on migration (FR-005).
