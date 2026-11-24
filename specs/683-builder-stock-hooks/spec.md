# Feature Specification: Your own hook on stock Spec Kit, and the template layer in force

**Feature Branch**: `feat/builder-hook-data`
**Created**: 2026-11-24
**Status**: Draft
**Input**: Workflow Builder on stock Spec Kit: attach, edit and remove your own hook on a step, and see which template layer is in force.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Attach my own hook to a stock step (Priority: P1)

A developer on a project that runs stock Spec Kit, without the Companion extension, opens the Workflow Builder and wants a skill of theirs (say `house-note`) to run after plan. Today the board can only switch an existing hook on or off. They pick the step, before or after, name the skill or command, describe it, say whether it is required, and optionally give the prompt shown before it runs. The entry lands in `.specify/extensions.yml` and the next stock run fires it.

**Why this priority**: The trial proved stock Spec Kit runs such an entry, and the board cannot write one. It is the highest-ranked stock gap.

**Independent Test**: Add a hook after plan on a project with a registry and on one without; the file then holds the new entry, every other line is unchanged, and the board draws the new hook as the user's own.

**Acceptance Scenarios**:

1. **Given** a registry with extension hooks and comments, **When** the user adds `house-note` after plan, **Then** the file gains one entry under `after_plan` and every other line is byte-for-byte as it was.
2. **Given** a project with no `.specify/extensions.yml`, **When** the user adds a hook, **Then** the file is created holding just that hook.
3. **Given** a step this project does not have, **When** the user adds a hook to it, **Then** nothing is written and the board says why.
4. **Given** a registry that is not valid YAML, **When** the user adds a hook, **Then** the file is left untouched and the board says it could not be read.

---

### User Story 2 - Edit or remove a hook I added (Priority: P1)

The same developer wants to change the skill a hook names, its description, whether it is required, or its prompt, or to take the hook away. Hooks an installed extension registered (git's commit hook, for example) stay switch-only: the extension rewrites them on reinstall, so an edit there would not last.

**Why this priority**: Adding without a way to correct or undo leaves the user hand-editing YAML, which is the problem being solved.

**Independent Test**: Edit and remove a user-added hook; only its lines change or go. Try the same on an extension's hook; it is refused and the file is untouched.

**Acceptance Scenarios**:

1. **Given** a hook the user added, **When** they change its description and make it optional, **Then** only those lines of that entry change.
2. **Given** a hook the user added, **When** they remove it, **Then** its lines are gone, and when it was the last entry under its key the key goes too.
3. **Given** a hook git registered, **When** the user tries to edit or remove it, **Then** nothing is written and the board says it belongs to the git extension.

---

### User Story 3 - See which hooks are mine (Priority: P2)

On the board, every stock hook says whether it is the user's own or an installed extension's, so the board can offer edit and remove only where they work.

**Why this priority**: The board needs it to draw the right controls, but it changes nothing on its own.

**Independent Test**: Read the stock board for a registry holding a git hook and a hand-written one; the first is marked as git's, the second as the user's own.

**Acceptance Scenarios**:

1. **Given** an entry whose extension is not installed in the project, **When** the board is read, **Then** that hook is marked as the user's own and carries its prompt.
2. **Given** an entry whose extension is installed, **When** the board is read, **Then** it is marked as that extension's.

---

### User Story 4 - See which template layer is in force (Priority: P2)

Spec Kit resolves each template through layers: the project's override under `.specify/templates/overrides/`, then installed presets by priority, then installed extensions, then the core template. The developer wants to see, per template, which layer the next run uses, and which layers compose into it.

**Why this priority**: Overrides are invisible on the board today (trial gap 6), so a user cannot tell why a run did not use the core template they edited.

**Independent Test**: Put an override for `spec-template.md` in a project; the board reads the spec template as in force from the override. Remove it; the board reads core.

**Acceptance Scenarios**:

1. **Given** an override for a template, **When** the board is read, **Then** that template's layer in force is the override.
2. **Given** a preset that replaces a template and no override, **When** the board is read, **Then** the layer in force is that preset, by its id.
3. **Given** a preset that appends to a template, **When** the board is read, **Then** the stack lists the preset over the layer it composes onto.
4. **Given** no override and no preset, **When** the board is read, **Then** the layer in force is core.

### Edge Cases

- A registry with `hooks:` written in flow style (`hooks: {}`) or a step key written as `after_plan: []`: the board refuses to write rather than guess, and says so.
- A file with no `hooks:` section: the section is appended at the end.
- Two hooks with the same command under one key: each is addressed by its place in the list, as the existing switch does.
- A description or prompt holding quotes, colons or a `#`: written so YAML reads it back exactly.
- An empty skill name or description: refused.
- An installed extension whose id equals the id the board writes for the user's own hooks: adding is refused, so ownership stays readable.
- An override file for a template core does not ship: listed as its own row, in force from the override.
- A preset that is disabled in the preset registry: not a layer.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The builder MUST let a stock project add a hook before or after one of its stock steps, naming a skill or command, a description, required or optional, and an optional prompt.
- **FR-002**: Adding MUST create `.specify/extensions.yml` when it does not exist, and otherwise change only the lines of the new entry (plus a new step key or `hooks:` section when missing).
- **FR-003**: The builder MUST let a stock project edit the command, description, required flag and prompt of a hook the user added, changing only that entry's lines.
- **FR-004**: The builder MUST let a stock project remove a hook the user added, removing the step key when it empties.
- **FR-005**: Edit and remove MUST be refused for a hook whose extension is installed in the project, leaving the file untouched.
- **FR-006**: Every write MUST be refused, with the file untouched, for a step the project does not have, for a registry that is not valid YAML, and for a registry shape the text writer cannot edit safely.
- **FR-007**: Every stock hook the board reads MUST say whether it is the user's own or an installed extension's, and MUST carry its prompt.
- **FR-008**: The three new messages MUST be allowed on a stock project and nowhere else changes; every other message stays refused there.
- **FR-009**: Every template the stock board reads MUST say which layer is in force (override, preset, extension or core), naming the preset or extension, and list the layers that compose into it, in Spec Kit's order.
- **FR-010**: An override for a template core does not ship MUST appear as a template row.

### Key Entities

- **Stock hook** *(existing, gains fields)*: an entry under `hooks.<when>_<step>` in `.specify/extensions.yml`. Gains whether it is the user's own and its prompt.
- **User hook draft**: what the user fills in to add or edit a hook: step, before or after, command, description, required or optional, prompt.
- **Template layer**: one source a template resolves through: its kind (override, preset, extension, core), the preset or extension id, the file, and how it combines (replace, prepend, append, wrap, replace-section).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Adding, editing and removing a user hook each change only the lines of that entry, checked byte-for-byte on a registry with comments and extension hooks.
- **SC-002**: 100% of refusals (unknown step, extension's hook, malformed YAML, unsafe shape) leave the file byte-for-byte unchanged.
- **SC-003**: A hook written by the builder parses back with exactly the values the user gave.
- **SC-004**: For each of the four layer kinds, a project set up with that layer on top reads back that layer as in force.

## Non-goals

- No webview changes: the board's controls are another team's work; this change adds the data and messages they use.
- Moving a hook between steps or between before and after (remove and add does it).
- Editing a hook's condition or priority.
- Editing or creating override files from the board.
- Changing the Companion project's hooks in `companion.yml`.

## Change-level rules

- The registry is edited as text; nothing round-trips through a YAML writer.
- Existing protocol fields and messages are kept; only additions.
- No new dependency.

## Verification plan

1. Unit tests on the text writer: add, edit, remove on a registry with comments; on a missing file; refusals leave the text unchanged.
2. Unit tests on the stock reader: ownership and prompt on hooks; layer in force for override, preset (replace and append), extension and core.
3. The stock guard test lists the three new messages as allowed.

## Assumptions

- A hook is the user's own when its `extension` is not an installed extension (neither in the registry's `installed` list nor a folder under `.specify/extensions/`). Spec Kit only purges entries by extension id, so such an entry survives extension installs and removals.
- Hooks the builder adds are written with `extension: project`, matching the trial's hand-written shape.
- An unreadable preset manifest falls back to the preset's conventional template path, as Spec Kit does when a manifest is absent.
