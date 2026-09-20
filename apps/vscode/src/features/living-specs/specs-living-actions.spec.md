# Living Specs Actions — Living Spec

## Purpose

What a reader can run from the Living Specs view and the status bar: sync, set-up, adoption, validation, and opening a single requirement. The rows and the tree those actions sit on are in `specs-living-view.spec.md`.

## Requirements

### The Living Specs view offers a one-pass sync action
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsCommands.ts -->

The view's title bar SHALL carry a sync action that dispatches the living-spec sync command through the active AI provider, gated on the companion extension like adoption. The extension itself edits no files for it.

#### Scenario: the action is triggered
- **WHEN** the user triggers sync with the companion extension installed
- **THEN** the sync command is dispatched to the AI provider and the extension writes nothing itself

### The status bar names the living specs for the active file and reaches one requirement
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsStatusBar.ts, apps/vscode/src/features/living-specs/livingSpecsModel.ts -->

A status bar item SHALL show how many living specs claim the active file, and is hidden when the count is zero, living specs are off, or the editor holds no workspace file. Choosing a requirement from it SHALL open that spec at that requirement.

#### Scenario: the active editor changes to an unclaimed file
- **WHEN** the indicator refreshes
- **THEN** it is hidden instead of showing a zero

#### Scenario: the reader picks a requirement from the item's list
- **WHEN** the list closes on it
- **THEN** that spec opens scrolled to the requirement

### A capability with no spec file opens to the call to adopt it
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsCommands.ts, apps/vscode/src/features/living-specs/livingSpecsExplorerProvider.ts -->

A registered capability whose spec file does not exist SHALL still open from its row, showing one call to action, "Adopt this area", which adopts the directories the capability already claims without asking. An existing but empty spec file does not show it.

#### Scenario: the reader clicks a capability marked not created
- **WHEN** the viewer opens
- **THEN** it shows "Adopt this area" and no cards

#### Scenario: the reader picks Adopt this area
- **WHEN** adoption starts
- **THEN** it adopts the capability's own directories without asking which

### Validate checks the capability it is run from
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsCommands.ts -->

The validate command SHALL dispatch the living-spec shape check through the active AI provider, scoped to the capability it was invoked on, or to every living spec when invoked from nowhere in particular.

#### Scenario: Validate is pressed in an open capability
- **WHEN** the check is dispatched
- **THEN** it names that capability

### Any requirement opens from the command palette
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsCommands.ts -->

`SpecKit: Open Living Spec` SHALL list every registered capability, then that capability's requirement headings under an "Open at the top" item, and open the viewer at the chosen requirement. Dismissing either picker opens nothing.

#### Scenario: the reader picks a requirement
- **WHEN** the second picker closes on a heading
- **THEN** the viewer opens scrolled to that requirement

#### Scenario: living specs are not set up
- **WHEN** the command runs
- **THEN** a message says so and nothing opens

## Uncovered

_None: every action this view offers is described above._
