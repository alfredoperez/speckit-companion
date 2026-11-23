# Spec Kit presets in the Workflow Builder

**Source**: #1032

## User Scenarios & Testing

### User Story 1 - See what each installed preset changes (Priority: P1)

A developer opens the Workflow Builder and finds a "Spec Kit presets" panel listing every preset installed in the project: its name, version, where it came from, whether it is on, and its priority. Under each preset it shows what the preset provides: each command, template or script, what it replaces, and how (replace, prepend, append, wrap, replace a section).

**Why this priority**: presets silently change commands and templates, and VS Code users cannot see them today.

**Independent Test**: install a preset in a project, open the Builder, and read its entry.

**Acceptance Scenarios**:

1. **Given** a project with installed presets, **When** the Builder opens, **Then** the panel lists each with name, version, source, enabled and priority.
2. **Given** a preset that provides commands and templates, **When** the panel lists it, **Then** each item shows its type, its name, what it replaces and its strategy.
3. **Given** a stock project, **When** the Builder opens, **Then** the same panel replaces the plain "Presets applied here" list.
4. **Given** a preset is added or removed on disk, **When** the files change, **Then** the panel refreshes.

### User Story 2 - Know when a preset fights Companion (Priority: P1)

When a preset replaces or wraps a command Companion hooks into, or a template Companion relies on, the panel warns on that preset and says what Companion may stop doing.

**Why this priority**: a clash breaks the run record without any visible error.

**Independent Test**: install a preset that replaces `speckit.plan` and see the warning.

**Acceptance Scenarios**:

1. **Given** a preset that replaces a command whose hooks dispatch Companion, **When** the panel lists it, **Then** it shows a clash warning naming the command.
2. **Given** a preset that replaces a template Companion relies on, **When** the panel lists it, **Then** it shows a clash warning naming the template.
3. **Given** Companion's own preset, **When** the panel lists it, **Then** it shows no clash.

### User Story 3 - Search, add, update and remove from the panel (Priority: P2)

From the panel, the developer searches the catalog, adds a preset, updates one or removes one. Each runs the Spec Kit command in a terminal they can see. Before adding, updating or removing, a confirm names the files the preset replaces and any clash; a clash warns but never blocks.

**Why this priority**: the CLI already does the work; the panel only needs to reach it.

**Independent Test**: search for a term and see the terminal run the search; remove a preset after confirming.

**Acceptance Scenarios**:

1. **Given** a search term, **When** the developer searches, **Then** `specify preset search <term>` runs in a visible terminal.
2. **Given** a preset id, **When** the developer adds, updates or removes it and confirms, **Then** the matching `specify preset` command runs in a visible terminal.
3. **Given** a clash, **When** the confirm opens, **Then** it names the clash and still lets the developer go ahead.
4. **Given** an id with characters outside letters, digits and dashes, **When** an action is asked for, **Then** nothing runs.

### Edge Cases

- No presets installed: the panel says so and still offers search.
- A preset folder with a broken `preset.yml`: listed by its folder name with a note, never a crash.
- No `.registry`: enabled defaults to on and priority to 10.

## Requirements

### Functional Requirements

- **FR-001**: The Builder MUST read every installed preset's manifest and registry entry: id, name, version, source, enabled, priority, and each provided item's type, name, replaces and strategy.
- **FR-002**: A "Spec Kit presets" panel MUST list them in both Builder views, named apart from workflow presets.
- **FR-003**: The panel MUST warn on a preset that replaces or wraps a Companion-hooked command or a stock template Companion relies on, except Companion's own preset.
- **FR-004**: Search, add, update and remove MUST run the matching `specify preset` command in a visible terminal.
- **FR-005**: Add, update and remove MUST confirm first, naming the replaced files and any clash, without blocking on a clash.
- **FR-006**: An action MUST refuse an id that is not letters, digits and dashes.
- **FR-007**: The panel MUST refresh when a manifest or the registry changes.
- **FR-008**: The site's Workflow Builder page MUST describe the panel and how Spec Kit presets differ from workflow presets.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of installed presets appear with their provided items.
- **SC-002**: Every preset that replaces a Companion-hooked command shows a warning.
- **SC-003**: No action runs a command for an invalid id.
- **SC-004**: The extension's tests, type-check and webview build pass.

## Non-goals

- The panel in the Copilot canvas.
- An offline copy of the catalog.
- Blocking an install on a clash.

## Change-level rules

- The extension writes nothing under `.specify/`; the CLI does.

## Verification plan

- Unit tests for the reader and the clash rule, and for the handlers' id check and command lines.
- Component tests for the panel in both views; a story for each view.

## Assumptions

- The CLI's `specify preset` verbs are `search`, `add`, `update` and `remove`.
