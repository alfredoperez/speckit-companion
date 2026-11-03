# Feature Specification: The record writer finds the project and spec the way spec-kit does

**Feature directory**: `specs/648-writer-finds-project`
**Source**: #929 (item w7)

## User Scenarios & Testing

### User Story 1 - A monorepo member project records its runs (Priority: P1)

A team keeps spec-kit in `apps/web/.specify` inside a larger git repo. From `apps/web`, every Companion write anchored on the git toplevel, found no `.specify` there, printed "Skipping context write" and exited 0, so the viewer stayed empty with no error. With this change the writer finds the project the way spec-kit does: `SPECIFY_INIT_DIR` when set, then the nearest `.specify/` above the working directory, then git.

**Why this priority**: every write was silently lost in a monorepo.

**Independent Test**: a git repo with `apps/web/.specify` and a spec under `apps/web/specs`; run the writer from `apps/web`; the spec's record gains the entry.

**Acceptance Scenarios**:

1. **Given** a monorepo member at `apps/web`, **When** the writer runs from `apps/web` with no `--feature-dir`, **Then** it records against `apps/web/specs/<spec>`.
2. **Given** `SPECIFY_INIT_DIR` names a folder with `.specify/`, **When** the writer runs anywhere, **Then** that folder is the project.
3. **Given** `SPECIFY_INIT_DIR` names a folder without `.specify/`, **When** the writer runs, **Then** it records nothing and says why, like spec-kit refuses.

### User Story 2 - The pointer outranks the feature label (Priority: P2)

`SPECIFY_FEATURE` names spec A while `.specify/feature.json` points at spec B. Companion picked A and stock spec-kit picked B. With this change the pointer wins, the label is used only when no pointer resolves, and using it prints one line naming it.

**Why this priority**: the two tools must agree on which spec a run belongs to.

**Independent Test**: set the label to A and the pointer to B; a bare write lands on B.

**Acceptance Scenarios**:

1. **Given** label A and pointer B, **When** the writer runs, **Then** it records against B.
2. **Given** label A and no pointer, **When** the writer runs, **Then** it records against A and prints one line naming the label.
3. **Given** an explicit feature directory, **When** the writer runs, **Then** that directory wins over both.

## Requirements

### Functional Requirements

- **FR-001**: The writer MUST take the project from `SPECIFY_INIT_DIR` when it holds `.specify/`.
- **FR-002**: When `SPECIFY_INIT_DIR` holds no `.specify/`, the writer MUST record nothing and say so.
- **FR-003**: Otherwise the writer MUST take the nearest folder holding `.specify/` above the working directory, then the git toplevel.
- **FR-004**: `.specify/feature.json` MUST outrank `SPECIFY_FEATURE`.
- **FR-005**: Using `SPECIFY_FEATURE` MUST print one line naming it.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In the monorepo fixture every write from `apps/web` lands on the member's spec.
- **SC-002**: Label A with pointer B records against B in every run.

## Assumptions

- VS Code's project root already resolves to the open folder, so a window opened on `apps/web` works; a window opened on the repo root with only a nested `.specify/` is not changed here.

## Verbatim Constraints

- `SPECIFY_INIT_DIR`
- `SPECIFY_FEATURE`
- `.specify/feature.json`

## Approach

- `apps/speckit-extension/scripts/spec_context.py`: `_repo_root()` resolves `SPECIFY_INIT_DIR` strictly, then walks up for `.specify/`, then asks git; `resolve_feature_dir` moves the label rung below the pointer and logs when it is used.
- `apps/speckit-extension/tests/test_project_root.py` (new): the monorepo fixture, the strict init dir, and the label against the pointer.
- Changelog line in `apps/speckit-extension/CHANGELOG.md`.
