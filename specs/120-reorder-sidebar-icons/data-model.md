# Data Model: Sidebar Icon Adjustments

## Entities

### ExplorerTitleBarAction

- **Represents**: A command contributed to the SpecKit explorer title bar via `package.json`.
- **Fields**:
  - `command`: VS Code command id such as `speckit.create` or `speckit.specs.filter`
  - `view`: owning view id, here `speckit.views.explorer`
  - `group`: ordering token such as `navigation@0`
  - `when`: visibility condition evaluated by VS Code
- **Validation rules**:
  - `command` must correspond to a registered command.
  - `group` must preserve deterministic ordering across visible actions.
  - `when` must not unintentionally hide the primary create action in standard explorer states.

### ExplorerRefreshPath

- **Represents**: Existing mechanisms that refresh the explorer without relying on a manual title-bar button.
- **Sources**:
  - Explicit `specExplorer.refresh()` calls in command handlers
  - Debounced file watchers in `src/features/specs/specCommands.ts`
  - Shared watchers in `src/core/fileWatchers.ts`
- **Validation rules**:
  - Removing the visible refresh icon must not break standard spec list updates.
  - The refresh path should remain watcher-driven rather than adding new polling.

### SidebarDocumentationState

- **Represents**: User-facing docs that describe the explorer toolbar and sidebar behavior.
- **Fields**:
  - `sidebarReference`: long-form sidebar documentation in `docs/sidebar.md`
  - `readmeSummary`: shorter sidebar summary in `README.md`
- **Validation rules**:
  - Both docs must describe the shipped explorer toolbar accurately.
  - Sidebar docs must remain aligned with the actual title-bar actions.

## Relationships

- `ExplorerTitleBarAction` is rendered by VS Code from `package.json` contributions.
- `ExplorerRefreshPath` supports `ExplorerTitleBarAction` by ensuring the explorer stays current even after the refresh icon is removed.
- `SidebarDocumentationState` reflects the final set and order of `ExplorerTitleBarAction` entries.

## State Transitions

### Title-bar visibility

1. Explorer loads.
2. VS Code evaluates `view/title` entries for `speckit.views.explorer`.
3. Visible actions render in `group` order.
4. Filter-clear appears only when `speckit.specs.filterActive` is true.

### Explorer update flow after refresh icon removal

1. User or filesystem activity changes spec state or files.
2. Existing command handlers or watchers call `specExplorer.refresh()`.
3. Explorer re-renders without any manual refresh interaction.

## Out of Scope

- No `.spec-context.json` schema changes.
- No new persisted settings.
- No new commands or provider types.
