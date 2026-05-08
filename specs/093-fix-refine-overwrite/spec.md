# Spec: Fix Refine Template Overwrite

**Slug**: 093-fix-refine-overwrite | **Date**: 2026-05-03

## Summary

The Refine button in the spec viewer dispatches the per-step slash command (e.g. `/speckit.plan`) plus refinement context. For the plan step, that command's first action is `setup-plan.sh`, which copies the plan template OVER the user's existing `plan.md` and destroys their work (issue #153). Replace the slash-command dispatch with a freeform direct-edit prompt so refinement edits the existing file in place across all three doc types.

## Requirements

- **R001** (MUST): The refinement code path in `handleSubmitRefinements` MUST NOT dispatch any per-step slash command (`/speckit.plan`, `/speckit.specify`, `/speckit.tasks`, or any equivalent from a custom workflow).
- **R002** (MUST): The refinement prompt MUST instruct the AI to edit the target file in place and explicitly forbid running setup scripts, regenerating from a template, or replacing the file.
- **R003** (MUST): The fix MUST apply uniformly to all three refinable doc types (`spec`, `plan`, `tasks`).
- **R004** (MUST): The regular step-execution path (`executeStepInTerminal`, used when the user clicks a step button to advance) MUST continue to dispatch the per-step slash command unchanged — only the refinement path is rewired.
- **R005** (SHOULD): The refinement prompt SHOULD include the user's line-anchored comments verbatim (line number, line content snippet, comment) using the same bullet format the current implementation produces.

## Scenarios

### Plan refinement preserves existing content

**When** the user adds line comments on `plan.md` and clicks "Refine"
**Then** the AI receives a direct-edit prompt that targets `plan.md` and explicitly forbids running `setup-plan.sh` or replacing the file, and the existing plan content is preserved.

### Spec and tasks refinement use the same direct-edit path

**When** the user submits refinements on `spec.md` or `tasks.md`
**Then** the dispatched prompt does not invoke `/speckit.specify` or `/speckit.tasks`; it instructs the AI to edit the file in place using the same forbid-regeneration language as plan refinement.

### Step-execution path is unchanged

**When** the user clicks a step button (e.g. "Plan") to advance to a new phase
**Then** `executeStepInTerminal` still dispatches `/speckit.plan` (or the workflow's configured command) — refinement-only changes do not regress the create-from-template flow.

## Out of Scope

- Fixing the SpecKit CLI's `/speckit.plan` skill (lives outside this extension; users install it separately).
- Changes to the line-comment UI in the webview.
- Lifecycle/status updates for refinement runs — refinement is an in-place edit and should not advance `.spec-context.json` step state.
