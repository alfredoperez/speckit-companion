# Specs Living Model — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

This capability reads the living-specs registry and parses spec files inside the extension process: which capability claims a file, which requirements mark it, and whether a saved spec has the shape the pipeline can update. Without it the editor would have to shell out to spec-kit scripts it cannot assume are installed.

## Requirements

### A source file reports the living specs that claim it, in the editor's own process

The extension SHALL resolve, for a workspace-relative path, the capabilities whose membership globs claim it — most-specific first, honouring exclusions and the registry's exempt list, and the requirements of each whose marker matches that path. Drift SHALL follow the same rule: a changed file that a requirement in one capability names drifts that capability alone, and a sibling claiming the file only through a glob stays in sync for it. The resolution SHALL happen in the extension process, never by dispatching a command, and SHALL order capabilities by the same specificity rule the resolver uses.

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

The extension SHALL parse a living spec into requirement slices — heading, optional markers, body — next to the existing requirement-id parser, stripping fenced blocks with the same rule so an example in a snippet is never counted. Both parsers SHALL count requirements across the whole document rather than within a named section: fold-back appends to the end of the file, so a spec that has been folded into more than once carries requirements past its uncovered-files section, and scoping the slicer to a section is precisely how it comes to see fewer requirements than the denominator counts. A requirement's markers are the run of marker lines under its heading, in any order and with blank lines among them — the file list a requirement `touches`, the `adopted` note saying where adoption transcribed the requirement from and that nothing has confirmed it yet, and the `aligns` references naming rules under other capabilities. Requiring the marker on the line immediately after the heading is what a markdown formatter breaks, so the run starts at the first non-blank line and ends at the first line that is not a marker; every marker in it is stripped from the body. The parser exists in two runtimes because neither can call the other, so both SHALL be held to one shared set of fixtures, and a fixture exercised by only one of them SHALL fail the build.

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

#### Scenario: a markdown formatter puts a blank line between the heading and the marker
- **WHEN** either parser slices the requirement
- **THEN** the marker is still read, because a requirement must not silently lose its file list to a reformat

#### Scenario: a marker further down in the prose
- **WHEN** either parser slices the requirement
- **THEN** it is body, because a spec may legitimately discuss what a marker looks like

#### Scenario: a marker that names no file
- **WHEN** either parser reads a marker whose glob list is empty
- **THEN** the requirement reads as unmarked, so an empty marker widens the load rather than narrowing it to nothing

#### Scenario: a fixture is added
- **WHEN** only one runtime's suite exercises it
- **THEN** the drift guard fails, because that is a case where the two are free to disagree

### Drift is the code a run never accounted for
<!-- touches: src/features/specs/livingSpecsModel.ts -->

A capability drifts on the files that changed under its globs without a run standing behind them. The drift computation SHALL discount every file a completed run recorded while accounting for this capability — whether the run folded the change into the spec or recorded an explicit skip — because either is the run vouching that the spec still describes that code. A file edited by hand, with no run behind it, still drifts. The capability's own spec and tier files, the project's exemptions, and its excluded globs are discounted as before, and when the change list cannot be read at all drift stays absent rather than empty.

#### Scenario: a run folded a change into this capability
- **WHEN** drift is next computed
- **THEN** the files that run recorded do not read as drift, because the spec has already been brought level with them

#### Scenario: a run skipped this capability on purpose
- **WHEN** drift is next computed
- **THEN** its files are discounted too, since a deliberate skip is a decision about the spec rather than an omission

#### Scenario: a claimed file is edited outside any run
- **WHEN** drift is next computed
- **THEN** the capability reads as drifted, which is the whole point of the check

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

## Uncovered

- All files under `__tests__/` were listed but not read.
