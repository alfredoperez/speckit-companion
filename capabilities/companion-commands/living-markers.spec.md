# Living-Spec Markers — Living Spec

## Purpose

The markers under a requirement heading are what let a run be briefed on the right things: which files a requirement describes, which rule elsewhere constrains it, and whether anything has confirmed it yet. This capability covers who writes them, what has to agree about reading them, and what must be true of a capability's membership for them to resolve at all.

## Requirements

### Adoption and sync write the file markers, so nobody maintains them by hand

Adoption SHALL write a marker under each requirement it produces, naming the files that requirement was derived from. A sync SHALL write or widen the marker of each requirement it updates, as the union of what the marker already named and the files it folded in — never narrowing, since a requirement that keeps claiming a file it no longer touches costs a run one extra requirement, where narrowing could cost it a needed one.

#### Scenario: a capability is adopted
- **WHEN** its requirements are written
- **THEN** each carries a marker naming the files it was derived from

#### Scenario: a sync updates a requirement
- **WHEN** the update is written
- **THEN** that requirement's marker names the changed files as well as what it already named

#### Scenario: fold-back rewrites a requirement that already carries a marker
- **WHEN** the delta replaces that requirement's section
- **THEN** the marker survives the replacement, widened by anything the delta names, because the span being replaced covers the marker line and a plain replacement would silently discard what adoption wrote

### A fold carries every marker across, not only the one it knows about

A delta comes from a feature spec and carries no markers of its own, so a marker survives a fold only by being carried across deliberately. The `aligns` edge SHALL be carried the same way `touches` is. It is the marker that most needs it and the one least likely to be missed: no file match can reach an edge, so it would be deleted the first time any feature folded onto that requirement and nothing would ever notice — the capability would simply stop being reachable, silently, exactly as if the edge had never been written.

#### Scenario: a feature folds onto a requirement carrying an edge
- **WHEN** the fold rewrites that requirement
- **THEN** the edge is still there afterwards

### Adoption proposes the links between capabilities, because only it can see them

A requirement's `aligns` marker names a rule under another capability that constrains this behaviour, and nobody writes those by hand: at the moment you are editing one capability you cannot see what governs it from elsewhere. Adoption reads a whole area in one pass and SHALL propose these where the code shows the constraint — a guard, a check, a redirect that a rule elsewhere explains — bringing each to the developer with both headings side by side before writing. The marker is matched by heading text, so a proposal MUST name a heading that exists: a mistyped one is a dead link that reads as a working edge and sends every future run to load nothing.

#### Scenario: a behaviour is guarded by a rule under another capability
- **WHEN** adoption drafts the requirement
- **THEN** it proposes the edge, naming the other capability and the exact heading, for the developer to confirm

#### Scenario: nothing in the code shows the constraint
- **WHEN** adoption drafts the requirement
- **THEN** it proposes no edge, because an invented one costs every later run a wasted read

### A capability's membership must reach the files its own requirements name

A capability's match globs are what the resolver uses to claim a file, so a capability whose globs never reach the code its requirements describe resolves to nothing: a change in that area is told about no capability at all, and the run proceeds as if nothing had been written down. Adoption SHALL therefore name the code a behaviour is implemented in rather than the surface it was found through — a capability discovered through a page usually lives elsewhere — and validation SHALL report a capability whose every requirement names files outside its own membership. Both halves are individually valid in that case, the requirement's files exist and the capability's glob matches files too, which is why nothing else catches it.

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

The registry's own exempt list applies here as it does everywhere else, so a capability spanning its own test folder is not asked to describe it.

### Both readers of a spec must agree on where a marker can sit

A marker may sit under a blank line: a formatter puts one between a heading and its comment. Every reader of a living spec SHALL skip blank lines when looking for one, and a reader that stops at the line directly under the heading is a defect, not a strictness. It fails silently and in the safe-looking direction — the spec reads as carrying no markers, so a validator passes it and a load quietly falls back to reading the file whole. This has shipped twice: once in the resolver as #690, and once in the validator, where it left both membership checks above dead on every formatted spec in the repository that had them.

#### Scenario: a formatter separates a heading from its marker
- **WHEN** the spec is read
- **THEN** the marker is found, and every check that depends on it runs
