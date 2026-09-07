# Specs Living Specs — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The living-specs surfaces inside the editor: the registry listing, its sync and update actions, the requirement parser, save-time shape checks, and the status bar that names which specs claim the active file.

## Requirements

### Living-spec listings are read-only, bounded, and honest about what they could not compute

The living-specs listing SHALL read the project's capability configuration without executing any project tooling, resolving each capability's document path and confining every resolved path to the workspace. [inferred] — how the listing is *presented* as tree rows is taken from the model and command surfaces; the view provider itself was not read. Derived health — coverage counts, drift — MUST be reported as *absent* when it cannot be computed, never as zero or false: a missing count and a genuine zero mean opposite things to a reader. Any external call it makes to compute health MUST be time-bounded.

#### Scenario: a capability's document has never been committed
- **WHEN** drift is computed
- **THEN** drift is reported as unknown rather than as "no drift"

#### Scenario: a configured document path points outside the workspace
- **WHEN** the listing resolves it
- **THEN** the entry is dropped rather than read

A drifted row SHALL differ from a healthy one by icon *shape*, not by tint alone, and its tooltip names the repair. The repair — update to match code — SHALL be an inline hover action on the row and remain in the context menu. Refresh, which redraws the tree, and the actions that dispatch an AI run and rewrite spec files SHALL NOT share a glyph. The per-capability drift check resolves a capability from its spec path the same way update does, so a viewer that only knows the path can scope it.

#### Scenario: a capability has drifted
- **WHEN** the reader hovers its row
- **THEN** the update action is on the row, and still in the right-click menu

### The Living Specs view offers a one-pass sync action

The Living Specs view's title bar SHALL carry a sync action that dispatches the living-spec sync command through the active AI provider, following the same dispatch path and companion-install gating as the adoption action. The action itself performs no grouping or file edits — the dispatched command owns the work.

#### Scenario: the action is triggered
- **WHEN** the user triggers the sync title action with the companion extension installed
- **THEN** the sync slash command is dispatched to the AI provider and nothing is edited by the extension itself

### Requirement slicing lives beside the requirement-id parser and counts the same headings

The extension SHALL parse a living spec into requirement slices — heading, optional file marker, body — next to the existing requirement-id parser, stripping fenced blocks with the same rule so an example in a snippet is never counted. Both parsers SHALL count requirements across the whole document rather than within a named section: fold-back appends to the end of the file, so a spec that has been folded into more than once carries requirements past its uncovered-files section, and scoping the slicer to a section is precisely how it comes to see fewer requirements than the denominator counts. The parser exists in two runtimes because neither can call the other, so both SHALL be held to one shared set of fixtures, and a fixture exercised by only one of them SHALL fail the build.

#### Scenario: a heading inside a fenced block
- **WHEN** either parser reads the spec
- **THEN** it is not a requirement, in both runtimes

#### Scenario: a requirement appended past the uncovered-files section
- **WHEN** either parser reads the spec
- **THEN** it is a requirement like any other, because where fold-back put it says nothing about whether it is one

#### Scenario: a requirement whose prose carries a fenced example
- **WHEN** either parser slices it
- **THEN** the example is still in the body, because fences decide where a heading is and must never be removed from what a reader is handed

#### Scenario: the marker line itself
- **WHEN** either parser slices a marked requirement
- **THEN** the marker is not part of the body, since handing parser metadata to a reader as prose is a leak rather than a fact about the requirement

#### Scenario: a marker that names no file
- **WHEN** either parser reads a marker whose glob list is empty
- **THEN** the requirement reads as unmarked, so an empty marker widens the load rather than narrowing it to nothing

#### Scenario: a fixture is added
- **WHEN** only one runtime's suite exercises it
- **THEN** the drift guard fails, because that is a case where the two are free to disagree

### The editor checks a spec's shape on save, in its own process
<!-- touches: src/features/specs/specShapeCheck.ts, src/features/specs/specShapeDiagnostics.ts -->

The extension SHALL run the living-spec shape checks whenever a `*.spec.md` is saved and publish each finding against that file at its line, clearing them when the underlying problem is fixed. The checks SHALL run in the extension's own process rather than by invoking the spec-kit scripts: the shipped extension is only what is in its package and cannot assume those scripts are installed, and a subprocess in the save path is a cost paid on every write. That makes the checks exist in two runtimes, so both SHALL be held to one shared set of example specs and an example exercised by only one of them SHALL fail the build. Nothing SHALL be checked for a file that is not a spec file, or for a project that has not enabled living specs.

#### Scenario: a spec is saved with a scenario missing its outcome
- **WHEN** the save completes
- **THEN** a problem appears against that file on the scenario's line

#### Scenario: the problem is fixed and the file saved again
- **WHEN** the check re-runs
- **THEN** the problem is gone, because the findings are replaced rather than the entry deleted

#### Scenario: a file that is not a spec file is saved
- **WHEN** the save completes
- **THEN** nothing is checked and no problem appears

#### Scenario: the document's workspace folder goes away
- **WHEN** the check next runs for it
- **THEN** anything already published for that document is cleared, since nothing else will clear it

#### Scenario: a scenario's bullets are written as an ordered or plus-prefixed list
- **WHEN** the shape is checked
- **THEN** both halves are recognised, because refusing a whole capability over a markdown bullet style is a formatting preference with teeth rather than a check

### The registry carries a capability's retirement declaration
<!-- touches: src/features/specs/livingSpecsModel.ts -->

The registry reader SHALL carry each capability's optional retirement declaration onto the resolved capability, defaulting to false when absent, so both runtimes read the same registry the same way.

#### Scenario: a capability omits the declaration
- **WHEN** the registry is read
- **THEN** it resolves as not retiring, which is every capability that never says otherwise

### A source file reports the living specs that claim it, in the editor's own process

The extension SHALL resolve, for a workspace-relative path, the capabilities whose membership globs claim it — most-specific first, honouring exclusions and the registry's exempt list — and the requirements of each whose marker matches that path. The resolution SHALL happen in the extension process, never by dispatching a command, and SHALL order capabilities by the same specificity rule the resolver uses.

#### Scenario: two capabilities claim one file
- **WHEN** the claims for that file are resolved
- **THEN** the more specific capability is first

#### Scenario: the file is exempt
- **WHEN** the path matches the registry's exempt globs
- **THEN** no capability claims it

#### Scenario: a claiming capability has no spec file
- **WHEN** its claims are resolved
- **THEN** the capability still appears with no requirements, so the claim is not lost

### The status bar names the living specs for the active file and reaches one requirement

A status bar item SHALL show how many living specs claim the active editor's file, hidden when the count is zero, when living specs are off, and when the editor holds no workspace file. Activating it SHALL list the claiming capabilities with their matching requirements, and choosing one SHALL open that capability's spec positioned on that requirement.

#### Scenario: the active editor changes to an unclaimed file
- **WHEN** the indicator refreshes
- **THEN** it is hidden rather than showing a zero

## Uncovered

- `livingSpecsExplorerProvider.ts` — not read; its contract is inferred here from `livingSpecsModel.ts` and `livingSpecsCommands.ts`.
- All files under `__tests__/` were listed but not read.
