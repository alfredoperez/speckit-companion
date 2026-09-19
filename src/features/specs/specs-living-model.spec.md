# Specs Living Model — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Reads the living-specs registry and parses spec files inside the extension process: which capability claims a file, which requirements mark it, and whether a saved spec has a shape the pipeline can update. The editor never shells out to spec-kit scripts it cannot assume are installed.

## Requirements

### A source file reports the living specs that claim it, in the editor's own process

For a workspace-relative path, the extension SHALL resolve the claiming capabilities most-specific first, honouring exclusions and the registry's exempt list, plus each one's requirements whose marker matches the path. A changed file named by a requirement in one capability SHALL drift that capability alone, not a sibling that claims it only by glob. Resolution SHALL run in the extension process, never by dispatching a command, and use the resolver's specificity order.

#### Scenario: two capabilities claim one file
- **WHEN** the claims for that file are resolved
- **THEN** the more specific capability is first

#### Scenario: the file is exempt
- **WHEN** the path matches the registry's exempt globs
- **THEN** no capability claims it

#### Scenario: a claiming capability has no spec file
- **WHEN** its claims are resolved
- **THEN** the capability still appears with no requirements, so the claim is not lost

#### Scenario: two capabilities share a folder and one requirement names the changed file
- **WHEN** drift is computed for both
- **THEN** only the capability whose requirement names it is drifted

### Requirement slicing lives beside the requirement-id parser and counts the same headings

The extension SHALL slice a living spec into requirements (heading, optional markers, body) beside the requirement-id parser, stripping fenced blocks by the same rule. Both parsers SHALL count requirements across the whole document, not within a section, because fold-back appends past the uncovered-files section. A requirement's markers (`touches`, `adopted`, `aligns`) are the run of marker lines starting at the first non-blank line under its heading, in any order with blank lines among them, ending at the first non-marker line, and all are stripped from the body. Both runtimes' parsers SHALL share one fixture set, and a fixture exercised by only one SHALL fail the build.

#### Scenario: a heading inside a fenced block
- **WHEN** either parser reads the spec
- **THEN** it is not a requirement, in both runtimes

#### Scenario: a requirement appended past the uncovered-files section
- **WHEN** either parser reads the spec
- **THEN** it is a requirement like any other

#### Scenario: a requirement whose prose carries a fenced example
- **WHEN** either parser slices it
- **THEN** the example stays in the body, because fences only decide where a heading is

#### Scenario: the marker line itself
- **WHEN** either parser slices a marked requirement
- **THEN** the marker is not part of the body

#### Scenario: a markdown formatter puts a blank line between the heading and the marker
- **WHEN** either parser slices the requirement
- **THEN** the marker is still read, so a reformat never drops a requirement's file list

#### Scenario: a marker further down in the prose
- **WHEN** either parser slices the requirement
- **THEN** it is body, because a spec may discuss what a marker looks like

#### Scenario: a marker that names no file
- **WHEN** either parser reads a marker whose glob list is empty
- **THEN** the requirement reads as unmarked, so an empty marker widens the load instead of narrowing it to nothing

#### Scenario: a fixture is added
- **WHEN** only one runtime's suite exercises it
- **THEN** the drift guard fails

### Drift is the code a run never accounted for
<!-- touches: src/features/specs/livingSpecsModel.ts -->

A capability SHALL drift on files changed under its globs with no run standing behind them. Drift SHALL discount every file a completed run recorded for this capability, whether folded into the spec or explicitly skipped, and a hand-edited file with no run behind it still drifts. The capability's own spec and tier files, project exemptions, and excluded globs are discounted too. When the change list cannot be read, drift stays absent, not empty.

#### Scenario: a run folded a change into this capability
- **WHEN** drift is next computed
- **THEN** the files that run recorded do not read as drift

#### Scenario: a run skipped this capability on purpose
- **WHEN** drift is next computed
- **THEN** its files are discounted too

#### Scenario: a claimed file is edited outside any run
- **WHEN** drift is next computed
- **THEN** the capability reads as drifted

### The editor checks a spec's shape on save, in its own process
<!-- touches: src/features/specs/specShapeCheck.ts, src/features/specs/specShapeDiagnostics.ts -->

On saving a `*.spec.md`, the extension SHALL run the living-spec shape checks and publish each finding at its line, clearing it once fixed. The checks SHALL run in the extension's own process, not via spec-kit scripts, which the package cannot assume are installed. Both runtimes' checks SHALL share one set of example specs, and an example exercised by only one SHALL fail the build. Nothing SHALL be checked for a non-spec file or a project without living specs enabled.

#### Scenario: a spec is saved with a scenario missing its outcome
- **WHEN** the save completes
- **THEN** a problem appears against that file on the scenario's line

#### Scenario: the problem is fixed and the file saved again
- **WHEN** the check re-runs
- **THEN** the problem is gone, because findings are replaced rather than the entry deleted

#### Scenario: a file that is not a spec file is saved
- **WHEN** the save completes
- **THEN** nothing is checked and no problem appears

#### Scenario: the document's workspace folder goes away
- **WHEN** the check next runs for it
- **THEN** anything already published for that document is cleared

#### Scenario: a scenario's bullets are written as an ordered or plus-prefixed list
- **WHEN** the shape is checked
- **THEN** both halves are recognised, since bullet style is not a shape error

### The registry carries a capability's retirement declaration
<!-- touches: src/features/specs/livingSpecsModel.ts -->

The registry reader SHALL carry each capability's optional retirement declaration onto the resolved capability, defaulting to false, so both runtimes read the registry the same way.

#### Scenario: a capability omits the declaration
- **WHEN** the registry is read
- **THEN** it resolves as not retiring

### Requirement links are computed in-process over the requirement slicer

`requirementLinks` SHALL read every registered capability's spec through `requirementSlices` and return, per heading, the requirement's own aligns links marked resolved or broken, and the requirements in other capabilities that align to it. Headings match exactly, and requirements sharing a heading share their lists. The cards and the Remove refusal SHALL both read this one function.

#### Scenario: a requirement aligns to itself
- **WHEN** its links are computed
- **THEN** the self-link appears under Leans on and not under Leaned on by

#### Scenario: a link names an unregistered capability
- **WHEN** its links are computed
- **THEN** that link is marked broken with no spec path

### The capability tree groups by folder and labels its rows as words

A folder holding two or more capability specs SHALL be its own group, and a folder holding one SHALL collapse into its leaf. Group and leaf labels SHALL read as words, from the one naming rule the viewer's Overview also uses. Leaves in one group SHALL drop the leading words every sibling shares, keeping at least one word. The exact capability name stays on the leaf.

#### Scenario: eight specs share one folder and one leading word
- **WHEN** the tree is built
- **THEN** the folder is one group and each leaf label omits the shared word

#### Scenario: a folder holds a single spec
- **WHEN** the tree is built
- **THEN** the folder is not a group and the leaf sits under its parent

### Per-requirement coverage joins on the requirement key and checks the named files

The extension SHALL read a capability's coverage file into a label per requirement, joining a coverage line to a requirement by its key or by an id its heading carries, and giving a line that names several headings to the longest. A line counts only when it names a test file, and each named path SHALL be confirmed to exist inside the workspace, a path outside it counting as not found. The label SHALL be built from the two counts alone, never from file text, and the whole map SHALL be absent when no line names a test or the file cannot be read.

#### Scenario: a line names two tests and one is missing
- **WHEN** the coverage file is read
- **THEN** the requirement's label reads `1/2 tests`

#### Scenario: a named test path escapes the workspace
- **WHEN** the coverage file is read
- **THEN** that path counts as not found

## Uncovered

- All files under `__tests__/` were listed but not read.
