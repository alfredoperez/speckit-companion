# Glob spec directories list the specs inside them

**Issue**: #748

## User Scenarios & Testing

### User Story 1 - A glob that names spec containers lists the specs inside (Priority: P1)

A developer in a monorepo keeps specs per project under `apps/<project>/specs/`. They add `apps/*/specs` to the spec directories setting, the same way the default `specs` entry names the folder that holds spec folders. The sidebar lists every spec folder inside each project's `specs` folder, and no empty row named after the container appears.

**Why this priority**: this is the reported bug. Today the setting silently shows empty rows and hides every real spec.

**Independent Test**: configure `apps/*/specs` in a workspace with `apps/a/specs/001-x/spec.md` and `apps/b/specs/002-y/spec.md`, and check that discovery returns the two spec folders and not the two `specs` folders.

**Acceptance Scenarios**:

1. **WHEN** a glob pattern ends in a plain name and its matches hold spec subfolders, **THEN** each of those subfolders is listed as a spec.
2. **WHEN** a file inside `apps/a/specs/001-x/` is edited, **THEN** it is attributed to the spec `apps/a/specs/001-x`, not to `apps/a/specs`.

### User Story 2 - Globs that already point at spec folders keep working (Priority: P1)

A developer whose pattern already reaches the spec folders themselves, such as `apps/*/specs/*` or `openspec/changes/*/specs/*`, sees exactly the specs they saw before this change.

**Why this priority**: the workaround in the issue and the OpenSpec layout both rely on today's behavior, and breaking them would trade one silent disappearance for another.

**Independent Test**: configure `apps/*/specs/*` and `openspec/changes/*/specs/*` against matching folders and check that discovery and attribution return the same paths as before.

**Acceptance Scenarios**:

1. **WHEN** a glob pattern ends in a wildcard, **THEN** each match is listed as one spec exactly as before, and an OpenSpec `archive` folder stays hidden.
2. **WHEN** a spec folder holds subfolders with other markdown, such as `checklists/` or `contracts/`, **THEN** those subfolders are not listed as specs.

## Edge Cases

- A container that holds no spec at any depth: nothing is listed for it, instead of an empty row.
- A container holds a subfolder with no spec content: that subfolder is not listed, matching how plain directory names skip empty scaffolding.
- The same spec folder is reached by two patterns, such as `apps/*/specs` and `apps/*/specs/*`: it is listed once.
- A container match sits under a workflow's reference folder: it and everything beneath it stay excluded.

## Requirements

### Functional Requirements

- **FR-001**: A glob pattern ending in a wildcard MUST list each match as one spec, unchanged from before.
- **FR-002**: A glob pattern ending in a plain name MUST list each match's subfolders that hold markdown or a spec context as specs, and never the match itself. A match with no such subfolder MUST list nothing.
- **FR-003**: File-to-spec attribution MUST return the same spec folder discovery lists: a file inside a container's spec subfolder belongs to that subfolder.
- **FR-004**: Globs whose matches are already spec folders MUST produce the same specs as before, including the OpenSpec change layout.
- **FR-005**: A spec folder reached through more than one pattern MUST be listed once.
- **FR-006**: A glob ending in a plain name MUST NOT make the folder above it a change root, so a monorepo project folder is never scanned for a spec's related documents. Two-level layouts like `openspec/changes/*/specs/*` keep their change root.

## Success Criteria

### Measurable Outcomes

- **SC-001**: With `apps/*/specs` configured over two projects holding two specs, discovery lists exactly those two specs and no container rows.
- **SC-002**: Every existing discovery and attribution test for glob layouts passes unchanged.
- **SC-003**: A file edited inside a container's spec folder is attributed to that spec folder in 100% of the tested layouts.

## Assumptions

- The rule reads the pattern, not the disk: a plain last segment names a folder of specs, as the plain `specs` default does. A first version judged each match by its own content and broke OpenSpec's `archive` folder, which holds no markdown of its own.
- Only one level below a container is searched, the same depth a plain directory name lists.

## Verbatim Constraints

- `speckit.specDirectories`
- `apps/*/specs`
- `apps/*/specs/*`
- `openspec/changes/*/specs/*`

## Approach

- `src/core/specDirectoryResolver.ts`: `getConfiguredPatterns` reads a glob ending in a plain name as that pattern plus `/*`, so discovery, attribution and watchers all share one rule with no disk check. `deriveChangeRoot` skips patterns that were rewritten, and the last-resort fallback that pushed contentless matches is deleted, since only rewritten patterns could reach it.
- `src/core/specDirectoryResolver.test.ts`: the container layout, an empty container, the OpenSpec archive, attribution through a container, and both change-root cases. The shared mocks reset between tests.
- `package.json` setting description, `docs/configuration.md`, root `CHANGELOG.md`.

## MODIFIED Requirements
<!-- capability: core-spec-discovery -->

### Spec locations are configured, not assumed

The extension SHALL locate specs from a user-configurable list of directory patterns, not a fixed path. Plain directory names and glob patterns MUST both be supported: a plain name's children are specs, while a glob ending in a wildcard matches specs directly and a glob ending in a plain name matches folders of specs, whose children are the specs. Any hardcoded fallback MUST list every layout the shipped configuration lists, or a whole layout silently disappears.

#### Scenario: a workspace uses a nested change-based layout
- **WHEN** a configured pattern ends in a wildcard and a real directory matches it
- **THEN** that directory is itself a spec directory, not a container of specs

#### Scenario: a configured directory holds spec folders
- **WHEN** a configured pattern is a plain directory name
- **THEN** each immediate subdirectory is a candidate spec
- **AND** a subdirectory is only accepted once it has markdown content or a recorded spec context, so empty scaffolding does not appear as a spec

#### Scenario: a wildcard pattern names each project's folder of specs
- **WHEN** a pattern ends in a plain name, like `apps/*/specs`
- **THEN** the spec folders inside each match are listed, and the matches themselves are not
