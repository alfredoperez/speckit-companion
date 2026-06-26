# Data Model: Companion home in the Steering view

This feature introduces no persisted data. It adds in-memory tree shapes and two pure reader functions.

## Tree nodes (all `SteeringItem` instances)

| Node | contextValue | collapsible | icon (installed / not) | open action |
|---|---|---|---|---|
| Companion (group) | `companion-header` | `Collapsed` when installed, else `None` | moss SVG / `warning` ThemeIcon | none (label only) |
| Configuration (group) | `companion-config-group` | `Collapsed` | `settings-gear` | none |
| Setting-group entry | `companion-config-item` | `None` | `gear` | open `.specify/companion.yml` |
| Commands (group) | `companion-commands-group` | `Collapsed` | `symbol-event` | none |
| Command entry | `companion-command` | `None` | `terminal` | none (tooltip = description) |

The not-installed Companion node also carries `description = "Not installed"`.

## Reader functions (`companionSteering.ts`, no `vscode` dependency)

- `readCompanionConfigGroups(workspaceRoot): string[]` — returns the top-level keys of `.specify/companion.yml` (the setting-group names), or `[]` when the file is absent or unparseable.
- `readCompanionCommands(workspaceRoot): Array<{ name: string; description: string }>` — parses `.specify/extensions/companion/extension.yml`, returns `provides.commands` as `{ name, description }` pairs, or `[]` when absent/unparseable/malformed.
- `isWithinRoot(workspaceRoot, candidatePath): boolean` — true when `candidatePath` resolves inside `workspaceRoot` (`path.relative` not absolute and not starting with `..`). Used to guard the Configuration open target.

## Reused identifiers (from spec Verbatim Constraints)

- Install command: `speckit.companion.installSpecKitExtension`
- Context key gating the inline action: `speckit.companion.installed`
- Install-state helper: `isCompanionInstalled(workspaceRoot)`
- Config file: `.specify/companion.yml`
- Manifest: `.specify/extensions/companion/extension.yml`, key `provides.commands`
- Icon: `assets/icons/moss.svg`
