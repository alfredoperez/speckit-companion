# Open the Sidebar — Living Spec

## Purpose

The SpecKit icon in the activity bar opens one container of views, and what a person meets there depends on how far their setup has got. Without these rules a first-time user sees an empty panel with no way forward, and an installed user sees offers for things they already have.

## Requirements

### The container shows the views the workspace and settings call for
<!-- touches: package.json, apps/vscode/src/extension.ts -->

The SpecKit container SHALL hold Specs, Living Specs, Steering, and Settings & Feedback, in that default order. Specs SHALL always show. The other three SHALL show only with a folder open, Steering only while `speckit.views.steering.visible` is on (the default), and Settings & Feedback only while `speckit.views.settings.visible` is on (off by default). Living Specs and Settings & Feedback SHALL start collapsed.

#### Scenario: a default install with a folder open
- **WHEN** no view setting has been changed
- **THEN** Specs, Living Specs and Steering show, and Settings & Feedback does not

### An empty Specs view offers exactly one next step
<!-- touches: package.json, apps/vscode/src/core/utils/contextKeys.ts -->

A Specs view with no specs SHALL show a single welcome block chosen by setup state: Open Folder when no folder is open, Initialize Workspace when the Spec Kit CLI is installed but the project is not initialized, Configure Constitution with Create New Spec when the constitution still needs setting up, and otherwise a welcome with **Create your first spec** and **Open a live sample**. Two blocks SHALL never stack.

#### Scenario: the CLI is installed but the project is bare
- **WHEN** the Spec Kit CLI is detected and the workspace has no Spec Kit scaffolding
- **THEN** the only block shown offers Initialize Workspace

### Open a live sample seeds one copy of the bundled spec
<!-- touches: apps/vscode/src/features/specs/sampleSpec.ts -->

**Open a live sample** SHALL copy the bundled sample spec into the workspace's `specs/` folder and open it in the spec viewer. Using it again SHALL reopen the existing copy, never overwrite or duplicate it. With no folder open it SHALL explain that a folder is needed.

#### Scenario: the sample was edited, then opened again
- **WHEN** the sample folder already exists with changes
- **THEN** it opens as it is, changes intact

### The Specs toolbar holds the same actions in the same order
<!-- touches: package.json -->

The Specs title bar SHALL show Refresh, Filter, Sort, Collapse All or Expand All, Open Pipeline Builder, and New Spec last as the primary action, with no overflow menu. Open Pipeline Builder SHALL appear only when the Companion spec-kit extension is installed in the project. New Spec SHALL open the spec editor.

#### Scenario: Companion is not installed
- **WHEN** the project has no Companion spec-kit extension
- **THEN** the toolbar shows five actions and no Pipeline Builder button

### A missing Companion extension is flagged until it is installed
<!-- touches: apps/vscode/src/extension.ts, apps/vscode/src/features/specs/specExplorerProvider.ts, apps/vscode/src/features/settings/companionPresetReconciler.ts -->

While the project has no Companion spec-kit extension, the Specs view SHALL carry a badge tooltipped "Install SpecKit Companion" and, when specs exist, a pinned first row that starts the install in one click. Neither can be dismissed. Both SHALL disappear as soon as the extension lands in the project, with no reload, and "installed" SHALL mean the extension's folder under `.specify/extensions/` is present, not that a preset is. The badge SHALL clear when no folder is open.

#### Scenario: the extension is reinstalled with force
- **WHEN** the extension's folder vanishes for a moment during a forced reinstall
- **THEN** the badge and pinned row do not flash back on

#### Scenario: a filter matches nothing
- **WHEN** the filter leaves no specs
- **THEN** the pinned install row is hidden so the clear-filter offer is the only thing shown

### Settings & Feedback is a short list of shortcuts
<!-- touches: apps/vscode/src/features/settings/overviewProvider.ts -->

The Settings & Feedback view SHALL list Pipeline Builder, Open Settings, Report a Bug, Request a Feature and Rate on Marketplace, each running its command on click, and nothing else.

#### Scenario: opening settings
- **WHEN** someone clicks Open Settings
- **THEN** VS Code settings open filtered to SpecKit

## Uncovered

- The Living Specs view's own welcome blocks and tree belong to the living-specs area.
- `SpecKit: Upgrade…` and `SpecKit: Install Companion Extension` are Command Palette commands, not sidebar actions. They are owned by the install and upgrade capabilities.
