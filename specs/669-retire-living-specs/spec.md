# Feature Specification: Retire living specs

**Source**: #934

## User Scenarios & Testing

### User Story 1 - The living-spec commands are gone from the spec-kit extension (Priority: P1)

A developer installs the Companion spec-kit extension and sees only the pipeline commands. No `living-*` command is offered, and specify, plan and implement no longer load or fold living specs. The Brownfield workflow preset runs without living-spec steps.

**Why this priority**: Decision 4 retires living specs; the commands are the surface that decision removes.

**Independent Test**: Install the extension in a fresh project and list its commands; run the Brownfield preset end to end.

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** the developer lists Companion commands, **Then** none is named `living-*`.
2. **Given** the Brownfield preset, **When** it runs, **Then** no step loads or drafts living specs, and it finishes.
3. **Given** the extension's manifest, **When** it is read, **Then** it carries no `living-specs` or `drift` tag.

### User Story 2 - A project that had living specs keeps working (Priority: P1)

A team that turned living specs on upgrades. Their `capabilities/` files, their `living-specs.yml` and the `livingSpecs:` block in `.specify/companion.yml` stay where they are. Every command runs without an error. The doctor prints one line saying the setting is retired and safe to delete. Old specs whose record lists loaded or synced living specs still open, and the viewer still shows that card.

**Why this priority**: A removal must never break a project that used the feature.

**Independent Test**: Upgrade a project that has living specs on, run the full pipeline and the doctor, and open an old spec in the viewer.

**Acceptance Scenarios**:

1. **Given** a config with a `livingSpecs:` block, **When** any command reads the config, **Then** it runs without an error or warning.
2. **Given** the same config, **When** the doctor runs, **Then** it prints exactly one info line: `livingSpecs is retired; safe to delete`.
3. **Given** a project with `capabilities/` files, **When** the pipeline runs, **Then** no file under `capabilities/` is read, written, moved or deleted.
4. **Given** an old spec record with a `livingSpecs` block, **When** it opens in the viewer, **Then** the read-only living-specs card renders as before.

### User Story 3 - The VS Code sidebar drops the Living Specs surface (Priority: P2)

A VS Code user no longer sees the Living Specs sidebar view, its status bar item, its commands or the Workflow Builder's living-specs panel. Nothing else in the sidebar or the viewer changes.

**Why this priority**: The surface only showed data the retired commands produced.

**Independent Test**: Open a project with `capabilities/` files in VS Code and check the sidebar, status bar, command palette and Workflow Builder.

**Acceptance Scenarios**:

1. **Given** the extension is active, **When** the user opens the Companion sidebar, **Then** no Living Specs view appears.
2. **Given** the command palette, **When** the user types "living", **Then** no Companion command matches.
3. **Given** a stored value for a removed setting, **When** the extension activates, **Then** it activates without an error.

### User Story 4 - The loss and the persistence model are written down (Priority: P2)

A user reading the changelog finds what left and why, in one list. A user reading the site's steps page learns how Companion keeps specs: flow-forward, one folder per change, completed is final, Reactivate as the in-place exception, lineage links between folders, and the community reconcile extension for flow-back. The doctor notes a constitution that names flow-back or living specs.

**Why this priority**: The ticket requires the loss to be named, and teams need the model stated before they hit a refusal.

**Independent Test**: Read the changelog's Removed entry and its linked loss list; read the steps page; run the doctor on a constitution that says "living specs".

**Acceptance Scenarios**:

1. **Given** the spec-kit extension changelog, **When** the user reads `[Unreleased]`, **Then** a Removed entry names the retirement and links the loss list.
2. **Given** the loss list, **When** it is read, **Then** it names registry, drift, coverage, fold-back, adoption, and every removed command, setting and view.
3. **Given** the steps page, **When** it is read, **Then** one section states flow-forward, living spec and flow-back in Companion's terms and explains the lineage fields.
4. **Given** a constitution naming flow-back or living specs, **When** the doctor runs, **Then** it notes the mismatch with Companion's flow-forward model.

### Edge Cases

- A project's `companion.yml` lists `load-living-specs` or `draft-spec-delta` in a command's node order: the run skips the missing node with one warning and continues.
- A spec is mid-run when the upgrade lands, with a delta not yet folded: the run completes; the delta stays in the spec folder untouched.
- Old site links to the living specs page: they land on a short retired note, not a 404.
- README screenshots of living specs: they stay on disk under the same names.

## Requirements

### Functional Requirements

- **FR-001**: The spec-kit extension MUST ship no `living-*` command, and its manifest MUST list none and carry no `living-specs` or `drift` tag.
- **FR-002**: Specify, plan, implement and their nodes MUST no longer load, draft, review or fold living specs.
- **FR-003**: The Brownfield preset MUST run without living-spec nodes.
- **FR-004**: Reading a config with a leftover `livingSpecs:` block MUST succeed without an error or warning.
- **FR-005**: The doctor MUST print one info line, `livingSpecs is retired; safe to delete`, when the block is present.
- **FR-006**: No command or extension code MUST read, write, move or delete a user's `capabilities/` files or `living-specs.yml`.
- **FR-007**: Old `.spec-context.json` records with a `livingSpecs` block MUST load without error, and the viewer MUST keep rendering their read-only card.
- **FR-008**: The VS Code extension MUST drop the Living Specs view, status bar item, commands and Workflow Builder panel; any removed setting MUST be handled by the settings migration so old values never error.
- **FR-009**: A loss list MUST name every retired capability (registry, drift, coverage, fold-back, adoption, move, show, validate) and every removed command, view and record field, and the spec-kit extension changelog MUST link it.
- **FR-010**: The site MUST drop the living specs page, leave a retired note at its address, and state Companion's persistence model in one section of the steps page, including the lineage fields.
- **FR-011**: The doctor MUST note a constitution that names flow-back or living specs.
- **FR-012**: The package, build, emission and budget lists MUST name no retired file.

### Key Entities

- **Living spec record fields**: `livingSpecs.loaded`, `synced`, `skipped` and siblings on an old spec record. Still read for display, never written.
- **Loss list**: the written list of what retired and why.

## Success Criteria

### Measurable Outcomes

- **SC-001**: `grep -r living- apps/speckit-extension` returns only the changelog.
- **SC-002**: A project with living specs on runs the full pipeline and the doctor with zero errors.
- **SC-003**: Every build, package and emission check passes, and the site builds.
- **SC-004**: The loss list covers 100% of removed commands, views and settings.

## Assumptions

- The parent chat confirmed: keep the old-record card, the doctor info line, and remove the whole VS Code surface.
- Files a user wrote (`capabilities/`, `living-specs.yml`) are theirs; the retirement leaves them on disk.
- Generated media clips about living specs leave the site's manifest; their source folders go too, but no screenshot a README references is renamed or deleted.
- The `domain-spec` catalog extension is not recommended by the site until someone tries it.

## Verbatim Constraints

- `livingSpecs is retired; safe to delete`
- `grep -r living- apps/speckit-extension`
