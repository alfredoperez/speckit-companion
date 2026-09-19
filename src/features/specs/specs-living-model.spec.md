# Specs Living Model — Living Spec

## Purpose

Reads the living-specs registry and spec files inside the extension process: which capability claims a file, which requirements mark it, what drifted, and whether a saved spec has a shape the pipeline can update. The editor never shells out to spec-kit scripts it cannot assume are installed.

## Requirements

### A source file reports the living specs that claim it, in the editor's own process

For a workspace-relative path, the extension SHALL list the capabilities that claim it, most specific first, honouring exclusions and the registry's exempt list, with each one's requirements whose marker matches the path. It resolves this in its own process, so it works without spec-kit installed.

#### Scenario: two capabilities claim one file
- **WHEN** the claims for that file are resolved
- **THEN** the more specific capability is first

#### Scenario: the file is exempt
- **WHEN** the path matches the registry's exempt globs
- **THEN** no capability claims it

#### Scenario: a claiming capability has no spec file
- **WHEN** its claims are resolved
- **THEN** the capability still appears with no requirements, so the claim is not lost

### A file one capability's requirement names drifts only that capability

When capabilities share a folder, a changed file named by a requirement in one of them SHALL drift that capability alone, not a sibling that claims it only by glob.

#### Scenario: two capabilities share a folder and one requirement names the changed file
- **WHEN** drift is computed for both
- **THEN** only the capability whose requirement names it is drifted

### Requirement slicing lives beside the requirement-id parser and counts the same headings

The extension and the spec-kit scripts SHALL find the same requirements in a spec: every requirement heading in the document, including ones appended after the uncovered-files section, and none inside a fenced block. Both share one fixture set, and a fixture only one of them exercises fails the build.

#### Scenario: a heading inside a fenced block
- **WHEN** either runtime reads the spec
- **THEN** it is not a requirement

#### Scenario: a requirement appended past the uncovered-files section
- **WHEN** either runtime reads the spec
- **THEN** it is a requirement like any other

#### Scenario: a fixture is added
- **WHEN** only one runtime's suite exercises it
- **THEN** the drift guard fails

### A requirement's markers are the lines directly under its heading

A requirement's `touches`, `adopted` and `aligns` markers SHALL be the run of marker lines starting at the first non-blank line under its heading, in any order, and are not part of its body. A marker line further down is prose.

#### Scenario: a formatter puts a blank line between the heading and the marker
- **WHEN** the requirement is read
- **THEN** the marker is still read, so a reformat never drops a requirement's file list

#### Scenario: a marker further down in the prose
- **WHEN** the requirement is read
- **THEN** it is body, because a spec may discuss what a marker looks like

#### Scenario: a marker that names no file
- **WHEN** a marker's glob list is empty
- **THEN** the requirement reads as unmarked, so an empty marker widens the load instead of narrowing it to nothing

### Drift is the code a run never accounted for
<!-- touches: src/features/specs/livingSpecsModel.ts -->

A capability SHALL drift on files changed under its globs with no run behind them. Every file a completed run recorded for this capability, whether folded into the spec or skipped on purpose, is discounted, as are the capability's own spec files, exemptions and excluded globs. When the change list cannot be read, drift is unknown, not empty.

#### Scenario: a run folded or skipped a change for this capability
- **WHEN** drift is next computed
- **THEN** the files that run recorded do not read as drift

#### Scenario: a claimed file is edited outside any run
- **WHEN** drift is next computed
- **THEN** the capability reads as drifted

### The editor checks a spec's shape on save, in its own process
<!-- touches: src/features/specs/specShapeCheck.ts, src/features/specs/specShapeDiagnostics.ts -->

On saving a `*.spec.md` in a project with living specs enabled, the extension SHALL publish each shape finding as a problem at its line and clear it once fixed. The extension and the spec-kit scripts check against one shared set of example specs, and an example only one of them exercises fails the build.

#### Scenario: a spec is saved with a scenario missing its outcome
- **WHEN** the save completes
- **THEN** a problem appears against that file on the scenario's line

#### Scenario: the problem is fixed and the file saved again
- **WHEN** the check re-runs
- **THEN** the problem is gone

#### Scenario: a scenario's bullets are written as an ordered or plus-prefixed list
- **WHEN** the shape is checked
- **THEN** no problem is reported, since bullet style is not a shape error

### Requirement links are computed in-process over the requirement slicer

For each requirement, the extension SHALL report its own `aligns` links, each marked resolved or broken, and the requirements in other capabilities that align to it. Headings match exactly. The requirement cards and the Remove refusal read this same answer.

#### Scenario: a requirement aligns to itself
- **WHEN** its links are computed
- **THEN** the self-link appears under Leans on and not under Leaned on by

#### Scenario: a link names an unregistered capability
- **WHEN** its links are computed
- **THEN** that link is marked broken

### Per-requirement coverage joins on the requirement key and checks the named files

A coverage line SHALL count only the test files it names that exist inside the workspace, and the label is built from those counts alone. When no line names a test, or the coverage file cannot be read, there are no labels at all.

#### Scenario: a line names two tests and one is missing
- **WHEN** the coverage file is read
- **THEN** the requirement's label reads `1/2 tests`

#### Scenario: a named test path escapes the workspace
- **WHEN** the coverage file is read
- **THEN** that path counts as not found

### The editor refuses exactly the registry the runtime refuses

A registry the spec-kit scripts cannot read SHALL be refused by the editor too, with the reason and the line at fault shown in the Living Specs view rather than only in a terminal.

#### Scenario: a registry uses YAML the runtime cannot read
- **WHEN** it contains an anchor, a block scalar, a tab indent or a second document
- **THEN** the Living Specs view shows it cannot read the registry and names the line

#### Scenario: a registry both readers accept
- **WHEN** the file stays inside the supported subset
- **THEN** its capabilities load as before

## Uncovered

- All files under `__tests__/` were listed but not read.
