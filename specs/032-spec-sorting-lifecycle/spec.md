# Spec Sorting & Lifecycle Buttons

| Field       | Value                        |
|------------|------------------------------|
| Spec ID    | 032                          |
| Slug       | spec-sorting-lifecycle       |
| Created    | 2026-04-02                   |
| Status     | Draft                        |

## Summary

Sort active specs by creation date (newest first) in the sidebar explorer, and add Complete/Archive action buttons to the spec viewer webview so users can transition spec status without using context menus.

## Requirements

- **R001**: Active specs in the sidebar tree view must be sorted by directory creation date (newest first). Currently specs appear in filesystem order (alphabetical).
- **R002**: The spec viewer webview must show a "Complete" button when the spec status is `active` and all tasks are done (100% completion) or the user explicitly wants to mark it done.
- **R003**: The spec viewer webview must show an "Archive" button when the spec status is `active` or `completed`.
- **R004**: Clicking "Complete" sets the spec status to `completed` via `setSpecStatus()` and refreshes both the webview and sidebar tree.
- **R005**: Clicking "Archive" sets the spec status to `archived` via `setSpecStatus()` and refreshes both the webview and sidebar tree.
- **R006**: The Complete/Archive buttons should appear in the spec viewer footer bar, next to the existing "Edit Source" button.
- **R007**: After completing or archiving, the spec viewer should update its UI to reflect the new status (e.g., show the completion badge, remove action buttons that no longer apply).

## Scenarios

### Sorting active specs by creation date
- User opens sidebar with multiple active specs
- Specs appear sorted newest-first by directory creation time (fs birthtime/ctime)
- Completed and archived groups remain sorted alphabetically

### Completing a spec from the viewer
- User views a spec with 100% task completion
- A "Complete" button appears in the viewer
- User clicks "Complete"
- Spec status updates to `completed`, sidebar moves it to the Completed group
- Viewer refreshes to show completion state, "Complete" button is replaced by "Archive"

### Archiving a spec from the viewer
- User views a completed spec
- An "Archive" button is visible
- User clicks "Archive"
- Spec status updates to `archived`, sidebar moves it to the Archived group
- Viewer refreshes to show archived state, action buttons are removed

### Archiving an active spec directly
- User views an active spec and wants to skip completion
- "Archive" button is available alongside "Complete"
- Clicking "Archive" sets status to `archived` directly

## Technical Notes

- `setSpecStatus()` already exists in `specContextManager.ts` — use it for status transitions.
- `speckit.archive` command already exists in `specCommands.ts` — the new webview buttons should reuse the same underlying logic.
- Sorting by creation date requires reading `fs.statSync(dir).birthtime` in `specExplorerProvider.ts` when building the active specs list.
- Webview buttons need new message types (`completeSpec`, `archiveSpec`) handled in `messageHandlers.ts`.
- The spec viewer provider needs access to the sidebar provider's `refresh()` to update the tree after status changes.
