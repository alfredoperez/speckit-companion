# Plan: Remove SDD Coupling

**Spec**: [spec.md](./spec.md)

## Approach

Strip SDD as a built-in methodology from the extension: delete the `sdd`/`sdd-fast` workflow IDs and their approval-gate membership, the `sdd-auto` footer action and its dispatch, the `workflow === 'sdd'` history-relabel branch, and the `sdd`/`sdd-skill` authorship enum values everywhere they're declared (TS unions, JSON schema, embedded prompt schema, runtime `KNOWN_ACTORS` sets). The one piece of "SDD" code that is actually generic — `mapSddStepToTab`, which maps the shared `specify/plan/tasks/implement` step names onto viewer tabs for every workflow — is **renamed** to `mapStepToTab` (not deleted) across its three call sites, preserving behavior. Remaining SDD mentions are comments/examples/docs, rephrased to methodology-neutral wording or removed. Full strip — no back-compat shim.

## Files

### Modify — Core logic & types

- `src/core/constants.ts` — remove `Workflows.SDD`, `Workflows.SDD_FAST`, both entries in `APPROVAL_GATED_WORKFLOWS` (leaving it empty or removing it if now unused), and `FooterActionIds.SDD_AUTO`.
- `src/core/types/specContext.ts` — drop `'sdd'` and `'sdd-skill'` from the `HistoryEntryBy` union; rephrase the "Skill-authored (SDD/SpecKit)" comment to methodology-neutral.
- `src/core/types/spec-context.schema.json` — drop `sdd`/`sdd-skill` from the `by` enum (and `sdd`/`sdd-fast` from any `workflow` enum present).
- `src/features/workflows/types.ts` — drop `'sdd'` from the `by` field union; neutralize the `sdd.plan`/`/sdd:auto`/`/sdd:specify`/`/sdd:implement` example comments.
- `src/ai-providers/promptBuilder.ts` — embedded schema: drop `sdd` from the `workflow` enum and `sdd-skill` from the `by` enum; update the `sdd-auto` example comment.
- `src/core/specDirectoryResolver.ts` — neutralize the "SDD in-progress specs" comment (the `.spec-context.json` detection itself stays).
- `src/features/specs/specContextWriter.ts` — neutralize the "SDD-implement loop" comment.

### Modify — Spec-viewer logic

- `src/features/spec-viewer/stateDerivation.ts` — remove the `workflow === 'sdd'` relabel branch (`by:'sdd'` → `'sdd-skill'`) and its surrounding doc comment; neutralize the "external SDD skills" comment at the top.
- `src/features/spec-viewer/phaseCalculation.ts` — rename `mapSddStepToTab` → `mapStepToTab`; retitle the "Map SDD step field to tab name" comment.
- `src/features/spec-viewer/panelStateComputer.ts` — update the `mapSddStepToTab` import + call site (line ~274) + the `mapStepHistoryToTabKeys` doc comment to the new name.
- `src/features/spec-viewer/specViewerProvider.ts` — update the `mapSddStepToTab` import + 2 call sites (lines ~647, ~699) to `mapStepToTab`.
- `src/features/spec-viewer/messageHandlers.ts` — remove the `FooterActionIds.SDD_AUTO` → `/sdd:auto` handler entry; neutralize the "SDD's `specify` step → `spec.md`" comment.
- `src/features/spec-viewer/footerActions.ts` — remove the legacy `SDD_AUTO` mention from the header comment.
- `src/features/spec-viewer/types.ts` — neutralize the "Active SDD step" / "SDD currentStep" field comments (fields stay; they're generic step state).

### Modify — Webview

- `webview/src/spec-viewer/components/cards/PhasesCard.tsx` — remove `'sdd'` from `KNOWN_ACTORS`; neutralize the "SDD implement loop" comment.
- `webview/src/spec-viewer/components/TimelineEvent.tsx` — remove `'sdd'` from `KNOWN_ACTORS`.
- `webview/src/spec-viewer/types.ts` — rephrase the "Array on SDD specs, Record on speckit specs" comment to describe the two storage shapes neutrally.
- `webview/src/spec-viewer/timelineEvents.ts` — rephrase the "SDD: `Array<…>`" shape comment.
- `webview/src/spec-viewer/editor/currentDoc.ts` — rephrase the "SDD workflow uses step name `specify`" comment.
- `webview/src/spec-editor/CreateSpecMock.tsx` — story-only mock: retarget the literal `SDD` workflow-picker button label and the "SDD pipeline" title/comment to a neutral workflow name.

### Modify — Tests & stories (update fixtures to drop removed enum values)

- `webview/src/spec-viewer/components/cards/PhasesCard.stories.tsx` (35) — replace `by:'sdd'` / `workflow:'sdd'` fixtures with neutral actors (`cli`/`ai`) and a generic workflow id.
- `src/features/workflows/__tests__/workflowManager.test.ts` (19) — retarget `workflow:'sdd'` cases to `'speckit'` or a generic custom workflow; drop assertions tied to SDD being a built-in / approval-gated.
- `src/features/spec-viewer/__tests__/messageHandlers.test.ts` (11) — remove `SDD_AUTO`/`/sdd:auto` dispatch test coverage.
- `src/features/specs/__tests__/stepHistoryDerivation.test.ts` (10) — replace `by:'sdd'`/`'sdd-skill'` fixtures with surviving actors.
- `src/features/specs/__tests__/transitionLogger.test.ts` (9) — same fixture retargeting.
- `webview/src/spec-viewer/__tests__/timelineEvents.test.ts` (7) — same.
- `src/ai-providers/__tests__/promptBuilder.test.ts` (6) — update expected embedded-schema enum assertions (no `sdd`/`sdd-skill`).
- `src/features/specs/__tests__/specContextWipeGuard.test.ts` (5) — fixture retargeting.
- `src/features/spec-viewer/__tests__/stateDerivation.test.ts` (4) — remove the relabel-branch test cases.
- `src/features/spec-viewer/__tests__/phaseCalculation.test.ts` — rename `mapSddStepToTab` references to `mapStepToTab`.
- `src/features/spec-viewer/__tests__/panelStateComputer.test.ts` — same rename if referenced.
- `src/features/specs/__tests__/specContextWriter.test.ts` (2), `specContextReconciler.test.ts` (1), `src/features/spec-viewer/__tests__/transitionsViewerState.test.ts` (1), `optionalCommands.test.ts` (1) — retarget `workflow:'sdd'` / `/sdd:auto` example strings to neutral values.

### Modify — Docs

- `README.md` (30) — remove the `"name":"sdd"` example workflow block, the `.sdd.json` branch-auto-creation section, the SDD provider-gating note, and the `sdd` entry in the documented `workflow` enum.
- `docs/viewer-states.md` (5) — remove/retarget SDD references.
- `docs/spec-context-schema.md` (6) — drop `sdd`/`sdd-skill` from the documented `by` enum and `sdd`/`sdd-fast` from the `workflow` enum; remove SDD examples.
- `docs/sidebar.md` (2) — neutralize SDD references.

## Testing Strategy

- **Compile gate**: `npm run compile` must pass — the `HistoryEntryBy` / `by` union narrowing surfaces every stale `'sdd'`/`'sdd-skill'` literal as a type error, so a clean compile is the primary completeness signal.
- **Unit**: `npm test` green after fixture retargeting.
- **Grep gate**: after the change, `grep -rni "sdd" src/ webview/src/` should return only intentional, methodology-neutral residue (ideally zero) — used as a final completeness check.

## Risks

- **Hidden `mapSddStepToTab` consumer**: there are three call sites (phaseCalculation def, panelStateComputer, specViewerProvider) — a missed rename breaks tab-duration display silently. Mitigation: the compile gate catches an undefined symbol; grep for the old name after renaming.
- **Over-deletion of generic step-state**: `types.ts` step fields and the `.spec-context.json` detection in `specDirectoryResolver.ts` are generic, not SDD-only — only the *comments* change, not the logic. Mitigation: spec R009 + this plan scope those to comment edits explicitly.
- **`workflow` is a free-form string**: removing `sdd` from the *built-in* set doesn't make `workflow:'sdd'` a type error, so tests using it as a plain string won't be caught by the compiler — they must be retargeted by hand/grep, not relied on via compile.
