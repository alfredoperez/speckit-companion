# Implementation Plan: Delete Spec from Sidebar on Hover

**Branch**: `016-delete-spec-sidebar` | **Date**: 2026-03-06 | **Spec**: `specs/016-delete-spec-sidebar/spec.md`

## Summary

The `speckit.delete` command already exists, is registered, and appears in the right-click context menu for spec items. The only change needed is to surface it **inline** (on hover) by adding a `$(trash)` icon to the command definition and a second `view/item/context` entry with `"group": "inline"`. No TypeScript changes required.

## Technical Context

**Language/Version**: TypeScript 5.3, VS Code Extension API 1.84+
**Primary Dependencies**: VS Code `package.json` contributions (menus, commands)
**Storage**: N/A
**Testing**: Manual — F5 launch, hover over spec row
**Target Platform**: VS Code sidebar tree view
**Project Type**: VS Code extension (single project)
**Performance Goals**: N/A (declarative config only)
**Constraints**: Inline button must only show for `viewItem == spec` (not sub-documents)
**Scale/Scope**: 2 lines changed in `package.json`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extensibility | ✅ Pass | No provider-specific logic |
| II. Spec-Driven Workflow | ✅ Pass | Enhances spec management UX |
| III. Visual and Interactive | ✅ Pass | Adds visible, interactive hover action |
| IV. Modular Architecture | ✅ Pass | Single-file config change; no new modules needed |

**Gate: PASS** — No violations. No Phase 0 research needed (zero unknowns).

## Project Structure

### Documentation (this feature)

```text
specs/016-delete-spec-sidebar/
├── plan.md     ← this file
└── spec.md
```

### Source Code (changes)

```text
package.json   ← (1) add icon to speckit.delete command; (2) add inline menu entry
```

The `speckit.delete` command handler at `src/features/specs/specCommands.ts:57`
already handles the full delete flow (confirmation dialog, recursive delete, refresh).
No TypeScript files need to change.

## Implementation Steps

### Step 1 — Add `$(trash)` icon to the `speckit.delete` command definition

In `package.json` `contributes.commands`, change:
```json
{ "command": "speckit.delete", "title": "Delete Spec", "category": "SpecKit" }
```
to:
```json
{ "command": "speckit.delete", "title": "Delete Spec", "category": "SpecKit", "icon": "$(trash)" }
```

### Step 2 — Add inline `view/item/context` entry

In `package.json` `contributes.menus.view/item/context`, add alongside the existing `7_modification` entry:
```json
{
  "command": "speckit.delete",
  "when": "view == speckit.views.explorer && viewItem == spec",
  "group": "inline"
}
```

The existing `"group": "7_modification"` entry is kept so Delete Spec remains in the right-click menu.

## Verification

1. `npm run compile` — zero errors (no TS changes)
2. Press F5 → Extension Development Host
3. Open SpecKit sidebar → Specs view
4. Hover over a spec name → trash icon appears inline on the row
5. Click trash icon → confirmation dialog → confirm → spec deleted, tree refreshes
6. Right-click spec name → "Delete Spec" still appears in context menu
