# Research: Footer next step matches the pending step

## Decision — recognize built-in workflows by their step-name sequence, not by plumbing the workflow name

**Decision**: `isCustomWorkflow` gains a front-loaded check that compares the incoming step-name sequence against the step-name sequences of `DEFAULT_WORKFLOW` and `COMPANION_WORKFLOW`. An exact match short-circuits to `false`. The existing "any step name outside `STEP_NAMES`" rule stays untouched behind it as the fallback.

**Rationale**: Both call sites — `specViewerProvider.ts:1172` and `messageHandlers.ts:362` — receive only `WorkflowStepConfig[]` from a `resolveWorkflowSteps()` that already discarded the workflow identity. Threading the name through would mean changing the return type of two independent `resolveWorkflowSteps` implementations plus the `MessageHandlerDependencies` interface, for a bug whose blast radius is one boolean. `customWorkflowProgress.ts` already imports from `workflowManager` (`getStepFile`), so reading the two exported workflow constants adds no new coupling.

The sequence check is also *strictly additive*, which is the property that matters most here. Layering it in front of the existing rule can only move a workflow from custom to built-in, and only for the two exact sequences the extension itself ships. Nothing that reconstructs progression today stops doing so.

**Alternatives considered**:
- *Plumb the workflow name through `resolveWorkflowSteps`* — the most precise signal, but it changes two provider APIs and a dependency interface to carry one flag. Rejected as disproportionate; revisit if a third consumer ever needs the identity.
- *Add `mark-complete` to the exempt name set* — the smallest possible edit, and what the issue suggests as a fallback. Rejected because it over-exempts: any developer-authored pipeline that happens to use lifecycle names plus a `mark-complete` step would silently lose its file-driven progression, violating FR-004.
- *Compare only against `COMPANION_WORKFLOW`* — fixes the reported case but leaves the rule asymmetric and would break the moment a future built-in adds a non-lifecycle step. Rejected: derive from the shipped constants so new built-in steps are exempt for free.

## Decision — claim sub-folder contents in `relatedDocsPresent` by pruning the directory during the scan

**Decision**: `relatedDocsPresent` collects the set of `subDir` values across all workflow steps, and the recursive scan skips any directory whose path matches one of them, rather than trying to enumerate and claim individual filenames inside it.

**Rationale**: A step's `subDir` is an open-ended container — `checklists/`, `contracts/`, `issues/` all hold files whose names the workflow never predicts. Claiming names is impossible; claiming the container is exact. Pruning at the directory boundary also costs nothing, since the scan already walks directories one entry at a time and short-circuits on the first hit.

This matters beyond the reported bug: `stepHasOutput` already checks a step's own `subDir` on its own path, so pruning it from the related-docs scan removes a double-count without taking evidence away from the step that owns the folder.

**Alternatives considered**:
- *Enumerate files under each `subDir` and add them to `claimed`* — the literal reading of "add each step's subDir contents to claimed". Rejected: it needs an extra filesystem read per sub-folder for a result the prune achieves with a string comparison, and it races a folder being written while the scan runs.
- *Ignore all nested directories in the related-docs scan* — simpler still, but it would stop counting genuinely unclaimed nested documents, narrowing the related-docs signal that developer-authored pipelines depend on. Rejected as a regression against FR-004.

## Decision — assert the fix at the footer, not at the two functions

**Decision**: The regression test builds the exact reported state — `COMPANION_WORKFLOW` steps, a context with the specify step complete, and a real temp directory holding `spec.md` and `checklists/requirements.md` — and asserts that the composed result of `synthesizeCustomProgress` + `getFooterActions` yields an approve action labeled `Plan`.

**Rationale**: The issue notes that `getFooterActions` alone already yields `approve:Plan`; the defect only appears once `synthesizeCustomProgress` has rewritten the context. A unit test on either function in isolation would have passed before the fix. Only the composition reproduces the bug, which is what makes it a regression test rather than a restatement of the implementation.

**Alternatives considered**:
- *Test `isCustomWorkflow(COMPANION_WORKFLOW.steps)` returns false* — worth having as a cheap unit assertion, but it locks in the mechanism rather than the behavior. Kept as a supporting test, not the primary one.
- *Drive the assertion through `specViewerProvider`* — closest to the user, but the provider needs a mocked VS Code panel and workspace, and the repo has a known gap in config-mock harnesses for webview paths. Rejected as cost without added confidence.

## Decision — the "shorts" audit and the fresh-install validation stay verification-only

**Decision**: FR-006 and FR-007 are discharged by evidence, not by product code. The shorts audit is a text search across the working tree and the packaged artifact; the fresh-install validation runs the real `specify` command-line tool into a disposable sandbox under `examples/`.

**Rationale**: The short-form video tooling lives at `~/.claude/skills/speckit-companion-shorts` — a personal skill outside the repository. A search already confirms zero matches in the working tree and zero in `speckit-companion-0.31.5.vsix`. The value here is a recorded check, not a change. Likewise the install flow is already implemented; what is missing is proof it works from nothing, which is an execution, not an edit.

**Alternatives considered**:
- *Add a packaging test that fails the build on a "shorts" match* — tempting as a permanent guard, but it encodes one personal skill's name into the product's test suite. Rejected: the skill was never in the repository, so there is no drift to defend against.
