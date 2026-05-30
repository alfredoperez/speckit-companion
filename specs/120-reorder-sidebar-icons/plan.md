# Implementation Plan: Sidebar Icon Adjustments

**Branch**: `[120-reorder-sidebar-icons]` | **Date**: 2026-05-28 | **Spec**: [specs/120-reorder-sidebar-icons/spec.md](spec.md)
**Input**: Feature specification from `/specs/120-reorder-sidebar-icons/spec.md`

## Summary

Remove the manual refresh icon from the SpecKit explorer title bar and keep the create-spec action as the leading right-side action by editing the explorer `view/title` menu contributions in `package.json`. Preserve the existing watcher-driven refresh behavior already wired through `specCommands.ts`, `extension.ts`, and `core/fileWatchers.ts`, and update sidebar-facing documentation so the toolbar description matches shipped behavior.

## Technical Context

**Language/Version**: TypeScript 5.3+ targeting ES2022 in a VS Code extension  
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Jest with `ts-jest`, existing SpecKit explorer providers and command registration  
**Storage**: File-based workspace spec data under `.claude/` and `specs/`; no new persisted data for this feature  
**Testing**: `npm run compile`, `npm test`, plus manual title-bar verification in the Extension Development Host  
**Target Platform**: VS Code desktop extension on macOS, Windows, and Linux  
**Project Type**: Single VS Code extension repository  
**Performance Goals**: Keep explorer updates on the existing watcher/refresh path with no perceptible regression in sidebar responsiveness  
**Constraints**: Preserve the spec-driven sidebar flow, avoid adding polling or redundant state, and update sidebar documentation for user-visible toolbar changes  
**Scale/Scope**: Narrow change to explorer title-bar menu ordering plus adjacent command/docs/tests, centered on `package.json` and existing spec explorer wiring

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Extensibility and Configuration**: PASS. The change stays inside VS Code menu contribution ordering and existing command wiring; no provider-specific logic or hard-coded workflow divergence is introduced.
- **II. Spec-Driven Workflow**: PASS. `speckit.create` remains the primary workflow entry point, and removing the manual refresh icon does not alter lifecycle semantics or artifact sequencing.
- **III. Visual and Interactive**: PASS. The feature is purely a UI/interaction refinement in the sidebar title bar.
- **IV. Modular Architecture for Complex Features**: PASS. No new complex surface is introduced; the change remains in existing menu/configuration and explorer command modules.

**Post-Design Re-check**: PASS. Phase 1 artifacts keep the implementation bounded to current explorer/menu surfaces, require no constitution exception, and do not introduce new architectural complexity.

## Project Structure

### Documentation (this feature)

```text
specs/120-reorder-sidebar-icons/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── sidebar-titlebar.md
└── tasks.md
```

### Source Code (repository root)

```text
package.json
src/
├── extension.ts
├── core/
│   └── fileWatchers.ts
├── features/
│   └── specs/
│       ├── specCommands.ts
│       ├── specExplorerProvider.ts
│       ├── specsFilterState.ts
│       └── specsSortState.ts
└── speckit/
    ├── detector.ts
    └── detector.test.ts

docs/
├── sidebar.md
└── README.md
```

**Structure Decision**: Keep the change in the existing single-project extension structure. The implementation center is `package.json` for title-bar order and visibility, with `src/features/specs/specCommands.ts` and watcher wiring as the behavioral safety net and `docs/sidebar.md` plus `README.md` as the required user-facing documentation surfaces.

## Phase 0 Research Outcomes

- Explorer title-bar action order is controlled by `contributes.menus.view/title` group indices in `package.json`; the create action already leads the explorer action strip via `navigation@0`.
- The manual spec refresh action is redundant for normal operation because the explorer already refreshes from explicit command-side `specExplorer.refresh()` calls and debounced file watchers in `specCommands.ts` and `core/fileWatchers.ts`.
- The requested change is scoped to the SpecKit explorer title bar, not to steering or unrelated sidebar surfaces.

## Phase 1 Design Plan

1. Update the explorer `view/title` menu contributions in `package.json` so the shipped toolbar omits the refresh icon and preserves the intended action order.
2. Audit the command surface to decide whether `speckit.refresh` remains as a callable command without a title-bar button or should be removed entirely from contributions/tests in the same slice.
3. Update [docs/sidebar.md](../../docs/sidebar.md) and the README sidebar summary to match the new toolbar behavior.
4. Validate with compile/test plus manual Extension Development Host checks for populated, filtered, and empty explorer states.

## Complexity Tracking

No constitution violations or complexity exemptions are expected for this feature.
