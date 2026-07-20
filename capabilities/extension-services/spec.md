# Extension Services — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

This is a grouping, not one cohesive subsystem: four small areas — agent definitions, skill definitions, extension settings and their migrations, and permission handling — collected because none has enough surface to stand alone. What they genuinely share is a contract: each manages something on the user's behalf that is *not* a spec, lives outside the extension's own storage (the user's home directory, the workspace, `settings.json`, another tool's install directory), and is authored by someone other than this extension. That shared position is why they share the same failure discipline — read defensively, degrade to empty, never break activation, and never strand a value the user already set.

## Requirements

### Discovering user-authored assets is best-effort and never breaks activation

Enumerating agents, skills, or presets SHALL treat a missing directory, an unreadable file, or a failing external CLI as "nothing found here" and continue. These sources are outside the extension's control and are frequently absent; a hard failure would take down the whole extension for a user who simply doesn't have the directory.

#### Scenario: the user has no skills directory
- **WHEN** the skill list is requested
- **THEN** an empty list is returned and the failure is logged, not surfaced as an error

#### Scenario: the external CLI a preset operation needs is not installed
- **WHEN** the operation runs
- **THEN** the failure is logged and the caller continues
- **AND** activation completes normally

### A malformed definition surfaces as a flagged entry, not a missing one

A skill whose definition file has absent or unparseable frontmatter SHALL still be listed, named from its containing folder and marked as needing attention. Silently dropping it is worse than showing it broken: the user's assistant may still load it, and an invisible entry gives them nothing to fix.

#### Scenario: a skill's frontmatter is invalid YAML
- **WHEN** the skill list is built
- **THEN** the skill appears under its folder name, flagged, with an explanation available on hover
- **AND** it is not omitted from the list

### Assets are discovered at every scope and attributed to their origin

Discovery SHALL cover the project scope, the user scope, and installed plugins, and SHALL record which scope each asset came from. Plugin-sourced assets SHALL be namespaced by their plugin so two plugins providing the same name remain distinguishable.

#### Scenario: two plugins each provide an asset with the same name
- **WHEN** both are discovered
- **THEN** each is presented under its own plugin's namespace
- **AND** neither displaces the other

### Discovery follows the configured provider's layout rather than one vendor's

Where an asset's on-disk location differs per AI provider, discovery SHALL resolve the directory from the active provider's path configuration. This applies to every provider-located asset type alike — no asset type may hard-code one vendor's layout, since doing so makes that feature silently empty for every other provider.

#### Scenario: a non-default provider is configured
- **WHEN** skills are enumerated
- **THEN** the provider's own skills directory is scanned at both project and user scope

#### Scenario: a provider whose on-disk layout differs from the default is active
- **WHEN** any provider-located asset type is enumerated
- **THEN** that provider's own directory is scanned and its assets are listed
- **AND** the section is not shown as empty because another vendor's layout was assumed

### A renamed setting key keeps reading its predecessors

Every reader of a renamed configuration key SHALL go through one helper that prefers the new key when it is explicitly set at any scope and otherwise falls back, in order, to the legacy keys. The migration alone is not sufficient — it is best-effort and may not have run, in which case the new key reads as its schema default while the user's real choice still lives on the old key.

#### Scenario: a user's opt-in was set before the key was renamed and the migration has not run
- **WHEN** the setting is read
- **THEN** the legacy value is honoured and the feature behaves as opted-in

#### Scenario: the new key is explicitly set to off while a stale legacy key says on
- **WHEN** the setting is read
- **THEN** the explicit new value wins

### A value's meaning survives a type change

Where a setting's persisted representation changed shape, readers SHALL coerce through one shared helper that accepts both the old and the new representation and maps each old value to the state that preserves the user's effective behavior. A naive coercion of the old representation flips users into the opposite state.

#### Scenario: a persisted value still uses the retired representation
- **WHEN** it is read
- **THEN** it resolves to the same effective on/off state it had before the change

### Migrations rewrite only known legacy values, scope by scope, and are idempotent

A migration SHALL inspect each configuration scope separately and write back at the same scope, SHALL rewrite only values it recognizes as legacy — leaving anything unrecognized for the editor to flag — and SHALL be safe to run repeatedly. It runs at activation and MUST NOT be able to fail activation.

#### Scenario: a value is set at the workspace scope only
- **WHEN** the migration runs
- **THEN** the rewritten value lands at the workspace scope
- **AND** no value is introduced at the global scope

#### Scenario: the migration runs a second time
- **WHEN** everything is already migrated
- **THEN** nothing is written

### Retired settings are removed from settings but tolerated if present

Settings that no longer exist SHALL have their persisted values deleted at every scope where they were set, and their presence SHALL never affect behavior. Cleanup is housekeeping, not a precondition — a user whose cleanup did not run must behave identically to one whose did.

#### Scenario: a retired key is still present in settings
- **WHEN** the extension runs
- **THEN** nothing reads it and no behavior depends on it

### Reconciling the companion's command family is add-only and idempotent

Bringing a project to the state where the standard command family is present SHALL add what is missing, remove only artifacts of superseded installs, and never remove the standard family itself. The decision of which operations to run SHALL be separable from executing them, and running the reconciler on an already-correct project SHALL do nothing.

#### Scenario: a superseded install is still present
- **WHEN** reconciliation runs
- **THEN** the superseded artifact is removed and the standard family is re-asserted so its content is not left reverted

#### Scenario: the project is already correct
- **WHEN** reconciliation runs
- **THEN** no operations are issued

### An install-state gate keys on the signal that actually implies the capability

A check answering "is the companion available here?" SHALL test for the presence of the thing that provides the commands the gated UI will dispatch, not a related artifact that merely correlates with it. Gating on a correlate surfaces an option that fails at dispatch with an unknown command.

#### Scenario: a project has the presets but not the extension itself
- **WHEN** the install-state gate is evaluated
- **THEN** it reports not-installed
- **AND** UI that would dispatch the companion command family stays hidden

### Permission mode has exactly one resolver

The permission mode that governs how a dispatched assistant session is launched SHALL be read through one shared helper used by every provider, rather than being re-derived per call site. This area no longer holds an implementation — it is a retired seam whose behavior moved to the provider layer — and it must not grow a second one. [inferred: the module itself is now only a note recording where the behavior went; the single-resolver contract is read from that note, not from code here.]

#### Scenario: a new AI provider is added
- **WHEN** it launches a session
- **THEN** it reads the permission mode through the shared helper rather than reading configuration directly

## Uncovered

_None — every file in all four areas was read. Note that the permission area contains no implementation; it is a single note pointing to the provider layer._
