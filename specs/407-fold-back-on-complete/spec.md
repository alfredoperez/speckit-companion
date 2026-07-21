# Fold changes back into every living spec on completion

## Overview

Completing a feature that changed a loaded capability's behavior should actually update that capability's living spec, automatically, and route each capability its own requirements. Today the fold-back only fires when someone hand-writes a delta block, and even then it applies one delta set to one capability. This closes the loop: the AI authors a delta block per changed capability at completion, and the fold routes each block to the right spec, reviewed in the feature's PR diff.

## User Stories

### US1 (P1) — Completion writes the change back without a hand-authored block

As a developer finishing a feature through the Companion pipeline, I want completion to author and fold the delta for each capability I changed, so the living record stays current without me remembering to write deltas by hand.

**Acceptance**
- The mark-complete node instructs the AI to append a delta block per loaded+changed capability before folding.
- The fold applies those blocks; a completion that changed a capability results in a real write to that capability's spec.

### US2 (P1) — Each capability spec gets only its own requirements

As a maintainer reviewing the fold, I want a feature that changed several capabilities to fold each capability's requirement into that capability's spec only, so specs don't accumulate each other's requirements.

**Acceptance**
- Two delta blocks marked for different capabilities route to their own specs.
- A capability spec never receives a requirement marked for another capability.
- Both synced names are recorded on `livingSpecs.synced`.

### US3 (P2) — Nothing regresses for the single-capability path

As an existing user, I want a plain unmarked delta block to keep folding into the changed-files-matched capability, idempotently, so today's behavior is unbroken.

**Acceptance**
- One unmarked block folds into the matched capability.
- Re-folding the same set is a no-op.

## ADDED Requirements
<!-- capability: capture-runtime -->

### The fold routes each capability's requirements to its own spec

A feature spec may declare a delta block per capability, each marked `<!-- capability: <name> -->`. The fold applies to each capability only the requirement units marked for it, plus unmarked units when that capability is the changed-files-matched default. A requirement marked for one capability never lands in another capability's spec.

#### Scenario: two blocks marked for different capabilities

- **WHEN** a completing feature's spec carries an `ADDED` block marked for capability A and another marked for capability B
- **THEN** A's spec receives A's requirement only, B's spec receives B's requirement only, and both names are recorded on `livingSpecs.synced`

#### Scenario: an unmarked block on a multi-capability fold

- **WHEN** a block carries no capability marker
- **THEN** it folds into the capability the changed files resolved to, and not into any marker-routed capability

## ADDED Requirements
<!-- capability: companion-commands -->

### Completion authors a delta block per changed capability before folding

The mark-complete step instructs the AI to read `livingSpecs.loaded` and, for each loaded capability whose behavior the feature changed, append a marked delta block to the feature spec capturing the real requirement, then fold. Capabilities merely read are skipped.

#### Scenario: a feature changed a loaded capability

- **WHEN** the feature loaded a capability and changed its behavior
- **THEN** the completion step authors a delta block marked for that capability, and the fold writes the requirement into that capability's spec

#### Scenario: a capability was read but not changed

- **WHEN** the feature loaded a capability but did not change its behavior
- **THEN** no delta block is authored for it and its spec is left untouched
