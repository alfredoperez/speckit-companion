# Settings — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How extension settings survive being renamed, retyped, or retired without stranding a value the user already set, and the overview view that exposes the extension's non-spec entry points.

## Requirements

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

### The overview view is the flat list of the extension's non-spec entry points

The overview tree SHALL present a single flat level of always-available actions — no children, no nesting — each carrying the command it dispatches so it works as one click. Anything the user reaches outside a spec (the pipeline builder, settings, bug reporting) belongs here rather than being hidden behind a spec selection.

#### Scenario: the overview view is expanded
- **WHEN** the tree is asked for the children of any of its items
- **THEN** it returns nothing, because every entry is a leaf that runs a command

## Uncovered

_None — every file in the settings area was read. The preset reconciler and install-state gate are enforced by their tests and carry no requirement here._
