# Phase 1 — Data Model: Always Show SpecKit Icon

This feature has no persisted entities and no new TypeScript types. The "data model" is the set of VS Code context keys and the resulting view/welcome states they drive. Documenting it here keeps the gating logic explicit so reviewers can trace each acceptance scenario back to a clause in `package.json`.

---

## Context-key inputs

| Key | Source | Meaning when true |
|-----|--------|-------------------|
| `workbenchState == empty` | VS Code built-in | No workspace or folder is open at all (the "no folder open" startup screen). |
| `workspaceFolderCount == 0` | VS Code built-in | Zero folders in the current workspace (covers the rare case of an empty multi-root workspace file). |
| `speckit.cliInstalled` | `SpecKitDetector.checkCliInstalled` (`src/speckit/detector.ts:45-69`) | The `specify` CLI is found on PATH. |
| `speckit.detected` | `SpecKitDetector.checkWorkspaceInitialized` (`src/speckit/detector.ts:75-111`) | A workspace folder exists AND it contains `.specify/` or SpecKit agent files. Always false when no folder is open. |
| `speckit.constitutionNeedsSetup` | `SpecKitDetector.checkConstitutionSetup` (`src/speckit/detector.ts:116-144`) | A constitution file exists but still has placeholder tokens. |
| `config.speckit.views.steering.visible` | User setting | Steering view enabled. |
| `config.speckit.views.settings.visible` | User setting | Settings view enabled. |

Derived predicate used throughout: `noWorkspace ≡ workbenchState == empty || workspaceFolderCount == 0`.

---

## View visibility states

For each view in the `speckit` container, the table shows the resulting visibility under the two top-level workspace states.

| View | When clause (after this feature) | No workspace | Workspace open |
|------|----------------------------------|--------------|----------------|
| `speckit.views.explorer` | *(no clause — always eligible)* | Visible (renders welcome content) | Visible (renders specs tree or existing welcome) |
| `speckit.views.steering` | `!noWorkspace && config.speckit.views.steering.visible` | Hidden | Visible if user setting is true |
| `speckit.views.settings` | `!noWorkspace && config.speckit.views.settings.visible` | Hidden | Visible if user setting is true |

**Container visibility** (the activity-bar icon): visible whenever any view above is eligible. Because `speckit.views.explorer` is now unconditionally eligible, the container is always visible. ← This is the entire fix.

---

## Welcome-content states for `speckit.views.explorer`

The view shows whichever `viewsWelcome` entry's `when` clause matches. Entries are mutually exclusive by construction (see Decision 4 in `research.md`).

| State | Predicate | Content shown |
|-------|-----------|---------------|
| **Empty workspace** *(NEW)* | `noWorkspace` | "Open a folder to start using SpecKit." + `[$(folder-opened) Open Folder](command:vscode.openFolder)` |
| CLI detected, workspace not initialized | `speckit.cliInstalled && !speckit.detected` *(implies workspace open, since `speckit.detected` requires a folder)* | Existing "Initialize Workspace" content |
| Workspace initialized, constitution needs setup | `speckit.detected && speckit.constitutionNeedsSetup` | Existing "Configure Constitution / Create New Spec" content |
| Workspace initialized, constitution OK | `speckit.detected && !speckit.constitutionNeedsSetup` | Existing "Build features with specs" content |
| Filter active, no matches | `speckit.specs.filterActive && speckit.specs.noFilterMatch` | Existing "No specs match" content |

The tree itself (specs list) renders only when the workspace is open AND no welcome `when` matches — same behavior as today.

---

## State transitions

The interesting transitions for this feature, traced to the spec scenarios:

| From | Trigger | To | Implementing mechanism |
|------|---------|----|----------------------|
| (workbench paint) | `onStartupFinished` fires (or even before) | Empty-workspace welcome visible | Declarative `viewsWelcome` + relaxed `when` |
| Empty-workspace welcome | User picks a folder via "Open Folder" | Workbench reload → one of the workspace-open welcome states or specs tree | `vscode.openFolder` command (built-in); VS Code rerenders welcome based on context keys after `SpecKitDetector.detect()` resolves |
| Specs tree visible | User runs `File → Close Folder` | Empty-workspace welcome | `workbenchState`/`workspaceFolderCount` flip → `when` clauses re-evaluate; container stays mounted because `speckit.views.explorer` remains eligible |

---

## Invariants

1. The container is visible iff `speckit.views.explorer` is eligible. After this change, that view's eligibility is unconditional, so the container is always visible. (FR-001)
2. Exactly one `viewsWelcome` entry for `speckit.views.explorer` is active at any time, by construction of the `when` clauses. (FR-002, FR-006)
3. The transition from empty-workspace welcome to workspace-open content requires no extension code path — it's driven entirely by VS Code's context-key reactivity. (FR-004, SC-004)
4. The activity-bar position, label, and icon glyph from `viewsContainers.activitybar.speckit` are not touched. (FR-007)
