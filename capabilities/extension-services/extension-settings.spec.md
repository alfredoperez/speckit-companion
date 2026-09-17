# Extension Settings — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Covers what the extension does for the user outside any spec: honouring a choice across a renamed key, offering the always-available entry points in one place, and resolving the launch permission mode in one place.

## Requirements

### A renamed setting key keeps reading its predecessors

Every reader of a renamed configuration key SHALL go through one helper that prefers the new key when explicitly set at any scope, and otherwise falls back to the legacy keys in order. The migration alone is not enough, because it may not have run and the user's real choice may still live on the old key. [NEEDS CLARIFICATION: no such fallback reader exists in the code any more; every key that was renamed is now on the retired list and is deleted at activation. Is this requirement still real, or did it retire with those keys?]

#### Scenario: a user's opt-in was set before the key was renamed and the migration has not run
- **WHEN** the setting is read
- **THEN** the legacy value is honoured and the feature behaves as opted-in

#### Scenario: the new key is explicitly set to off while a stale legacy key says on
- **WHEN** the setting is read
- **THEN** the explicit new value wins

### The overview view is the flat list of the extension's non-spec entry points
<!-- touches: src/features/settings/overviewProvider.ts -->

The overview tree SHALL present one flat level of always-available actions, each carrying the command it dispatches. Anything reached outside a spec, such as the pipeline builder, settings, or bug reporting, belongs here.

#### Scenario: the overview view is expanded
- **WHEN** the tree is asked for the children of any of its items
- **THEN** it returns nothing, because every entry is a leaf that runs a command

### Permission mode has exactly one resolver
<!-- touches: src/features/permission/index.ts -->

Every provider SHALL read the permission mode for launching an assistant session through one shared helper, never re-deriving it per call site. This area is a retired seam whose behavior moved to the provider layer, and it must not grow a second resolver. [inferred: the module itself is now only a note recording where the behavior went; the single-resolver contract is read from that note, not from code here.]

#### Scenario: a new AI provider is added
- **WHEN** it launches a session
- **THEN** it reads the permission mode through the shared helper, not from configuration directly

## Uncovered

_None. Every file in the area was read._
