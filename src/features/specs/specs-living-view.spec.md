# Specs Living View — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

This capability is how living specs show up in the editor: the Living Specs tree, its row health and actions, and the status bar item that names the specs claiming the active file. Without it a living spec is a file nobody is pointed at.

## Requirements

### Living-spec listings are read-only, bounded, and honest about what they could not compute

The living-specs listing SHALL read the project's capability configuration without executing any project tooling, resolving each capability's document path and confining every resolved path to the workspace. [inferred] — how the listing is *presented* as tree rows is taken from the model and command surfaces; the view provider itself was not read. Derived health — coverage counts, drift — MUST be reported as *absent* when it cannot be computed, never as zero or false: a missing count and a genuine zero mean opposite things to a reader. Any external call it makes to compute health MUST be time-bounded.

#### Scenario: a capability's document has never been committed
- **WHEN** drift is computed
- **THEN** drift is reported as unknown rather than as "no drift"

#### Scenario: a configured document path points outside the workspace
- **WHEN** the listing resolves it
- **THEN** the entry is dropped rather than read

### A drifted row is told apart by shape and repaired from the row

A drifted row SHALL differ from a healthy one by icon *shape*, not by tint alone, and its tooltip names the repair. The repair — update to match code — SHALL be an inline hover action on the row and remain in the context menu. Refresh, which redraws the tree, and the actions that dispatch an AI run and rewrite spec files SHALL NOT share a glyph. The per-capability drift check resolves a capability from its spec path the same way update does, so a viewer that only knows the path can scope it.

#### Scenario: a capability has drifted
- **WHEN** the reader hovers its row
- **THEN** the update action is on the row, and still in the right-click menu

### The Living Specs view offers a one-pass sync action

The Living Specs view's title bar SHALL carry a sync action that dispatches the living-spec sync command through the active AI provider, following the same dispatch path and companion-install gating as the adoption action. The action itself performs no grouping or file edits — the dispatched command owns the work.

#### Scenario: the action is triggered
- **WHEN** the user triggers the sync title action with the companion extension installed
- **THEN** the sync slash command is dispatched to the AI provider and nothing is edited by the extension itself

### The status bar names the living specs for the active file and reaches one requirement

A status bar item SHALL show how many living specs claim the active editor's file, hidden when the count is zero, when living specs are off, and when the editor holds no workspace file. Activating it SHALL list the claiming capabilities with their matching requirements, and choosing one SHALL open that capability's spec positioned on that requirement.

#### Scenario: the active editor changes to an unclaimed file
- **WHEN** the indicator refreshes
- **THEN** it is hidden rather than showing a zero

## Uncovered

- `livingSpecsExplorerProvider.ts` — not read; its contract is inferred here from `livingSpecsModel.ts` and `livingSpecsCommands.ts`.
- All files under `__tests__/` were listed but not read.
