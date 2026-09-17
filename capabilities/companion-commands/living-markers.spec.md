# Living-Spec Markers — Living Spec

## Purpose

Markers under a requirement heading say which files it describes, which rule elsewhere constrains it, and whether anything has confirmed it, so a run is briefed on the right things. This capability covers who writes them, how readers find them, and what a capability's membership needs for them to resolve.

## Requirements

### Adoption and sync write the file markers, so nobody maintains them by hand

Adoption SHALL write a marker under each requirement it produces, naming the files it was derived from. A sync SHALL write or widen the marker of each requirement it updates to the union of its existing files and the files it folded in, and MUST never narrow it, since narrowing can cost a run a needed requirement.

#### Scenario: a capability is adopted
- **WHEN** its requirements are written
- **THEN** each carries a marker naming the files it was derived from

#### Scenario: a sync updates a requirement
- **WHEN** the update is written
- **THEN** that requirement's marker names the changed files as well as what it already named

#### Scenario: fold-back rewrites a requirement that already carries a marker
- **WHEN** the delta replaces that requirement's section
- **THEN** the marker survives the replacement, widened by anything the delta names, because a plain replacement of the span would discard what adoption wrote

### A fold carries every marker across, not only the one it knows about

A fold SHALL carry the `aligns` edge across the same way it carries `touches`, because a delta carries no markers of its own. No file match can reach an edge, so a dropped one silently makes the capability unreachable.

#### Scenario: a feature folds onto a requirement carrying an edge
- **WHEN** the fold rewrites that requirement
- **THEN** the edge is still there afterwards

### Adoption proposes the links between capabilities, because only it can see them

Adoption SHALL propose an `aligns` marker where the code shows a rule under another capability constraining the behaviour, such as a guard, check or redirect, and show the developer both headings side by side before writing. The marker is matched by heading text, so a proposal MUST name a heading that exists. A mistyped heading reads as a working edge and loads nothing.

#### Scenario: a behaviour is guarded by a rule under another capability
- **WHEN** adoption drafts the requirement
- **THEN** it proposes the edge, naming the other capability and the exact heading, for the developer to confirm

#### Scenario: nothing in the code shows the constraint
- **WHEN** adoption drafts the requirement
- **THEN** it proposes no edge, because an invented one costs every later run a wasted read

### A capability's membership must reach the files its own requirements name

Adoption SHALL name the code a behaviour is implemented in, not the surface it was found through. Validation SHALL report a capability whose requirements all name files outside its own membership globs, because such a capability resolves to nothing and nothing else catches it.

#### Scenario: adoption names the page instead of the implementation
- **WHEN** the specs are validated
- **THEN** the capability is reported, naming a requirement's files and the membership that excludes them

#### Scenario: the membership is broader than the requirement
- **WHEN** a capability claims a parent directory of the files its requirements name
- **THEN** nothing is reported, because the resolver reaches them

#### Scenario: a capability claims an area no requirement describes
- **WHEN** the specs are validated
- **THEN** that area is reported, because a change there resolves the capability and is handed nothing

#### Scenario: one requirement carries no marker
- **WHEN** a capability claims an area no marked requirement describes
- **THEN** nothing is reported, because an unmarked requirement is always contributed

#### Scenario: several capabilities claim the same membership
- **WHEN** they split one area's behaviour between them
- **THEN** none is reported, because whether a file is described is a question about the group

The registry's exempt list applies here too, so a capability is not asked to describe its own test folder.

### Both readers of a spec must agree on where a marker can sit

Every reader of a living spec SHALL skip blank lines between a heading and its marker, since formatters insert one. A reader that stops at the line directly under the heading is a defect: the spec silently reads as unmarked, so validation passes and a load reads the whole file.

#### Scenario: a formatter separates a heading from its marker
- **WHEN** the spec is read
- **THEN** the marker is found, and every check that depends on it runs
