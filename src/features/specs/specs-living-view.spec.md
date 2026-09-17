# Specs Living View — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

How living specs show up in the editor: the Living Specs tree, its row health and actions, and the status bar item naming the specs that claim the active file.

## Requirements

### Living-spec listings are read-only, bounded, and honest about what they could not compute

The listing SHALL read the capability configuration without executing project tooling, and MUST confine every resolved document path to the workspace. A capability row's tooltip SHALL open with the first sentence of its spec's purpose. Derived health (coverage counts, drift) MUST be reported as absent when it cannot be computed, never as zero or false, and any external call to compute it MUST be time-bounded. A missing coverage file SHALL be called out only once some other capability in the project has one.

#### Scenario: a capability's document has never been committed
- **WHEN** drift is computed
- **THEN** drift is reported as unknown, not "no drift"

#### Scenario: a configured document path points outside the workspace
- **WHEN** the listing resolves it
- **THEN** the entry is dropped, not read

#### Scenario: no capability in the project has a coverage file
- **WHEN** the rows are drawn
- **THEN** none of them mentions coverage

#### Scenario: one capability has a coverage file and another does not
- **WHEN** the rows are drawn
- **THEN** the one without it reads as having no coverage file, and its tooltip names the action that writes one

#### Scenario: the reader hovers a capability row
- **WHEN** the tooltip shows
- **THEN** its first line after the name is the purpose's first sentence

### A drifted row is told apart by shape and repaired from the row

A drifted row SHALL differ from a healthy one by icon shape, not tint alone, and its tooltip names the repair. The repair, update to match code, SHALL be an inline hover action on the row and stay in the context menu. Refresh SHALL NOT share a glyph with the actions that dispatch an AI run and rewrite spec files. The per-capability drift check SHALL resolve a capability from its spec path the same way update does.

#### Scenario: a capability has drifted
- **WHEN** the reader hovers its row
- **THEN** the update action is on the row, and still in the right-click menu

### An empty view is a way in, not a row saying there is nothing here
<!-- touches: src/features/specs/livingSpecsExplorerProvider.ts, src/features/specs/livingSpecsCommands.ts -->

With no registry, or nothing adopted yet, the tree SHALL stay empty so the view's welcome content shows instead of an informational row. Whether a registry exists and whether anything is adopted SHALL be published as editor context, so the welcome content is decided from the workspace. Set-up SHALL ask once where specs live, write the registry with that layout and nothing adopted, then offer adoption. Adoption SHALL ask which areas to adopt (the project's directories, the whole project, or a typed path) and carry the layout already chosen instead of asking again.

#### Scenario: the project has no registry
- **WHEN** the Living Specs view is drawn
- **THEN** the tree is empty and the welcome content offers set-up

#### Scenario: set-up runs
- **WHEN** the reader answers where specs should live
- **THEN** a registry is written enabled with that layout and no capabilities, and adoption is offered next

#### Scenario: adoption is started from set-up
- **WHEN** the areas are chosen
- **THEN** the dispatched command names those areas and the layout already answered

#### Scenario: the reader backs out of the area prompt
- **WHEN** nothing is chosen
- **THEN** nothing is dispatched and nothing is written

### The Living Specs view offers a one-pass sync action

The view's title bar SHALL carry a sync action that dispatches the living-spec sync command through the active AI provider, with the same dispatch path and companion-install gating as adoption. The action itself MUST NOT group changes or edit files.

#### Scenario: the action is triggered
- **WHEN** the user triggers the sync title action with the companion extension installed
- **THEN** the sync slash command is dispatched to the AI provider and the extension edits nothing itself

### The status bar names the living specs for the active file and reaches one requirement

A status bar item SHALL show how many living specs claim the active file. It is hidden when the count is zero, when living specs are off, and when the editor holds no workspace file. Activating it SHALL list the claiming capabilities with their matching requirements, and choosing one SHALL open that spec at that requirement.

#### Scenario: the active editor changes to an unclaimed file
- **WHEN** the indicator refreshes
- **THEN** it is hidden instead of showing a zero

## Uncovered

- All files under `__tests__/` were listed but not read.

### A capability with no spec file opens to the call to adopt it

A registered capability whose spec file does not exist SHALL still open from its row, showing one call to action, "Adopt this area", which adopts the directories the capability already claims without asking again. An existing but empty spec file SHALL NOT show it. The view SHALL include a command that validates living-spec shape through the active AI provider, scoped to the invoking capability, or to every living spec when invoked from nowhere in particular.

#### Scenario: the reader clicks a capability marked not created
- **WHEN** the viewer opens
- **THEN** it shows "Adopt this area" and no cards

#### Scenario: the reader picks Adopt this area
- **WHEN** adoption starts
- **THEN** it adopts the capability's own directories without asking which

#### Scenario: Validate is pressed in an open capability
- **WHEN** the check is dispatched
- **THEN** it names that capability

### Any requirement opens from the command palette

`SpecKit: Open Living Spec` SHALL list every registered capability, then that capability's requirement headings under an "Open at the top" item, and open the viewer through `speckit.viewSpecDocument` with `{ living: true, requirement? }`. Dismissing either picker SHALL open nothing, and without living specs configured the command SHALL say so and open nothing.

#### Scenario: the reader picks a requirement
- **WHEN** the second picker closes on a heading
- **THEN** the viewer opens scrolled to that requirement

#### Scenario: living specs are not set up
- **WHEN** the command runs
- **THEN** a message says so and nothing opens

### An icon on a capability row means look here

A healthy capability row SHALL have no icon. A drifted row keeps the warning icon, a row with no spec keeps the outline circle, and folder and tier rows keep theirs. The row's label is the tree's readable label, and its tooltip's first line starts with the exact capability name.

#### Scenario: a healthy capability is drawn
- **WHEN** its row renders
- **THEN** it has no icon
