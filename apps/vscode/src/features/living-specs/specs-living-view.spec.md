# Specs Living View — Living Spec

## Purpose

How living specs show up in the editor: the Living Specs tree, its row health and actions, and the status bar item naming the specs that claim the active file.

## Requirements

### Living-spec listings are read-only, bounded, and honest about what they could not compute

The listing SHALL report drift or coverage it could not compute as unknown, never as zero or "no drift", and any git call behind it is time-bounded.

#### Scenario: a capability's spec has never been committed
- **WHEN** drift is computed
- **THEN** drift is reported as unknown, not "no drift"

### A spec path outside the workspace is never read

A configured spec path that resolves outside the workspace SHALL be dropped from the listing without being read.

#### Scenario: a configured document path points outside the workspace
- **WHEN** the listing resolves it
- **THEN** the entry is dropped, not read

### A missing coverage file is flagged only once the project uses coverage

A capability without a coverage file SHALL be called out only when some other capability in the project has one, and its tooltip then names the action that writes one.

#### Scenario: no capability in the project has a coverage file
- **WHEN** the rows are drawn
- **THEN** none of them mentions coverage

#### Scenario: one capability has a coverage file and another does not
- **WHEN** the rows are drawn
- **THEN** the one without it reads as having no coverage file, and its tooltip names the action that writes one

### A capability row's tooltip leads with its name and purpose

A capability row's tooltip SHALL start with the exact capability name, followed by the first sentence of its spec's purpose.

#### Scenario: the reader hovers a capability row
- **WHEN** the tooltip shows
- **THEN** the exact name comes first and the purpose's first sentence follows

### A drifted row is told apart by shape and repaired from the row

A drifted row SHALL carry a warning icon, so it differs from a healthy row by shape and not tint alone. Update to match code SHALL be an inline action on the row as well as in its context menu, and the tooltip names it.

#### Scenario: a capability has drifted
- **WHEN** the reader hovers its row
- **THEN** the update action is on the row, and still in the right-click menu

### An icon on a capability row means look here

A healthy capability row SHALL have no icon. Only a drifted row, a row with no spec, and folder and tier rows carry one.

#### Scenario: a healthy capability is drawn
- **WHEN** its row renders
- **THEN** it has no icon

### The capability tree groups by folder and labels its rows as words

A folder holding two or more capability specs SHALL be its own group, and a folder holding one collapses into its leaf. Labels read as words, using the same naming rule as the viewer's Overview, and leaves in a group drop the leading words every sibling shares, keeping at least one.

#### Scenario: eight specs share one folder and one leading word
- **WHEN** the tree is built
- **THEN** the folder is one group and each leaf label omits the shared word

#### Scenario: a folder holds a single spec
- **WHEN** the tree is built
- **THEN** the folder is not a group and the leaf sits under its parent

### An empty view is a way in, not a row saying there is nothing here
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsExplorerProvider.ts, apps/vscode/src/features/living-specs/livingSpecsCommands.ts -->

With no registry, or nothing adopted yet, the tree SHALL stay empty so the view's welcome content offers the next step instead of an informational row.

#### Scenario: the project has no registry
- **WHEN** the Living Specs view is drawn
- **THEN** the tree is empty and the welcome content offers set-up

### Set-up asks where specs live once, then offers adoption
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsCommands.ts -->

Set-up SHALL ask once where specs live, write an enabled registry with that layout and nothing adopted, then offer adoption. Adoption asks which areas to adopt and carries the layout already chosen instead of asking again.

#### Scenario: set-up runs and adoption follows
- **WHEN** the reader answers where specs live and picks the areas
- **THEN** a registry with that layout is written, and the dispatched adoption names those areas and that layout

#### Scenario: the reader backs out of the area prompt
- **WHEN** nothing is chosen
- **THEN** nothing is dispatched and nothing more is written

### The Living Specs view offers a one-pass sync action

The view's title bar SHALL carry a sync action that dispatches the living-spec sync command through the active AI provider, gated on the companion extension like adoption. The extension itself edits no files for it.

#### Scenario: the action is triggered
- **WHEN** the user triggers sync with the companion extension installed
- **THEN** the sync command is dispatched to the AI provider and the extension writes nothing itself

### The status bar names the living specs for the active file and reaches one requirement

A status bar item SHALL show how many living specs claim the active file, and is hidden when the count is zero, living specs are off, or the editor holds no workspace file. Choosing a requirement from it SHALL open that spec at that requirement.

#### Scenario: the active editor changes to an unclaimed file
- **WHEN** the indicator refreshes
- **THEN** it is hidden instead of showing a zero

#### Scenario: the reader picks a requirement from the item's list
- **WHEN** the list closes on it
- **THEN** that spec opens scrolled to the requirement

### A capability with no spec file opens to the call to adopt it

A registered capability whose spec file does not exist SHALL still open from its row, showing one call to action, "Adopt this area", which adopts the directories the capability already claims without asking. An existing but empty spec file does not show it.

#### Scenario: the reader clicks a capability marked not created
- **WHEN** the viewer opens
- **THEN** it shows "Adopt this area" and no cards

#### Scenario: the reader picks Adopt this area
- **WHEN** adoption starts
- **THEN** it adopts the capability's own directories without asking which

### Validate checks the capability it is run from

The validate command SHALL dispatch the living-spec shape check through the active AI provider, scoped to the capability it was invoked on, or to every living spec when invoked from nowhere in particular.

#### Scenario: Validate is pressed in an open capability
- **WHEN** the check is dispatched
- **THEN** it names that capability

### Any requirement opens from the command palette

`SpecKit: Open Living Spec` SHALL list every registered capability, then that capability's requirement headings under an "Open at the top" item, and open the viewer at the chosen requirement. Dismissing either picker opens nothing.

#### Scenario: the reader picks a requirement
- **WHEN** the second picker closes on a heading
- **THEN** the viewer opens scrolled to that requirement

#### Scenario: living specs are not set up
- **WHEN** the command runs
- **THEN** a message says so and nothing opens

## Uncovered

- All files under `__tests__/` were listed but not read.
