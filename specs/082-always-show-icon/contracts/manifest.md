# Manifest Contract — `package.json`

This is the only external interface the feature touches. The "contract" is the shape of the `contributes` block as VS Code reads it on extension load.

## Diff (conceptual)

### `contributes.views.speckit`

```jsonc
// BEFORE
{
  "id": "speckit.views.explorer",
  "name": "Specs",
  "when": "!(workbenchState == empty || workspaceFolderCount == 0)"
}

// AFTER — when clause removed entirely
{
  "id": "speckit.views.explorer",
  "name": "Specs"
}
```

`speckit.views.steering` and `speckit.views.settings` are **unchanged**. They keep their existing `when` clauses (still gated on workspace + their respective `config.speckit.views.*.visible` settings).

### `contributes.viewsWelcome` — new entry, prepended

```jsonc
{
  "view": "speckit.views.explorer",
  "contents": "Open a folder to start using SpecKit.\n\n[$(folder-opened) Open Folder](command:vscode.openFolder)",
  "when": "workbenchState == empty || workspaceFolderCount == 0"
}
```

Existing welcome entries are unchanged. Their `when` clauses (`speckit.cliInstalled && !speckit.detected`, `speckit.detected && ...`) are naturally disjoint from the new entry because `speckit.detected` is always false without a workspace and `speckit.cliInstalled` alone is not enough to satisfy any existing entry's gate.

### `contributes.viewsContainers.activitybar`

Unchanged. The icon, id, and title stay exactly as they are today.

---

## Behavioral contract for VS Code

| Input state | Container | View body |
|-------------|-----------|-----------|
| No workspace open | Visible | Welcome: "Open a folder to start using SpecKit." + Open Folder button |
| Workspace open, CLI not installed, not initialized | Visible | (Existing fallback — empty tree, no welcome matches today; out of scope to change) |
| Workspace open, CLI installed, not initialized | Visible | Welcome: "Initialize Workspace" (existing) |
| Workspace open, initialized, constitution needs setup | Visible | Welcome: "Configure Constitution" (existing) |
| Workspace open, initialized, constitution OK | Visible | Specs tree (or "Build features with specs" welcome if empty) |

---

## Out of contract

- Telemetry on the new welcome action — not in scope.
- Retitling or repositioning the activity-bar entry — explicitly forbidden by FR-007.
- Steering/Settings empty-state behavior — unchanged; out of scope.
- Any change under `.claude/**` or `.specify/**` — forbidden by extension-isolation rules in `CLAUDE.md`.
