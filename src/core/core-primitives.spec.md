# Core Primitives — Living Spec

<!-- reviewed: a9c0b02b -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Core holds the primitives every feature would otherwise reinvent: settings migration, context keys, display names, terminal and shell handling, temp files, and task parsing.

## Requirements

### Settings survive being renamed, retyped, and retired
<!-- touches: src/core/settingsMigration.ts -->

A settings reader SHALL be correct for a persisted value from any generation without waiting for a migration to run. Migrations MUST preserve the scope a value was set at, MUST be idempotent, and MUST NOT fail activation. A retired key's persisted value SHOULD be cleaned up.

#### Scenario: a setting was persisted in its old form
- **WHEN** a reader asks for it before any migration has run
- **THEN** the legacy form is coerced to the current type and the user's effective choice is preserved, never flipped

#### Scenario: a renamed key is migrated
- **WHEN** the old key was set at the workspace level
- **THEN** the new key is written at the workspace level and the old one is removed there
- **AND** re-running the migration changes nothing

#### Scenario: two toggles are collapsed into one
- **WHEN** two former notification toggles are merged into the single surviving completion toggle
- **THEN** at every scope where the retired toggle was explicitly set, the merged value is the either-false-wins combination of the two explicit values at that scope, written only where it differs from the current value
- **AND** a broad `false` propagates down, a narrower explicit `true` at a more specific scope is preserved, and scopes where the retired toggle was unset are untouched

Migrations SHALL run only at the scopes a setting can be set at: every contributed key is window- or machine-scoped, so there is no folder-level pass. A test SHALL assert that scope declaration, so a future resource-scoped key fails there. A write the host refuses SHALL be logged where the user can see it, and the migration SHALL continue with the remaining keys.

#### Scenario: one scope's write is rejected
- **WHEN** a settings file cannot be written
- **THEN** the failure is reported through the extension's own output, and every other key and scope is still migrated

#### Scenario: a key is contributed at resource scope
- **WHEN** the manifest declares one
- **THEN** the scope test fails, because the migration's two-tier shape no longer covers it

### Context keys have one writer and one catalogue
<!-- touches: src/core/utils/contextKeys.ts -->

VS Code context keys SHALL be written through a single wrapper that accepts only catalogued key names and logs failures. Activation MUST reset every catalogued key, so a previous session's value cannot leave a menu affordance stuck.

#### Scenario: a key is set from a feature
- **WHEN** the write fails
- **THEN** the failure is logged, not silently swallowed

#### Scenario: the extension activates
- **WHEN** startup runs
- **THEN** every catalogued key is reset to its default

A key whose last writer or reader is removed SHALL leave the catalogue in the same change, so the reset list and key list never name a key nothing sets or reads.

#### Scenario: the last surface reading a key is removed
- **WHEN** that change lands
- **THEN** the key is gone from the catalogue and from the activation reset
- **AND** no `when` clause in the manifest still names it

### A spec's display name resolves by preference without changing its identity
<!-- touches: src/core/utils/specDisplayName.ts -->

A display name SHALL resolve by preference: recorded name, then document heading, then humanized directory slug, while the slug stays the stable identifier. A blank or whitespace-only candidate MUST be treated as absent. Recorded and slug-derived names SHALL be title-cased through the one shared acronym-aware caser used by both the viewer header and the specs tree, keeping known acronyms (CLI, API, UI, JSON, VS Code, …) in canonical form; a document heading is returned verbatim, never re-cased.

#### Scenario: a spec has no recorded name
- **WHEN** a display name is needed and the recorded name is empty or whitespace
- **THEN** a document heading is used when present, otherwise the humanized slug, and the slug still identifies the spec

#### Scenario: a spec name carries an acronym
- **WHEN** a recorded or slug-derived name contains a known acronym token
- **THEN** the shared caser title-cases the name while preserving the acronym's canonical form
- **AND** a living-spec heading is left exactly as authored

### Retired surfaces leave nothing behind in core

When a feature is removed, its command identifiers, custom-editor identifiers, message types, and helper modules SHALL be deleted from core. A leftover entry in core advertises a surface that no longer exists.

#### Scenario: the custom workflow editor is removed
- **WHEN** the feature's commands, editor type, webview message contract, and retry-based file opener are no longer used
- **THEN** none of them remain declared in core

### Shared primitives absorb host and shell differences
<!-- touches: src/core/utils/terminalUtils.ts, src/core/utils/tempFileUtils.ts, src/core/utils/pathUtils.ts, src/core/utils/shellDetection.ts, src/core/utils/taskCheckboxes.ts -->

Terminal readiness, temp-file staging, cross-environment path translation, shell-family detection, and task-checkbox parsing SHALL live only in core, and callers MUST NOT re-derive them. Waiting for a shell MUST have a timeout fallback so a host that never reports readiness still dispatches.

#### Scenario: a checkbox appears inside a code block
- **WHEN** task counts are computed for a document
- **THEN** checkboxes inside fenced blocks or inline code are not counted

A task is a list item bearing a task id. The parser SHALL accept any markdown bullet character and SHALL ignore a checkbox line with no id, so verification notes do not inflate the count and disagree with the spec-kit side about whether implement finished. Both parsers SHALL be pinned to one shared fixture read by both test suites.

#### Scenario: a task document mixes tasks with verification notes
- **WHEN** task counts are computed for a document containing both `- [x] **T001** …` and `- [x] \`npm run compile\` green`
- **THEN** only the line carrying a task id is counted

#### Scenario: the two parsers drift apart
- **WHEN** one side's grammar starts accepting or rejecting a line the other does not
- **THEN** the shared fixture makes one of the two suites fail

#### Scenario: shell integration never signals ready
- **WHEN** the readiness wait exceeds its timeout
- **THEN** dispatch proceeds anyway instead of hanging

## Uncovered

_None. Every file in the area was read._

### Capability names are made readable by one rule

A capability or folder name SHALL be turned into words by one shared function, splitting on dashes and underscores and capitalising each word, so every surface that shows a capability agrees on its name. Sibling labels SHALL be shortened by dropping the leading words they all share, never past the shortest label's last word.

#### Scenario: siblings share a leading word
- **WHEN** `commands-living` and `commands-living-load` are labelled together
- **THEN** they read as "Living" and "Living Load"

#### Scenario: one label is a prefix of its sibling
- **WHEN** `viewer-ui` and `viewer-ui-chrome` are labelled together
- **THEN** they read as "Ui" and "Ui Chrome"
