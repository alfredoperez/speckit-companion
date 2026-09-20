# Specs Living View — Living Spec

## Purpose

How living specs show up in the editor: the Living Specs tree, its row health and actions, and the status bar item naming the specs that claim the active file.

## Requirements

### Living-spec listings are read-only, bounded, and honest about what they could not compute
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsModel.ts -->

The listing SHALL report drift or coverage it could not compute as unknown, never as zero or "no drift", and any git call behind it is time-bounded.

#### Scenario: a capability's spec has never been committed
- **WHEN** drift is computed
- **THEN** drift is reported as unknown, not "no drift"

### A spec path outside the workspace is never read
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsModel.ts -->

A configured spec path that resolves outside the workspace SHALL be dropped from the listing without being read.

#### Scenario: a configured document path points outside the workspace
- **WHEN** the listing resolves it
- **THEN** the entry is dropped, not read

### A missing coverage file is flagged only once the project uses coverage
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsExplorerProvider.ts -->

A capability without a coverage file SHALL be called out only when some other capability in the project has one, and its tooltip then names the action that writes one.

#### Scenario: no capability in the project has a coverage file
- **WHEN** the rows are drawn
- **THEN** none of them mentions coverage

#### Scenario: one capability has a coverage file and another does not
- **WHEN** the rows are drawn
- **THEN** the one without it reads as having no coverage file, and its tooltip names the action that writes one

### A capability row's tooltip leads with its name and purpose
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsExplorerProvider.ts -->

A capability row's tooltip SHALL start with the exact capability name, followed by the first sentence of its spec's purpose.

#### Scenario: the reader hovers a capability row
- **WHEN** the tooltip shows
- **THEN** the exact name comes first and the purpose's first sentence follows

### A drifted row is told apart by shape and repaired from the row
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsExplorerProvider.ts, apps/vscode/src/features/living-specs/livingSpecsCommands.ts -->

A drifted row SHALL carry a warning icon, so it differs from a healthy row by shape and not tint alone. Update to match code SHALL be an inline action on the row as well as in its context menu, and the tooltip names it.

#### Scenario: a capability has drifted
- **WHEN** the reader hovers its row
- **THEN** the update action is on the row, and still in the right-click menu

### An icon on a capability row means look here
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsExplorerProvider.ts -->

A healthy capability row SHALL have no icon. Only a drifted row, a row with no spec, and folder and tier rows carry one.

#### Scenario: a healthy capability is drawn
- **WHEN** its row renders
- **THEN** it has no icon

### The capability tree groups by folder and labels its rows as words
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsExplorerProvider.ts, apps/vscode/src/features/living-specs/livingSpecsModel.ts -->

A folder holding two or more capability specs SHALL be its own group, and a folder holding one collapses into its leaf. Labels read as words, using the same naming rule as the viewer's Overview, and leaves in a group drop the leading words every sibling shares, keeping at least one. A group SHALL start closed, so the view reads as a handful of folders rather than one row per capability, and SHALL start open and say how many drifted when it holds a drifted capability, because drift is the one thing here that asks to be acted on.

#### Scenario: every spec in a folder matches its code
- **WHEN** the tree is built
- **THEN** the folder is closed and carries no count

#### Scenario: one spec in a folder is behind its code
- **WHEN** the tree is built
- **THEN** the folder is open and its row reads the number that drifted

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

## Uncovered

- All files under `__tests__/` were listed but not read.
