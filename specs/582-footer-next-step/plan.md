# Implementation Plan: Footer next step matches the pending step

**Branch**: `fix/582-footer-next-step` | **Spec**: [spec.md](./spec.md) | **Issue**: [#582](https://github.com/alfredoperez/speckit-companion/issues/582)
**Size**: normal

## Summary

The spec viewer footer offers the wrong next step on a freshly specified SpecKit Companion spec because two independent guards both fail open. The file-driven progression fallback — meant only for pipelines the developer wrote, which never record anything — misreads the built-in SpecKit Companion pipeline as developer-authored, because its terminal `mark-complete` step is not a lifecycle name. Once that fallback runs, it also miscounts `checklists/requirements.md` as evidence that the planning step produced output, because the related-documents scan only claims top-level filenames and never the contents of a step's own sub-folder. Together they rewrite the in-memory context to `currentStep: plan`, which the footer reads and the stepper does not — hence the disagreement.

The fix closes both, in one module. `isCustomWorkflow` gains a front-loaded exact match against the step-name sequences of the two workflows the extension ships, so a built-in pipeline never enters the fallback. `relatedDocsPresent` prunes any directory a step claims as its `subDir`, so a sub-folder document can never count as another step's related document. Both changes are additive: no workflow that reconstructs progression today stops doing so.

Two verification-only deliverables ride along and change no product code: proof that no "shorts" command, skill, or asset ships in either distribution, and an end-to-end run of the recorded-progress capture from a genuinely fresh install — the real command-line tool initialized into a disposable sandbox, its constitution step run, and the companion spec-kit extension installed through its own installer.

## Project Structure

```
src/features/specs/
  customWorkflowProgress.ts              # both defects live here
  __tests__/
    customWorkflowProgress.test.ts       # existing unit tests + the new regression test
src/features/spec-viewer/
  specViewerProvider.ts                  # call site (line ~1172) — unchanged
  messageHandlers.ts                     # call site (line ~362) — unchanged
src/features/workflows/
  workflowManager.ts                     # exports DEFAULT_WORKFLOW / COMPANION_WORKFLOW — unchanged
examples/582-fresh-install/              # disposable sandbox for the fresh-install validation
CHANGELOG.md                             # user-facing entry under Unreleased
```

**Structure Decision**: The entire product change is contained to `src/features/specs/customWorkflowProgress.ts` and its existing test file. Neither call site needs to change, and no workflow identity is plumbed through the providers — the module reads the two shipped workflow constants directly from `workflowManager`, which it already imports from.

## Constitution Check

| Principle | Assessment |
| --- | --- |
| I. Extensibility and Configuration | **PASS** — developer-authored workflows keep their file-driven progression untouched; the exemption is strictly additive and only recognizes the two sequences the extension itself ships. |
| II. Spec-Driven Workflow | **PASS** — this restores the non-negotiable Specify → Plan → Tasks → Implement order, which the bug was skipping a step of. It also honors "status transitions MUST be explicit user actions, not inferred from heuristics alone" by removing a heuristic that inferred planning progress from a checklist file. |
| III. Visual and Interactive | **PASS** — the change is a correctness fix behind an existing visual surface; the footer and stepper are the visible outcome. |
| IV. Modular Architecture for Complex Features | **PASS** — no new files, no growth in an existing module's responsibilities; two functions in one already-focused module. |

No violations, so no Complexity Tracking table.

Re-checked after Phase 1 design: unchanged, still PASS on all four.

## Approach

1. **`isCustomWorkflow` — exempt the shipped pipelines.** Build a frozen list of built-in step-name sequences from `DEFAULT_WORKFLOW.steps` and `COMPANION_WORKFLOW.steps` at module load. If the incoming sequence matches one exactly (same length, same names, same order), return `false` immediately. Otherwise fall through to the existing `STEP_NAMES` rule, unchanged.

2. **`relatedDocsPresent` — claim each step's sub-folder.** Collect every step's `subDir` into a set alongside the existing `claimed` filenames. During the recursive scan, when an entry is a directory whose relative path is in that set, skip it instead of descending. Everything else about the scan — hidden-directory skipping, core-doc exclusion, first-hit short-circuit — stays as-is.

3. **Regression test.** Add a `describe` block to `src/features/specs/__tests__/customWorkflowProgress.test.ts` that stages a real temp directory with `spec.md` and `checklists/requirements.md`, builds a context at `currentStep: specify` / `status: specified` with the specify step recorded complete, runs it through `synthesizeCustomProgress` with `COMPANION_WORKFLOW.steps` and the real `stepHasOutput`, and asserts the resulting footer's approve action is labeled `Plan`. Add supporting unit assertions: `isCustomWorkflow(COMPANION_WORKFLOW.steps)` is `false`, `isCustomWorkflow(DEFAULT_WORKFLOW.steps)` is `false`, and a sub-folder document does not satisfy a later step's related-documents check while a loose document still does.

4. **Confirm the guard on developer-authored pipelines.** The existing suite already covers the ticket-shaped and GSD-shaped pipelines. Run it unchanged — every one of those tests must still pass without modification. Any edit needed to an existing test is a signal the fix is not additive.

5. **Shorts audit.** Search the working tree and the packaged artifact for the string, and record the result as evidence against FR-006.

6. **Fresh-install validation.** In a disposable sandbox under `examples/`, initialize with the real command-line tool, run the constitution step, install the companion spec-kit extension through its own installer, and confirm a recorded run appears with a readable current step and status.

## Risks

- **Over-exemption.** If a developer's own pipeline happens to declare exactly the SpecKit or SpecKit Companion step-name sequence, it is now treated as built-in. It is also indistinguishable from the built-in by any signal available at these call sites, and the pre-existing lifecycle-name rule already collapsed most of that case. Accepted and recorded as an edge case in the spec.
- **Sub-folder pruning starving a step.** A step that declares both `subDir` and `includeRelatedDocs` — the planning step does exactly this, with `contracts/` — must not lose its own folder as evidence. It does not: `stepHasOutput` checks `subDir` on its own branch before the related-documents branch is ever reached. Covered by an assertion.
