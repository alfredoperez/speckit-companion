# Contract: file-driven progression

The two functions this change touches, stated as behavior a caller and a test can code against. Identifiers are copied verbatim from the spec's Verbatim Constraints.

## `isCustomWorkflow(steps)`

**Module**: `src/features/specs/customWorkflowProgress.ts`

| Input | Result |
| --- | --- |
| `undefined` | `false` |
| A sequence exactly matching `DEFAULT_WORKFLOW.steps` names, in order | `false` |
| A sequence exactly matching `COMPANION_WORKFLOW.steps` names, in order — including the terminal `mark-complete` | `false` |
| Any sequence containing a name outside the lifecycle set | `true` |
| Any other sequence of lifecycle-only names | `false` |

**Invariant (FR-004)**: for every input, a `true` result before this change stays `true` after it. The change may only turn `true` into `false`, and only for the two shipped sequences.

## `relatedDocsPresent(specDir, allSteps)` — via `stepHasOutput`

**Module**: `src/features/specs/customWorkflowProgress.ts`

| Spec directory contents | Step under test | Result |
| --- | --- | --- |
| `spec.md` only | a step with `includeRelatedDocs` | `false` (core document) |
| `checklists/requirements.md`, where an earlier step declares `subDir: 'checklists'` | a later step with `includeRelatedDocs` | `false` — **this is the fix** |
| `01-01-PLAN.md` loose in the directory | a step with `includeRelatedDocs` | `true` (unchanged) |
| `contracts/api.md`, on the step that itself declares `subDir: 'contracts'` | that same step | `true` — satisfied by the `subDir` branch of `stepHasOutput`, not by related documents |
| Any `.md` under a dot-directory | any step | `false` (unchanged) |

## Composed behavior — the regression the test pins

**Given** `COMPANION_WORKFLOW` steps, a context with `currentStep: specify` and `status: specified` whose recorded run shows the specify step complete, and a spec directory holding exactly `spec.md` and `checklists/requirements.md`:

**Then** `synthesizeCustomProgress` returns the context unchanged, and `getFooterActions` on that result yields an approve action whose label is `Plan` — the assertion written as `approve:Plan`.

**And** the same step is what the stepper renders as pending, satisfying FR-003.
