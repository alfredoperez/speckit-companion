# The living-specs docs match the shipped files

**Issue**: #701 (partial: the site fixes the runbook names; the screenshot walk stays open)

## User Scenarios & Testing

### User Story 1 - A reader finds every living-spec command (Priority: P1)

A developer reading the site's living-specs guide sees every `living-*` command the extension ships, including the one that prints a slice of a spec and the one that checks spec shape.

**Why this priority**: two shipped commands are invisible on the page that introduces the feature.

**Independent Test**: compare the guide's command table with the `speckit.companion.living-*` commands the extension provides.

**Acceptance Scenarios**:

1. **WHEN** a reader opens the command table, **THEN** it lists adopt, sync, drift, coverage, move, show and validate.

### User Story 2 - A reader creates files where the extension looks for them (Priority: P1)

A developer following the guide to set up a central spec, or its sibling files, creates them at the paths the resolver actually derives, so the sidebar and the tools find them.

**Why this priority**: a wrong path silently leaves a spec or its coverage file unread.

**Independent Test**: for each path the docs give, check that the resolver derives the same one.

**Acceptance Scenarios**:

1. **WHEN** a reader leaves `spec:` out, **THEN** the docs say the spec lives at `capabilities/<name>/<name>.spec.md`.
2. **WHEN** a reader looks up the sibling files, **THEN** the docs name `<stem>.rules.md` and `<stem>.coverage.md`, and say an older `.arch.md` is still read.
3. **WHEN** a reader looks up where a delta goes, **THEN** the docs name the feature's own spec file, `<short-name>.spec.md`.

## Edge Cases

- A project written before the renames keeps `capabilities/<name>/spec.md` or `.arch.md` files: the docs say those still resolve rather than implying they break.

## Requirements

### Functional Requirements

- **FR-001**: The site guide's command table MUST list every shipped `living-*` command.
- **FR-002**: Every derived path in the living-specs docs MUST match what the resolver derives.
- **FR-003**: The docs MUST describe the rules file as it is now: conventions as plain bullets, written by adopt for a layer, and not loaded by the pipeline on its own.
- **FR-004**: The docs MUST say where a delta block is written: the feature's own spec file.
- **FR-005**: The Living Specs view MUST look for a central spec at `capabilities/<name>/<name>.spec.md` first and still find one at `capabilities/<name>/spec.md`, as the scripts do.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 7 of 7 shipped `living-*` commands appear in the guide's table.
- **SC-002**: 0 derived paths in the living-specs docs disagree with the resolver.

## Assumptions

- The screenshot walk in #701 needs a person at a real repo, so it is out of scope; this change fixes only the text the runbook flagged.
- The spec-kit extension's own `docs/living-specs.md` carries the same stale paths, so it is fixed alongside the site guide.

## Verbatim Constraints

- `/speckit.companion.living-show`
- `/speckit.companion.living-validate`
- `capabilities/<name>/<name>.spec.md`
- `<stem>.rules.md`

## Approach

- `website/src/content/docs/docs/guides/living-specs.mdx`: add `living-show` and `living-validate` to the command table and fix its count; central path `capabilities/<name>/<name>.spec.md`; siblings `<stem>.rules.md` (conventions, cold tier) and `<stem>.coverage.md`, with the older names still read; a delta goes in `<short-name>.spec.md`.
- `speckit-extension/docs/living-specs.md`: the same central default path, and the rules file in place of the architecture file.
