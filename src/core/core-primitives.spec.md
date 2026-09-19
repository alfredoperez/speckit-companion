# Core Primitives — Living Spec

<!-- reviewed: a9c0b02b -->

## Purpose

Small shared rules every feature leans on: settings that survive migration, context keys, spec and capability names, shell readiness, and what counts as a task.

## Requirements

### Settings survive being renamed, retyped, and retired
<!-- touches: src/core/settingsMigration.ts -->

A setting persisted in any older form SHALL read as the user's effective choice before any migration has run, and a migration MUST keep the value at the scope it was set, change nothing on a second run, and never fail activation.

#### Scenario: a setting was persisted in its old form
- **WHEN** a reader asks for it before any migration has run
- **THEN** the legacy value is coerced to the current type and the user's choice is preserved, never flipped

#### Scenario: a renamed key is migrated
- **WHEN** the old key was set at the workspace level
- **THEN** the new key is written at the workspace level, the old one is removed there, and re-running the migration changes nothing

#### Scenario: one scope's write is rejected
- **WHEN** a settings file cannot be written
- **THEN** the failure is logged to the extension's output, activation continues, and every other key and scope is still migrated

### Activation resets every context key
<!-- touches: src/core/utils/contextKeys.ts -->

Activation SHALL reset every catalogued context key to its default, so a previous session's value cannot leave a menu item stuck. A failed context-key write SHALL be logged, not swallowed.

#### Scenario: the extension activates
- **WHEN** startup runs
- **THEN** every catalogued key is back at its default before any feature sets it

#### Scenario: a context-key write fails
- **WHEN** the host rejects the write
- **THEN** the failure is logged

### A spec's display name resolves by preference without changing its identity
<!-- touches: src/core/utils/specDisplayName.ts -->

A display name SHALL come from the recorded name, then the document heading, then the humanized directory slug, and a blank or whitespace-only candidate counts as absent. The slug stays the spec's identifier whatever name is shown.

#### Scenario: a spec has no recorded name
- **WHEN** the recorded name is empty or whitespace
- **THEN** the document heading is shown when present, otherwise the humanized slug, and the slug still identifies the spec

### Known acronyms keep their canonical case in spec names
<!-- touches: src/core/utils/specDisplayName.ts -->

Recorded and slug-derived names SHALL be title-cased with known acronyms (CLI, API, UI, JSON, VS Code) kept canonical, the same way in the viewer header and the specs tree. A document heading is shown exactly as authored.

#### Scenario: a slug carries an acronym
- **WHEN** the slug `cli-json-export` is displayed
- **THEN** it reads "CLI JSON Export" in both the viewer header and the specs tree

#### Scenario: the name comes from a heading
- **WHEN** the document heading is used as the name
- **THEN** its casing is left exactly as written

### Dispatch proceeds when a shell never reports ready
<!-- touches: src/core/utils/terminalUtils.ts -->

Waiting for a terminal's shell SHALL end at a timeout, so a host without shell integration still receives the command.

#### Scenario: shell integration never signals ready
- **WHEN** the readiness wait exceeds its timeout
- **THEN** the command is sent anyway instead of hanging

### Only a task-id list item outside code counts as a task
<!-- touches: src/core/utils/taskCheckboxes.ts -->

A task SHALL be a list item, with any bullet character, whose checkbox is followed by a task id. Checkbox lines without an id, and checkboxes inside fenced blocks or inline code, MUST NOT count. The spec-kit side counts tasks with the same grammar, and both test suites read one shared fixture, because a disagreement makes the two sides differ on whether implement finished.

#### Scenario: a task document mixes tasks with verification notes
- **WHEN** it contains both `- [x] **T001** …` and `- [x] \`npm run compile\` green`
- **THEN** only the line carrying a task id is counted

#### Scenario: a checkbox appears inside a code block
- **WHEN** task counts are computed
- **THEN** it is not counted

#### Scenario: the two parsers drift apart
- **WHEN** one side starts accepting a line the other rejects
- **THEN** the shared fixture makes one of the two suites fail

### A capability name reads as capitalised words

A capability or folder name SHALL display as its dash- and underscore-separated words, each capitalised, on every surface that shows it.

#### Scenario: a capability is labelled
- **WHEN** `commands-living-load` is shown
- **THEN** it reads "Commands Living Load"

### Sibling capability labels drop the leading words they share

Labels shown together SHALL drop the leading words they all share, never past the shortest label's last word.

#### Scenario: siblings share a leading word
- **WHEN** `commands-living` and `commands-living-load` are labelled together
- **THEN** they read "Living" and "Living Load"

#### Scenario: one label is a prefix of its sibling
- **WHEN** `viewer-ui` and `viewer-ui-chrome` are labelled together
- **THEN** they read "Ui" and "Ui Chrome"

## Uncovered

_None. Every file in the area was read._
