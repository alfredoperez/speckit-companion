# Phase 1 Data Model: Reveal Spec Folder in OS File Browser

**Feature**: 069-reveal-spec-folder
**Date**: 2026-04-20

This feature introduces no new persisted data, no new schema, and no changes to
`.spec-context.json`. It reuses one existing in-memory entity.

## Entity: SpecTreeItem (existing)

**Source**: `src/core/types/config.ts`

```ts
export interface SpecTreeItem {
    label: string;
    specPath?: string;   // workspace-relative path, e.g. "specs/069-reveal-spec-folder"
}
```

### Fields used by this feature

| Field      | Type     | Source                              | Used for                                                    |
|------------|----------|-------------------------------------|-------------------------------------------------------------|
| `label`    | `string` | `SpecExplorerProvider`              | Error-message text when folder is missing / unreadable       |
| `specPath` | `string?`| `SpecExplorerProvider`              | Workspace-relative folder path → resolved to absolute `Uri` |

### Relationships

- A `SpecTreeItem` corresponds 1:1 to a directory under the workspace's
  `specs/` or `.claude/specs/` root (resolved per `specDirectoryResolver`).
- No new references, parents, or children are introduced.

### Validation rules

1. `specPath` **MAY** be `undefined` on legacy items; the reveal handler
   **MUST** fall back to `specs/${label}` (same fallback already used by
   `speckit.delete` in `specCommands.ts:114`).
2. After resolving to an absolute path, the handler **MUST** verify the
   directory exists via `vscode.workspace.fs.stat(uri)` before invoking
   `revealFileInOS` (FR-005, SC-004).

### State transitions

None. The reveal action is stateless and idempotent: invoking it does not
change any spec's lifecycle, status, `.spec-context.json`, or tree state.

## Non-entities (explicitly not added)

- **No new command registry entity**: the command id
  `speckit.specs.reveal` is registered alongside existing ones in
  `specCommands.ts` and (optionally) declared in `core/constants.ts`
  `Commands` enum if that pattern is used there.
- **No new context-key**: the menu gate reuses the existing
  `viewItem == spec` mechanism.
- **No new setting**: behavior is invariant across users.
