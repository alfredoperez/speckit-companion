# Plan: Fix Analyze Spec-Context Update

**Spec**: [spec.md](./spec.md)

## Approach

Extend `CANONICAL_SUBSTEPS` to include `analyze` and `clarify` (with empty substep arrays — these steps don't decompose into sub-phases), then add matching entries to `COMPLETED_STATUS_BY_STEP` and `DONE_PHRASE_BY_STEP` in `promptBuilder.ts`. Guard the "Canonical substeps for X:" line so an empty array renders cleanly ("none — single-pass step") instead of a trailing colon. The result: `buildPrompt({ step: 'analyze', ... })` emits the standard context-update preamble identical in shape to `tasks` / `plan`, the AI flips status back to `ready-to-implement` and appends a completion history entry, and the viewer clears its "needs regeneration" state on the next file-watcher tick — all without touching `.specify/extensions.yml` or any user-local skill files.

## Files

### Modify

- `src/core/types/specContext.ts` — add `analyze: []` and `clarify: []` to the `CANONICAL_SUBSTEPS` record so `PromptStep` accepts both as known steps.
- `src/ai-providers/promptBuilder.ts` — add `analyze` and `clarify` entries to `COMPLETED_STATUS_BY_STEP` (`ready-to-implement` / `specified`) and `DONE_PHRASE_BY_STEP` (`Done analyzing` / `Done clarifying`); in `renderPreamble`, when the substep array is empty, render `Canonical substeps for {step}: none — single-pass step.` instead of a dangling colon line.
- `src/ai-providers/__tests__/promptBuilder.test.ts` — extend the "wraps command with preamble for each known step" loop, the "preamble stays under ~6500 chars" loop, and the "leave currentStep" loop to cover `analyze` and `clarify`; add a focused assertion that `analyze` finishes at `ready-to-implement` (not `tasking`) and `clarify` finishes at `specified`.
- `CHANGELOG.md` — add a bullet under the next Unreleased version noting the fix and the GitHub issue (#194).

## Testing Strategy

- **Unit**: `npm test -- promptBuilder.test.ts` — covers the table changes and rendering guard. All existing assertions for `specify` / `plan` / `tasks` / `implement` must pass byte-identical; new assertions cover `analyze` and `clarify` emission, correct completed status, correct done phrase, and the empty-substep rendering line.
- **Manual** (validation): in an Extension Development Host, open a spec at `ready-to-implement`, click Analyze, observe (a) the dispatched terminal command includes the `<!-- speckit-companion:context-update -->` block and (b) after the AI runs, `.spec-context.json` gains an analyze `kind: "complete"` history entry with status flipped back to `ready-to-implement`.

## Risks

- **Empty-substep rendering line drift**: changing the "Canonical substeps for X:" line for empty arrays could break a future test that greps for the existing exact wording. Mitigation: the only existing test that matches that line (`'Canonical substeps for plan: research, design'`) targets `plan`, which still has substeps — unaffected.
- **Status regression on analyze-after-tasks**: `startStep('analyze')` flips status from `ready-to-implement` back to `tasking` (existing behavior in `deriveInProgressStatus`); the preamble's completion instruction must flip it back to `ready-to-implement`, which `COMPLETED_STATUS_BY_STEP['analyze']` now enforces. If the AI skips the final-write box, the spec stays stuck on `tasking` — same failure mode that already exists for the four supported steps, not a new one.
