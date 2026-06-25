# Fold feature deltas into living specs on completion (LS·3)

**Issue:** #363 · **Wave:** Living Specs (Wave 4) · **Surface:** spec-kit extension

## Overview

A feature spec can describe how it changes a capability's requirements — what it adds, modifies, removes, or renames. Today those changes live only in the feature spec, which is a one-time proposal. When the feature is marked complete, this work folds those changes into the durable **living spec** for the capability, so the living spec becomes the lasting record of how the area behaves. This is OpenSpec's "archive" step, riding the `mark-complete` node that already exists.

The whole behavior is opt-in (Living Specs is OFF by default, configured in `.specify/companion.yml`). With the feature off, or with no delta blocks present, marking a spec complete behaves exactly as it does today.

## User Stories (prioritized)

### US1 — Fold an ADDED requirement into the living spec (P1)

When a feature spec carries an `## ADDED Requirements` block and I mark the spec complete, the new requirement (with its scenarios) appears in the resolved capability's living spec.

**Acceptance:**
- ADDED requirements are appended to `capabilities/<name>/spec.md`.
- The synced capability name is recorded in `.spec-context.json` under `livingSpecs.synced`.
- A one-line per-capability sync summary is logged.

### US2 — MODIFIED, REMOVED, RENAMED apply correctly (P1)

- `## MODIFIED Requirements` replaces the matching requirement in the living spec (heading + scenarios).
- `## REMOVED Requirements` deletes the matching requirement.
- `## RENAMED Requirements` renames a requirement's heading (old name → new name), keeping its body.

### US3 — Write-most-specific when several capabilities are in scope (P1)

When more than one capability matches, the fold applies to the **most-specific** matched capability only — unless a delta block carries an explicit `<!-- capability: <name> -->` marker naming a different or additional target, in which case that capability also receives the block.

### US4 — Safe no-ops (P1)

- No delta block present → the living spec is byte-identical before and after (the common additive case).
- Re-running `mark-complete` folds nothing new (idempotent): an ADDED requirement already present is not duplicated.

### US5 — Opt-out (P1)

With Living Specs disabled (`enabled: false`) or no `livingSpecs` config, `mark-complete` behaves exactly as today: no fold, no living-spec writes, no `livingSpecs.synced` field.

## Functional Requirements

### Delta parsing
- Parse top-level delta blocks in the feature spec (`specs/<NNN>-slug/spec.md`): `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, `## RENAMED Requirements`.
- Requirements use the OpenSpec **requirement + scenario** shape (a requirement heading with one or more scenarios), NOT flat `R###` ids.
- An optional `<!-- capability: <name> -->` marker inside a block targets a specific/additional capability.

### Fold application
- Resolve the target capability via the LS·1 resolver (`resolve-spec-paths.py`).
- ADDED → append the requirement+scenarios to the capability spec.
- MODIFIED → replace the matching requirement (by heading) in place.
- REMOVED → delete the matching requirement.
- RENAMED → rename the matching requirement's heading.
- Read-all / write-most-specific: apply to the most-specific matched capability only, unless a delta block carries the explicit marker.

### Integration & safety
- No delta block → clean no-op (living spec untouched).
- Idempotent: re-running folds nothing already present.
- Wired into `mark-complete` after the user-approved completion write.
- Records synced capability names into `.spec-context.json` under `livingSpecs.synced` (additive metadata, kept OUT of the strict capture schema, like LS·2's `livingSpecs.loaded`).
- Opt-in: feature off / no config → no fold, no writes.

## Non-Functional Requirements

- **NFR001 — best-effort:** the fold never fails the host `mark-complete` command. Any miss (no config, feature off, no resolver, parse error) skips silently.
- **NFR004 — automated sandbox test:** a real sandbox demo seeds a real capability spec + a real feature spec with a genuine `## ADDED Requirements` delta, runs the real fold script, and asserts the result (`mode: real+seeded-spec`).

## Out of Scope

- Drift detection (LS·4+).
- Authoring deltas in the GUI.
- Non-`.spec.md` capability tiers (`.arch.md`/`.coverage.md`).

## Open question resolved

Fold-back lives **inside the `mark-complete` command body** (shelling the script after the completion write), not a separate `sync` node — it keeps the terminal step atomic and reuses the resolved-dir context the command already has.
