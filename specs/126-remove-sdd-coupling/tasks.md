# Tasks: Remove SDD Coupling

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** Remove SDD workflow IDs & footer action — `src/core/constants.ts` | R001
  - **Do**: Delete `Workflows.SDD` and `Workflows.SDD_FAST`; remove both from `APPROVAL_GATED_WORKFLOWS` (leave it as an empty `readonly string[]`); delete `FooterActionIds.SDD_AUTO`. Update the `Workflows` doc comment if it names SDD.
  - **Verify**: `tsc` flags every now-dangling reference (T005/T007 resolve them); `grep -n "SDD" src/core/constants.ts` returns nothing.

- [x] **T002** [P] Strip authorship enum from core types & schema — `src/core/types/specContext.ts`, `src/core/types/spec-context.schema.json` | R004
  - **Do**: Remove `'sdd'` and `'sdd-skill'` from the `HistoryEntryBy` union (leaving `'extension' | 'user' | 'cli' | 'ai'`); rephrase the "Skill-authored (SDD/SpecKit)" comment to methodology-neutral. In the schema, drop `sdd`/`sdd-skill` from the `by` enum and `sdd`/`sdd-fast` from any `workflow` enum.
  - **Verify**: `grep -ni sdd` both files → nothing; `npm run compile` surfaces stale `'sdd'` literals elsewhere (expected — fixed in T010).

- [x] **T003** [P] Strip SDD from embedded prompt schema — `src/ai-providers/promptBuilder.ts` | R004, R005, R006
  - **Do**: In the embedded schema string, drop `sdd` from the `workflow` enum and `sdd-skill` from the `by` enum; update the `sdd-auto` example comment to a neutral multi-step example.
  - **Verify**: `grep -ni sdd src/ai-providers/promptBuilder.ts` → nothing.

- [x] **T004** [P] Strip `by:'sdd'` & SDD comments — `src/features/workflows/types.ts` | R004, R006
  - **Do**: Remove `'sdd'` from the `by: 'extension' | 'sdd' | string` union (→ `'extension' | string`); neutralize the `sdd.plan` / `/sdd:auto` / `/sdd:specify` / `/sdd:implement` example comments.
  - **Verify**: `grep -ni sdd src/features/workflows/types.ts` → nothing.

- [x] **T005** [P] Rename `mapSddStepToTab` → `mapStepToTab` across all call sites — `src/features/spec-viewer/phaseCalculation.ts`, `src/features/spec-viewer/panelStateComputer.ts`, `src/features/spec-viewer/specViewerProvider.ts` | R009
  - **Do**: Rename the function in `phaseCalculation.ts` and retitle its "Map SDD step field to tab name" comment. Update the import + call site in `panelStateComputer.ts` (and the `mapStepHistoryToTabKeys` doc comment) and the import + both call sites (~647, ~699) in `specViewerProvider.ts`.
  - **Verify**: `grep -rn "mapSddStepToTab" src/` → nothing; behavior preserved (tasks+implement still collapse onto the Tasks tab).
  - **Leverage**: existing `mapStepHistoryToTabKeys` consumer pattern in `panelStateComputer.ts`.

- [x] **T006** [P] Remove SDD history-relabel branch — `src/features/spec-viewer/stateDerivation.ts` | R003, R006
  - **Do**: Delete the `if (ctx.workflow === 'sdd') return raw;` + `by === 'sdd' ? … 'sdd-skill'` relabel logic and its doc comment; neutralize the top-of-file "external SDD skills" comment. Return `raw` unmodified.
  - **Verify**: `grep -ni sdd src/features/spec-viewer/stateDerivation.ts` → nothing; `npm run compile` clean for this file.

- [x] **T007** [P] Remove SDD Auto dispatch & comment *(depends on T001)* — `src/features/spec-viewer/messageHandlers.ts`, `src/features/spec-viewer/footerActions.ts` | R002, R006
  - **Do**: Delete the `[FooterActionIds.SDD_AUTO]: (dir, deps) => handleClarify(dir, deps, "/sdd:auto")` handler entry; neutralize the "SDD's `specify` step → `spec.md`" comment. In `footerActions.ts`, remove the legacy `SDD_AUTO` mention from the header comment.
  - **Verify**: `grep -ni sdd` both files → nothing; `npm run compile` clean.

- [x] **T008** [P] Neutralize remaining SDD comments (logic unchanged) — `src/core/specDirectoryResolver.ts`, `src/features/specs/specContextWriter.ts`, `src/features/spec-viewer/types.ts` | R006
  - **Do**: Rephrase the "SDD in-progress specs", "SDD-implement loop", and "Active SDD step"/"SDD currentStep" comments to methodology-neutral wording. **Do not change any logic** — these are generic step-state/detection comments.
  - **Verify**: `grep -ni sdd` all three files → nothing; no behavior change.

- [x] **T009** [P] Strip SDD from webview runtime & mock — `webview/src/spec-viewer/components/cards/PhasesCard.tsx`, `webview/src/spec-viewer/components/TimelineEvent.tsx`, `webview/src/spec-viewer/types.ts`, `webview/src/spec-viewer/timelineEvents.ts`, `webview/src/spec-viewer/editor/currentDoc.ts`, `webview/src/spec-editor/CreateSpecMock.tsx` | R004, R006
  - **Do**: Remove `'sdd'` from both `KNOWN_ACTORS` sets (PhasesCard.tsx, TimelineEvent.tsx); rephrase the "SDD implement loop", "Array on SDD specs", "SDD: Array<…>", and "SDD workflow uses step name" comments neutrally. In `CreateSpecMock.tsx` (story-only mock), retarget the literal `SDD` picker-button label and the "SDD pipeline" title/comment to a neutral workflow name.
  - **Verify**: `grep -rni sdd webview/src/spec-viewer webview/src/spec-editor/CreateSpecMock.tsx` (excluding tests/stories) → nothing.

- [x] **T010** Retarget all test/story fixtures *(depends on T001–T009)* — `webview/src/spec-viewer/components/cards/PhasesCard.stories.tsx`, `src/features/workflows/__tests__/workflowManager.test.ts`, `src/features/spec-viewer/__tests__/messageHandlers.test.ts`, `src/features/specs/__tests__/stepHistoryDerivation.test.ts`, `src/features/specs/__tests__/transitionLogger.test.ts`, `webview/src/spec-viewer/__tests__/timelineEvents.test.ts`, `src/ai-providers/__tests__/promptBuilder.test.ts`, `src/features/specs/__tests__/specContextWipeGuard.test.ts`, `src/features/spec-viewer/__tests__/stateDerivation.test.ts`, `src/features/spec-viewer/__tests__/phaseCalculation.test.ts`, `src/features/spec-viewer/__tests__/panelStateComputer.test.ts`, `src/features/specs/__tests__/specContextWriter.test.ts`, `src/features/specs/__tests__/specContextReconciler.test.ts`, `src/features/spec-viewer/__tests__/transitionsViewerState.test.ts`, `src/features/spec-viewer/__tests__/optionalCommands.test.ts` | R007
  - **Do**: Replace `by:'sdd'`/`'sdd-skill'` fixtures with surviving actors (`cli`/`ai`/`extension`); retarget `workflow:'sdd'` to `'speckit'` or a generic custom id; remove SDD_AUTO / `/sdd:auto` dispatch + relabel-branch test cases; update promptBuilder expected-enum assertions; rename `mapSddStepToTab`→`mapStepToTab` in phaseCalculation/panelStateComputer tests; retarget the `isOptionalCommand('/sdd:auto')` example string.
  - **Verify**: `npm test` green; `grep -rni sdd src/ webview/src/` (test files) → only intentional neutral residue.

- [x] **T011** [P] Remove/retarget SDD docs — `README.md`, `docs/viewer-states.md`, `docs/spec-context-schema.md`, `docs/sidebar.md` | R008
  - **Do**: README — delete the `"name":"sdd"` example workflow block, the `.sdd.json` branch-auto-creation section, the SDD provider-gating note, and the `sdd` entry in the documented `workflow` enum. Schema doc — drop `sdd`/`sdd-skill` from the `by` enum and `sdd`/`sdd-fast` from the `workflow` enum, remove SDD examples. viewer-states + sidebar — neutralize SDD references. Keep prose unwrapped (single logical line per paragraph).
  - **Verify**: `grep -ni sdd README.md docs/viewer-states.md docs/spec-context-schema.md docs/sidebar.md` → only intentional residue (ideally none).

- [x] **T012** Verification gate *(depends on T001–T011)* — repo-wide | R001–R009
  - **Do**: Run `npm run compile` and `npm test`. Then `grep -rni "sdd" src/ webview/src/` and confirm any remaining hits are intentional methodology-neutral residue (or zero).
  - **Verify**: compile clean, suite green, grep audit clean.
