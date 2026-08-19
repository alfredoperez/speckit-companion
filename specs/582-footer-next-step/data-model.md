# Data Model: Footer next step matches the pending step

This feature introduces no new persisted entity and changes no schema. It reshapes how two existing in-memory structures are read.

## WorkflowStepConfig (existing — read differently)

One step of a workflow, as declared in `src/features/workflows/types.ts`.

| Field | Meaning | Role in this change |
| --- | --- | --- |
| `name` | The step's identifier (`specify`, `plan`, `tasks`, `implement`, `mark-complete`, or anything a developer chooses). | The sequence of these across a workflow becomes the built-in fingerprint. |
| `file` | The document the step produces, defaulting to `<name>.md`. | Unchanged; already claimed by `relatedDocsPresent`. |
| `subFiles` | Extra documents that also count as the step's output. | Unchanged; already claimed. |
| `subDir` | A folder whose contents belong to this step (`checklists`, `contracts`, `issues`). | **Newly claimed.** Its contents stop counting as another step's related documents. |
| `includeRelatedDocs` | Whether unclaimed documents in the spec directory count as this step's output. | Unchanged; the set it draws from shrinks by exactly the claimed sub-folders. |
| `actionOnly` | The step produces no document. | Unchanged. |

**Validation rule added**: a `subDir` value is a claimed container. No file beneath it may be attributed to a step other than the one that declares it.

## Built-in workflow fingerprint (new, derived, in-memory)

A frozen list of step-name sequences, computed once at module load from the two workflow constants the extension exports.

| Attribute | Value |
| --- | --- |
| Source | `DEFAULT_WORKFLOW.steps` and `COMPANION_WORKFLOW.steps` |
| Shape | An array of string arrays — one ordered name sequence per shipped workflow |
| Lifetime | Module-level constant; never mutated |
| Equality | Exact: same length, same names, same order |

**Relationship**: consumed only by `isCustomWorkflow`, as a short-circuit in front of the existing rule. It is derived from the shipped constants rather than hand-written, so a future built-in step is exempt without a second edit.

## Reconstructed progression (existing — narrower trigger)

The synthetic run `synthesizeCustomProgress` builds from documents on disk.

| Transition | Before | After |
| --- | --- | --- |
| Built-in workflow, disk ahead of context | Rewrites `currentStep` in memory | Returns the context untouched |
| Developer-authored workflow, disk ahead of context | Rewrites `currentStep` in memory | Unchanged — still rewrites |
| Developer-authored workflow, only a claimed sub-folder document present | Could read a later step as produced | No longer counts that document for a later step |

No state is persisted by any of these paths: the reconstruction is in-memory only, which is why the bug showed in the footer but never in the stepper or in `.spec-context.json`.
