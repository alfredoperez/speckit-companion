# Extension Settings — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The settings and permission areas hold what the extension does on the user's behalf outside any spec: honour a choice the user already made even after a key changes, offer the always-available entry points in one place, and keep the launch permission mode resolved in one place so no provider drifts.

## Requirements

### A renamed setting key keeps reading its predecessors

Every reader of a renamed configuration key SHALL go through one helper that prefers the new key when it is explicitly set at any scope and otherwise falls back, in order, to the legacy keys. The migration alone is not sufficient — it is best-effort and may not have run, in which case the new key reads as its schema default while the user's real choice still lives on the old key. [NEEDS CLARIFICATION: no such fallback reader exists in the code any more; every key that was renamed is now on the retired list and is deleted at activation. Is this requirement still real, or did it retire with those keys?]

#### Scenario: a user's opt-in was set before the key was renamed and the migration has not run
- **WHEN** the setting is read
- **THEN** the legacy value is honoured and the feature behaves as opted-in

#### Scenario: the new key is explicitly set to off while a stale legacy key says on
- **WHEN** the setting is read
- **THEN** the explicit new value wins

### The overview view is the flat list of the extension's non-spec entry points
<!-- touches: src/features/settings/overviewProvider.ts -->

The overview tree SHALL present a single flat level of always-available actions — no children, no nesting — each carrying the command it dispatches so it works as one click. Anything the user reaches outside a spec (the pipeline builder, settings, bug reporting) belongs here rather than being hidden behind a spec selection.

#### Scenario: the overview view is expanded
- **WHEN** the tree is asked for the children of any of its items
- **THEN** it returns nothing, because every entry is a leaf that runs a command

### Permission mode has exactly one resolver
<!-- touches: src/features/permission/index.ts -->

The permission mode that governs how a dispatched assistant session is launched SHALL be read through one shared helper used by every provider, rather than being re-derived per call site. This area no longer holds an implementation — it is a retired seam whose behavior moved to the provider layer — and it must not grow a second one. [inferred: the module itself is now only a note recording where the behavior went; the single-resolver contract is read from that note, not from code here.]

#### Scenario: a new AI provider is added
- **WHEN** it launches a session
- **THEN** it reads the permission mode through the shared helper rather than reading configuration directly

## Uncovered

_None — every file in the area was read._
