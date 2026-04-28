# Spec: Copy Spec Path / Name

**Slug**: 089-copy-spec-path-name | **Date**: 2026-04-27

## Summary

Add right-click menu entries on spec items in the sidebar to copy the spec's workspace-relative path or its slug to the clipboard. This makes it trivial to reference a spec in chat, PRs, commits, or external tools without retyping the directory name.

## Requirements

- **R001** (MUST): Right-clicking a spec item (any lifecycle: active, tasks-done, completed, archived) shows two new context-menu entries: **Copy Path** and **Copy Name**.
- **R002** (MUST): **Copy Path** writes the workspace-relative spec directory path to the system clipboard (e.g. `specs/089-copy-spec-path-name`). Forward slashes only — no leading slash, no platform-specific separators.
- **R003** (MUST): **Copy Name** writes the spec slug (the directory name, e.g. `089-copy-spec-path-name`) to the system clipboard.
- **R004** (MUST): After copying, show a transient confirmation notification (e.g. `Copied "specs/089-copy-spec-path-name"`) using the same auto-dismiss pattern other sidebar actions use.
- **R005** (SHOULD): Both entries appear under a dedicated `9_clipboard` group in the context menu, placed below the existing `7_modification` and reveal entries so destructive/navigation actions stay visually primary.
- **R006** (SHOULD): The copy entries are hidden from the command palette (registered with `when: false` like other internal sidebar commands), since they require a tree-item argument.
- **R007** (MAY): Entries are only shown for spec items, not for document children (`spec-document-*`), related docs, or group headers.

## Scenarios

### Copy path on a spec

**When** the user right-clicks an active spec named `089-copy-spec-path-name` and chooses **Copy Path**
**Then** the clipboard contains `specs/089-copy-spec-path-name` and a brief notification confirms the copy

### Copy name on an archived spec

**When** the user right-clicks an archived spec and chooses **Copy Name**
**Then** the clipboard contains the slug only (e.g. `045-update-docs`) and a brief notification confirms the copy

### Spec item missing specPath fallback

**When** a tree item has no `specPath` set (legacy/edge case)
**Then** the command falls back to `specs/${item.label}` for the path and `${item.label}` for the name, matching the convention used by `speckit.specs.reveal` and `speckit.delete`

### Document child item

**When** the user right-clicks a child document inside a spec (e.g. `spec.md`, `plan.md`)
**Then** the **Copy Path** / **Copy Name** entries do not appear (this menu is for the spec, not its files)

## Non-Functional Requirements

- **NFR001** (MUST): Clipboard write happens via `vscode.env.clipboard.writeText` so it works on macOS, Windows, and Linux without platform branching.
- **NFR002** (SHOULD): Notification uses `NotificationUtils.showAutoDismissNotification` to match the look/feel of `delete`, `archive`, `reactivate`, and other sidebar actions.

## Out of Scope

- Copying a spec's full absolute filesystem path. Workspace-relative is what's useful in PRs and chat.
- Copying individual document paths (`spec.md`, `plan.md`, `tasks.md`). VS Code's built-in **Copy Path / Copy Relative Path** on document children already covers that.
- Drag-and-drop or keyboard shortcut bindings for these actions (right-click only for now).
- Multi-select bulk copy. The existing bulk-action infrastructure is geared toward state changes, not clipboard joins; revisit only if users ask for it.
