# Spec: Remove SDD Coupling

**Slug**: 126-remove-sdd-coupling | **Date**: 2026-06-05

## Summary

SDD is hardcoded into the extension as methodology-specific special-casing — built-in workflow IDs (`sdd`, `sdd-fast`), approval-gate membership, an SDD-only "Auto" footer button, a history-relabel branch, plus dedicated authorship enum values (`sdd`, `sdd-skill`) baked into the `.spec-context.json` schema. The SDD pipeline itself already lives outside the extension as Claude Code `/sdd:*` skills, so this coupling is dead weight. As SDD becomes a standalone SpecKit Extension, strip all SDD-specific identifiers, code paths, and schema enum values from the extension — a clean subtraction, no back-compat shim.

## Requirements

- **R001** (MUST): Remove `Workflows.SDD` and `Workflows.SDD_FAST` from `src/core/constants.ts`, their membership in `APPROVAL_GATED_WORKFLOWS`, and the `FooterActionIds.SDD_AUTO` entry.
- **R002** (MUST): Remove the `SDD_AUTO` → `/sdd:auto` dispatch in `src/features/spec-viewer/messageHandlers.ts` and the legacy `SDD_AUTO` reference comment in `footerActions.ts`.
- **R003** (MUST): Remove the `workflow === 'sdd'` history-relabel branch (`by: 'sdd'` → `'sdd-skill'`) in `src/features/spec-viewer/stateDerivation.ts`.
- **R004** (MUST): Drop `sdd` and `sdd-skill` from every `by` enum: `HistoryEntryBy` in `core/types/specContext.ts`, the enum in `core/types/spec-context.schema.json`, the `by` field in `features/workflows/types.ts`, and the embedded prompt schema (`workflow` + `by` enums) in `ai-providers/promptBuilder.ts`.
- **R005** (MUST): Drop `sdd`/`sdd-fast` from the `workflow` enum in the `promptBuilder.ts` embedded schema and `spec-context.schema.json`, leaving `speckit`/`speckit-companion` as the recognized built-ins.
- **R006** (SHOULD): Strip SDD-flavored comments/examples in `workflows/types.ts`, `promptBuilder.ts`, `specContext.ts`, `specContextWriter.ts`, `specDirectoryResolver.ts`, and `footerActions.ts`, rephrasing to methodology-neutral wording where the comment is still useful.
- **R007** (MUST): Update all tests, stories, and fixtures that bake in `by: 'sdd'` / `workflow: 'sdd'` so the suite passes with the enum values removed (notably `PhasesCard.stories.tsx`, `workflowManager.test.ts`, `messageHandlers.test.ts`, `stepHistoryDerivation.test.ts`, `transitionLogger.test.ts`, and the other test files referencing `sdd`).
- **R008** (SHOULD): Remove/retarget SDD content in `README.md` (the `"name":"sdd"` example workflow block, `.sdd.json` branch-auto-creation section, provider-gating note, the `workflow` enum line), `docs/viewer-states.md`, and `docs/spec-context-schema.md`.
- **R009** (MUST): **Rename, do not delete**, `mapSddStepToTab` in `phaseCalculation.ts` (and its consumer in `panelStateComputer.ts`) to a methodology-neutral name (e.g. `mapStepToTab`), preserving behavior — see the constraint below.

## Constraint: `mapSddStepToTab` is misnamed, not SDD-specific

Despite its name, `mapSddStepToTab` maps the **generic** workflow step names (`specify`/`plan`/`tasks`/`implement` — shared by SpecKit and every workflow) onto viewer tab keys, collapsing `tasks`+`implement` onto the Tasks tab. Its consumer `mapStepHistoryToTabKeys` runs for **all** workflows to compute per-tab durations. Deleting it (as a literal reading of the backlog suggests) would break tab-duration display for every workflow, not just SDD. Therefore the SDD coupling here is the **name only** — the fix is to rename it and scrub the "SDD" wording from the surrounding comments, keeping the logic intact.

## Scenarios

### Authorship enum no longer admits SDD values

**When** any code or schema enumerates `HistoryEntryBy` / the `by` field
**Then** the only values are `extension`, `user`, `cli`, and `ai` — `sdd` and `sdd-skill` are absent, and TypeScript compiles with no references to the removed members.

### Viewer renders a spec with no SDD branches

**When** the spec viewer computes panel state and step-history tab durations for any spec
**Then** tab durations still render correctly (tasks+implement collapse onto the Tasks tab) via the renamed `mapStepToTab`, with no `workflow === 'sdd'` relabel branch executed.

### Footer no longer offers the SDD Auto action

**When** the viewer footer actions are built for any spec
**Then** no `sdd-auto` action exists and no message handler dispatches `/sdd:auto`.

### Test suite is green after the strip

**When** `npm test` and `npm run compile` run
**Then** both pass with zero references to the removed `sdd`/`sdd-fast`/`sdd-skill` identifiers in non-comment code.

## Out of Scope

- Building the standalone SpecKit Extension itself (tracked under the SpecKit-extension migration backlog).
- Removing the configurable spec-directory/path options ("remove path options") — separate task.
- UI color/button restyling (Motion.dev) — separate task.
- The `/sdd:*` Claude skills and `.sdd.json` config — they live outside the extension and are not touched here.
- Back-compat shim for old SDD-authored `.spec-context.json` files — explicitly accepted trade-off: their history may no longer render cleanly.
