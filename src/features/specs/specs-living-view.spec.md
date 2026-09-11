# Specs Living View — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

This capability is how living specs show up in the editor: the Living Specs tree, its row health and actions, and the status bar item that names the specs claiming the active file. Without it a living spec is a file nobody is pointed at.

## Requirements

### Living-spec listings are read-only, bounded, and honest about what they could not compute

The living-specs listing SHALL read the project's capability configuration without executing any project tooling, resolving each capability's document path and confining every resolved path to the workspace. A capability row's tooltip SHALL open with the first sentence of its spec's purpose, so the row says what the capability is about and not only where it lives. Derived health — coverage counts, drift — MUST be reported as *absent* when it cannot be computed, never as zero or false: a missing count and a genuine zero mean opposite things to a reader. Any external call it makes to compute health MUST be time-bounded. A capability with no coverage file SHALL be called out as such only once some other capability in the project has one: before that, a project simply has not started mapping tests, and saying so on every row is the first thing a new reader is told.

#### Scenario: a capability's document has never been committed
- **WHEN** drift is computed
- **THEN** drift is reported as unknown rather than as "no drift"

#### Scenario: a configured document path points outside the workspace
- **WHEN** the listing resolves it
- **THEN** the entry is dropped rather than read

#### Scenario: no capability in the project has a coverage file
- **WHEN** the rows are drawn
- **THEN** none of them says anything about coverage, because that is how the project is rather than a gap in any one capability

#### Scenario: one capability has a coverage file and another does not
- **WHEN** the rows are drawn
- **THEN** the one without it reads as having no coverage file, and its tooltip names the action that writes one

#### Scenario: the reader hovers a capability row
- **WHEN** the tooltip shows
- **THEN** its first line after the name is the purpose's first sentence

### A drifted row is told apart by shape and repaired from the row

A drifted row SHALL differ from a healthy one by icon *shape*, not by tint alone, and its tooltip names the repair. The repair — update to match code — SHALL be an inline hover action on the row and remain in the context menu. Refresh, which redraws the tree, and the actions that dispatch an AI run and rewrite spec files SHALL NOT share a glyph. The per-capability drift check resolves a capability from its spec path the same way update does, so a viewer that only knows the path can scope it.

#### Scenario: a capability has drifted
- **WHEN** the reader hovers its row
- **THEN** the update action is on the row, and still in the right-click menu

### An empty view is a way in, not a row saying there is nothing here
<!-- touches: src/features/specs/livingSpecsExplorerProvider.ts, src/features/specs/livingSpecsCommands.ts -->

A project with no registry, and a registry with nothing adopted yet, SHALL leave the tree empty so the view's welcome content — which the editor renders only over an empty tree — is what the reader sees. An informational row in either case is a dead end that hides the only action available. What the welcome content offers SHALL be decided from the workspace, not guessed: whether a registry exists and whether anything is adopted are published as editor context. Setting up living specs SHALL ask once where specs live, write the registry with that layout and nothing adopted, and offer adoption straight after; adoption SHALL then ask which areas to adopt — offering the project's own directories, the whole project, or a typed path — and carry the layout already chosen so the same question is not asked twice.

#### Scenario: the project has no registry
- **WHEN** the Living Specs view is drawn
- **THEN** the tree is empty and the welcome content offers set-up, rather than a row explaining that there is nothing

#### Scenario: set-up runs
- **WHEN** the reader answers where specs should live
- **THEN** a registry is written enabled with that layout and no capabilities, and adoption is offered next

#### Scenario: adoption is started from set-up
- **WHEN** the areas are chosen
- **THEN** the dispatched command names those areas and the layout already answered for

#### Scenario: the reader backs out of the area prompt
- **WHEN** nothing is chosen
- **THEN** nothing is dispatched and nothing is written

### The Living Specs view offers a one-pass sync action

The Living Specs view's title bar SHALL carry a sync action that dispatches the living-spec sync command through the active AI provider, following the same dispatch path and companion-install gating as the adoption action. The action itself performs no grouping or file edits — the dispatched command owns the work.

#### Scenario: the action is triggered
- **WHEN** the user triggers the sync title action with the companion extension installed
- **THEN** the sync slash command is dispatched to the AI provider and nothing is edited by the extension itself

### The status bar names the living specs for the active file and reaches one requirement

A status bar item SHALL show how many living specs claim the active editor's file, hidden when the count is zero, when living specs are off, and when the editor holds no workspace file. Activating it SHALL list the claiming capabilities with their matching requirements, and choosing one SHALL open that capability's spec positioned on that requirement.

#### Scenario: the active editor changes to an unclaimed file
- **WHEN** the indicator refreshes
- **THEN** it is hidden rather than showing a zero

## Uncovered

- All files under `__tests__/` were listed but not read.

### A capability with no spec file opens to the call to adopt it

A registered capability whose spec file does not exist yet SHALL still open from its row. The viewer SHALL show only one call to action, "Adopt this area", which starts adoption of the directories that capability already claims without asking for them again. A spec file that exists but is empty is not missing and SHALL NOT show it. The view's commands SHALL include one that validates living-spec shape through the active AI provider, scoped to the capability it was invoked from, and to every living spec when invoked from nowhere in particular.

#### Scenario: the reader clicks a capability marked not created
- **WHEN** the viewer opens
- **THEN** it shows "Adopt this area" and no cards

#### Scenario: the reader picks Adopt this area
- **WHEN** adoption starts
- **THEN** it adopts the capability's own directories without asking which

#### Scenario: Validate is pressed in an open capability
- **WHEN** the check is dispatched
- **THEN** it names that capability
