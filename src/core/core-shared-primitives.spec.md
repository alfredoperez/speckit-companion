# Core Shared Primitives — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The small set of primitives every feature would otherwise reinvent: settings migration, context keys, display-name resolution, the shared message dispatcher, terminal and task-parsing helpers, and the rule that retired surfaces leave core clean.

## Requirements

### Settings survive being renamed, retyped, and retired

Configuration keys change shape across releases, so a reader SHALL be correct for a persisted value from any generation without waiting for a migration to run. Migrations MUST preserve the scope a value was set at, MUST be idempotent, and MUST NOT fail activation. A retired key's persisted value SHOULD be cleaned up rather than left to confuse the user.

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
- **AND** a broad `false` propagates down while a narrower explicit `true` at a more specific scope is preserved, and scopes where the retired toggle was unset are left untouched

Migrations run at the scopes a setting can actually be set at, and no further: every key this product contributes is window- or machine-scoped, so a folder-level pass reads nothing and a folder-level write is rejected outright. A test asserts that scope declaration, so a future resource-scoped key fails there rather than silently making the migration wrong for it. A write the host refuses SHALL be logged where the user can see it and the migration SHALL continue — one unwritable file must not leave the remaining keys unmigrated.

#### Scenario: one scope's write is rejected
- **WHEN** a settings file cannot be written
- **THEN** the failure is reported through the extension's own output, and every other key and scope is still migrated

#### Scenario: a key is contributed at resource scope
- **WHEN** the manifest declares one
- **THEN** the scope test fails, because the migration's two-tier shape no longer covers it

### Context keys have one writer and one catalogue

VS Code context keys SHALL be written through a single wrapper that accepts only catalogued key names and logs failures. Activation MUST reset every catalogued key, so a value from a previous session cannot leak into the new one and leave a menu affordance stuck.

#### Scenario: a key is set from a feature
- **WHEN** the write fails
- **THEN** the failure is logged rather than silently swallowed

#### Scenario: the extension activates
- **WHEN** startup runs
- **THEN** every catalogued key is reset to its default

A key whose last writer or reader is removed SHALL leave the catalogue in the same change, so the reset list and the key list never carry a name nothing sets or reads. The install-nudge dismissal key was retired this way when the two surfaces that read it were removed.

#### Scenario: the last surface reading a key is removed
- **WHEN** that change lands
- **THEN** the key is gone from the catalogue and from the activation reset
- **AND** no `when` clause in the manifest still names it

### A spec's display name resolves by preference without changing its identity

A readable display name SHALL be resolved by preference — a recorded name first, then a document heading, then a humanized form of the directory slug — while the directory slug remains the stable identifier. A blank or whitespace-only candidate MUST be treated as absent so it can never win over the humanized-slug fallback. A recorded name and a slug-derived name SHALL be title-cased through one shared acronym-aware caser — known acronyms (CLI, API, UI, JSON, VS Code, …) keep their canonical casing rather than being mangled to "Cli"/"Json" — and that same caser is the one both the viewer header and the specs tree route through. A document heading is authored prose and is returned verbatim, never re-cased.

#### Scenario: a spec has no recorded name
- **WHEN** a display name is needed and the recorded name is empty or whitespace
- **THEN** a document heading is used when present, otherwise the humanized slug — and the slug still identifies the spec

#### Scenario: a spec name carries an acronym
- **WHEN** a recorded or slug-derived name contains a known acronym token
- **THEN** the shared caser title-cases the name while preserving the acronym's canonical form
- **AND** a living-spec heading is left exactly as authored

### One message dispatcher serves both ends of the webview protocol

The exhaustive message dispatcher SHALL be free of editor-host imports so the webview bundle compiles it too. Both ends of a protocol then route messages through the same primitive, and adding a message variant fails the build on both sides rather than silently doing nothing on one of them. Handlers MAY be synchronous; the dispatch they produce is always awaitable.

#### Scenario: a new message variant is added to a protocol
- **WHEN** only one side gains a handler for it
- **THEN** the build fails on the side that is missing it

### Retired surfaces leave nothing behind in core

When a feature is removed, its command identifiers, custom-editor identifiers, message types, and helper modules SHALL be deleted from core rather than left as unreferenced declarations. Core is the shared vocabulary, so a leftover entry there advertises a surface that no longer exists.

#### Scenario: the custom workflow editor is removed
- **WHEN** the feature's commands, its editor type, its webview message contract, and its retry-based file opener are no longer used
- **THEN** none of them remain declared in core

### Shared primitives absorb host and shell differences

Terminal readiness, temp-file staging, path translation for cross-environment shells, shell-family detection, and task-checkbox parsing SHALL live in core and be the only implementations. Callers MUST NOT re-derive them. Waiting for a shell MUST have a timeout fallback so a host that never reports readiness still dispatches.

#### Scenario: a checkbox appears inside a code block
- **WHEN** task counts are computed for a document
- **THEN** checkboxes inside fenced blocks or inline code are not counted as work

A task is a list item bearing a task id. The parser SHALL accept any of the markdown bullet characters and SHALL ignore a checkbox line carrying no id, because verification notes and prose checklists sit beside real tasks in a task document — counting them inflates the denominator here while the spec-kit side ignores them, and the two halves then disagree about whether implement finished. Both parsers SHALL be pinned to one shared fixture of the lines they must agree on, read by both test suites.

#### Scenario: a task document mixes tasks with verification notes
- **WHEN** task counts are computed for a document containing both `- [x] **T001** …` and `- [x] \`npm run compile\` green`
- **THEN** only the line carrying a task id is counted

#### Scenario: the two parsers drift apart
- **WHEN** one side's grammar starts accepting or rejecting a line the other does not
- **THEN** the shared fixture makes one of the two suites fail

#### Scenario: shell integration never signals ready
- **WHEN** the readiness wait exceeds its timeout
- **THEN** dispatch proceeds anyway rather than hanging
