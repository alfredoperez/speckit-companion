# Research: Companion home in the Steering view

## Decision: Source the command list from the installed manifest, not a bundled static list

**Decision**: Read `.specify/extensions/companion/extension.yml` → `provides.commands` at runtime (with bundled `js-yaml`) and render each entry. The Commands group only appears when installed, and when installed that file is present, so it is the natural source.

**Rationale**: The host extension ships only `src/` in the `.vsix`; `speckit-extension/extension.yml` is absent at runtime, so it cannot be read from the user's workspace. A bundled static list would go stale the moment the spec-kit extension adds a command — the acceptance criterion is that new commands appear automatically. The installed manifest is the live source of truth, and it is only read on the installed path (Commands group is hidden otherwise), so there is no "file missing" failure mode in normal operation; a missing/unparseable manifest degrades to an empty group.

**Alternatives considered**: Bundle a static command list into the build — rejected: violates "sourced from the manifest, not hand-maintained" and goes stale. Read `speckit-extension/extension.yml` from the dev workspace — rejected: isolation violation, absent in the packaged extension.

## Decision: "Not installed" indicator via warning icon + description + inline menu action

**Decision**: VS Code has no per-tree-item badge. When not installed, set the Companion node's icon to a warning-themed `ThemeIcon`, its `description` to `Not installed`, and add a `package.json` `view/item/context` entry with `group: "inline"` keyed on the node's `contextValue` AND `!speckit.companion.installed`, invoking `speckit.companion.installSpecKitExtension`. When installed, the moss SVG icon shows and the description clears.

**Rationale**: This is the closest supported affordance set and mirrors the existing install affordance already used in the Specs view title menu (same command, same `!speckit.companion.installed` gate). A `TreeView.badge` is view-level (one per view), not per-node, so it cannot target the Companion node specifically; skipped.

**Alternatives considered**: `TreeView.badge` — rejected: view-scoped, not node-scoped. A child "Install" tree item — rejected: an inline action is the requested affordance and reads cleaner.

## Decision: Configuration children = top-level keys of `.specify/companion.yml`

**Decision**: Parse the configuration file and surface one child per top-level key (e.g. `commands`, and any future `hooks`/`livingSpecs`). Each child opens the configuration file. When the file is absent, omit the Configuration group entirely.

**Rationale**: Data-driven so the view reflects whatever the user's file actually contains rather than a hard-coded set, and there is no risk of showing a setting group that isn't present. Opening the file (rather than navigating to a line) keeps the action simple and robust.

**Alternatives considered**: Hard-code livingSpecs/hooks/profile rows — rejected: shows groups that may not exist and drifts from the file. Navigate to the specific YAML line — rejected: brittle line-finding for marginal benefit.

## Decision: Within-root path guard on the open action

**Decision**: The Configuration file path is a fixed workspace-relative join (`.specify/companion.yml`), but the open helper still validates the resolved target is within the workspace root (`path.relative(root, resolved)` is not absolute and does not start with `..`) before issuing `vscode.open`, dropping any entry that escapes.

**Rationale**: Honors checklist #380 (a path joined for fs/open is validated within root) and keeps the guard in place if the source of the path ever broadens to a config-supplied value.

## Decision: Refresh on install-state and config changes

**Decision**: Add a file watcher for `.specify/companion.yml` (create/change/delete) and for `.specify/extensions/companion/extension.yml` (create/delete = install/uninstall) that fires `_onDidChangeTreeData`. The existing activation watcher already updates the `speckit.companion.installed` context key; the provider's own watcher keeps the tree content current.

**Rationale**: Story 4 requires the node to stay current without a window reload; the provider already uses this watcher pattern for agents and skills.
