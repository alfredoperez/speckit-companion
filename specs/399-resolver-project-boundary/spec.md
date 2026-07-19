# Feature Specification: Living-spec resolution stops at nested project boundaries

**Feature Branch**: `399-resolver-project-boundary`
**Created**: 2026-07-19
**Status**: Draft
**Input**: Issue #455 — "Resolver descends into nested projects, inventing capabilities and false orphans"

## User Scenarios & Testing

### User Story 1 - A repo with sample projects reports only its own specs (Priority: P1)

A maintainer keeps living specs turned on at the root of a repository that also contains self-contained sample projects and test sandboxes. Each of those samples carries its own project configuration and describes its own capabilities. When the maintainer asks which living specs exist and which are unclaimed, the answer covers only the root project. The samples are separate projects and answer for themselves.

**Why this priority**: This is the reported defect and the one that makes the tool's output untrustworthy. Every other problem in the report is a symptom of the missing boundary.

**Independent Test**: Turn living specs on at a root that contains a nested project with its own configuration and its own living spec file. Ask for unclaimed specs. The nested project's file must not appear.

**Acceptance Scenarios**:

1. **Given** a root project with living specs on and a nested directory that has its own project configuration, **When** unclaimed specs are listed, **Then** no file from inside the nested directory is listed.
2. **Given** the same setup, **When** the full inventory is requested, **Then** no capability is invented from a file inside the nested directory.
3. **Given** a living spec that sits in the root project and belongs to no capability, **When** unclaimed specs are listed, **Then** it is still reported — the boundary narrows the scan, it does not silence real findings.
4. **Given** a nested project several directories deep, **When** either listing runs, **Then** the boundary applies at whatever depth the nested configuration appears.

### User Story 2 - Opting a project out means nothing happens to it (Priority: P1)

A sandbox project is deliberately configured with living specs switched off. A scan run from the parent repository treats that choice as final: nothing inside the opted-out project is inspected, claimed, reported, or promoted into a capability.

**Why this priority**: An explicit opt-out that still produces output is worse than no opt-out at all — it teaches maintainers they cannot trust the switch.

**Independent Test**: Place a living spec file inside a nested project whose configuration switches the feature off. Run both listings from the parent. Neither mentions the file.

**Acceptance Scenarios**:

1. **Given** a nested project whose configuration switches living specs off, **When** unclaimed specs are listed from the parent, **Then** files inside it are absent.
2. **Given** the same project, **When** the full inventory is requested from the parent, **Then** no capability is derived from anything inside it.
3. **Given** the root project's own configuration switches living specs off, **When** any listing runs, **Then** the result is empty, exactly as today.

### User Story 3 - The inventory never contradicts itself (Priority: P2)

A maintainer compares the full inventory against the unclaimed list. A file appears in at most one of them. Nothing is presented as both a known capability and an unaccounted-for file.

**Why this priority**: The contradiction is what makes the output unusable for review, but it disappears on its own once the boundary lands. It is called out separately so it is verified rather than assumed.

**Independent Test**: Run both listings against the same project and intersect the file paths they report. The intersection is empty.

**Acceptance Scenarios**:

1. **Given** any project state, **When** the full inventory and the unclaimed list are produced, **Then** no file path appears in both.
2. **Given** a genuinely unclaimed living spec in the root project, **When** the full inventory runs, **Then** it appears once in the inventory and once in the unclaimed list of that same combined result, which is the documented shape — the contradiction being ruled out is a file claimed as a *configured* capability while also reported unclaimed.

### User Story 4 - Two discovered specs never claim the same name (Priority: P2)

When the inventory includes specs discovered on disk rather than declared in configuration, each entry has a distinguishable name. Two files in similarly-named folders do not both surface under one identity.

**Why this priority**: Names are the identity other steps use to refer to a capability. Two entries sharing one name silently makes one of them unreachable.

**Independent Test**: Place two unclaimed living specs in like-named folders inside the root project. Request the inventory. Each entry is individually addressable.

**Acceptance Scenarios**:

1. **Given** two unclaimed living specs whose parent folders share a name, **When** the inventory is produced, **Then** the two entries do not carry the same name.
2. **Given** a discovered name that collides with a configured capability's name, **When** the inventory is produced, **Then** the configured capability keeps its name unchanged.

## Edge Cases

- A nested project's configuration file exists but is empty or unreadable — the directory is still a project boundary; a project that declares itself is not descended into merely because its declaration is malformed.
- A nested configuration exists but declares no living-specs settings at all — treated as switched off, so nothing inside it is reported.
- The root project's own configuration must never be mistaken for a nested boundary that excludes the entire repository.
- A nested project sits inside a directory that a configured capability already claims — the boundary still wins; the nested project owns its own files.
- Nested projects inside nested projects — the outermost boundary already stops the scan, so deeper ones are never reached.
- No nested projects anywhere — behavior is byte-for-byte what it is today.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST treat any directory below the scan root that contains a project configuration file as a separate project and MUST NOT descend into it when discovering living-spec files.
- **FR-002**: The boundary rule MUST apply identically to the unclaimed-specs listing and to the full-inventory listing, so the two cannot disagree about which files exist.
- **FR-003**: The scan root's own project configuration MUST NOT be treated as a boundary against itself.
- **FR-004**: A nested project whose configuration switches living specs off MUST contribute nothing to any listing — no unclaimed entries and no discovered capabilities.
- **FR-005**: A nested project's configuration that cannot be read or parsed MUST still establish a boundary rather than allowing the scan to descend.
- **FR-006**: No file path may appear both as a configured capability's claimed spec and as an unclaimed file in the same run.
- **FR-007**: Discovered entries in the full inventory MUST each carry a distinct name, and a discovered entry MUST NOT take a name already used by a configured capability. A discovered spec at the scan root MUST be named after the file without its living-spec suffix.
- **FR-011**: The sidebar's Living Specs view MUST apply the same boundary rule as the resolver, so the editor listing and the command-line listing cannot disagree about which files belong to the project.
- **FR-008**: Behavior for a project with no nested project configurations MUST be unchanged from today, including the existing exclusions for feature specs and reserved sibling tiers.
- **FR-009**: Regression tests MUST cover the boundary stop, the switched-off nested project, the agreement between the two listings, and the name-collision rule.
- **FR-010**: The change MUST be recorded as a user-facing entry under the unreleased section of the spec-kit extension's changelog, and the extension's documentation MUST describe the boundary rule where the discovery behavior is documented.

## Key Entities

- **Scan root**: the project the listing is being produced for. Owns a configuration and a set of capabilities.
- **Nested project**: any directory below the scan root that carries its own project configuration. It is out of scope for the root's listings regardless of what it contains.
- **Capability**: a named area of the codebase with a living spec. Either declared in configuration or discovered on disk.
- **Unclaimed spec**: a living-spec file inside the scan root, outside every nested project, that no configured capability claims.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Running both listings at the root of a repository containing self-contained sample projects reports zero files from inside those samples.
- **SC-002**: The intersection of the file paths reported as configured capabilities and those reported as unclaimed is empty in every run.
- **SC-003**: A project that has switched living specs off contributes zero entries to a parent's listings.
- **SC-004**: Every entry in a full inventory has a name that appears exactly once.
- **SC-005**: All existing living-spec tests continue to pass, and at least four new tests cover the four rules above.

## Assumptions

- The project configuration file that marks a boundary is the same file the feature already reads for its own settings; no new marker file is introduced.
- A boundary is established by the presence of the configuration file, not by whether that file enables the feature — a project that declares itself is a project.
- Reporting an intentionally-narrower result is correct; the fix is not expected to preserve any of the previously-reported nested entries.
- Discovered-name uniqueness is achieved by making colliding names distinguishable rather than by dropping entries, so no discovered spec disappears from the inventory.

## Verbatim Constraints

- `.specify/companion.yml` — the configuration file whose presence marks a project boundary.
- `enabled: false` — the switched-off form a nested project uses to opt out.
- `--orphans` — the unclaimed-specs listing.
- `--all` — the full-inventory listing.

## Approach

- Add a nested-project boundary to the living-spec file discovery in `speckit-extension/scripts/resolve-spec-paths.py`: walk the tree with `os.walk` instead of a recursive `glob`, and prune any subdirectory that contains `.specify/companion.yml` (never the scan root itself).
- Route both `find_orphans` and `discover_all` through that one walk so the two listings share a single file set and cannot disagree.
- Since the boundary already excludes every nested project's files, an opted-out nested project is covered by the same prune — no separate enabled-check pass is needed, and a malformed nested config still prunes.
- De-duplicate discovered capability names in `discover_all`: when a derived name collides with a configured capability or an earlier discovered entry, disambiguate it from its path rather than dropping the entry.
- Add regression tests to `speckit-extension/tests/test_living_specs.py` covering the boundary stop, the opted-out nested project, orphans/`--all` agreement, and name uniqueness.
- Document the rule in `speckit-extension/README.md` where discovery is described, and add an `[Unreleased]` entry to `speckit-extension/CHANGELOG.md`.
