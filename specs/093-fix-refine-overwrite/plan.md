# Plan: Fix Refine Template Overwrite

**Spec**: [spec.md](./spec.md)

## Approach

In `src/features/spec-viewer/messageHandlers.ts`, `handleSubmitRefinements` (lines 562–592) builds a slash-command prompt — `\`/${currentStep.command} ${targetPath}${context}\`` — and pipes it to the AI CLI. Replace that with a freeform direct-edit prompt that names the target file (`{spec,plan,tasks}.md` derived from `instance.state.currentDocument`) and explicitly forbids running setup scripts, regenerating from a template, or replacing the file. The `resolveWorkflowSteps` lookup (used here only to derive the slash-command name) is no longer needed for this path; refinement is the same operation regardless of step.

`executeStepInTerminal` (lines 297–310), which the regular step-advance buttons use, is left untouched.

## Files

### Modify

- `src/features/spec-viewer/messageHandlers.ts` — rewrite the body of `handleSubmitRefinements`: drop the workflow-step lookup; build a direct-edit prompt with explicit "do not regenerate" guardrails; pass it to `deps.executeInTerminal`. Keep the existing `refinementText` bullet formatting (lines 573–575).
- `src/features/spec-viewer/__tests__/messageHandlers.test.ts` — add a `submitRefinements` describe block asserting prompt shape (no slash prefix, contains guardrail strings, contains line-anchored bullets).

## Testing Strategy

- **Manual**: With the extension installed locally, open a spec at the plan step, add line comments, click Refine. Confirm via the SpecViewer output channel that the dispatched prompt starts with the direct-edit instruction (not `/speckit.plan`) and that `plan.md` retains its existing content after the AI run.
- **Unit**: Add a test in `src/features/spec-viewer/__tests__/messageHandlers.test.ts` that captures the prompt passed to `executeInTerminal` for a `submitRefinements` message and asserts: (a) it does NOT start with `/`, (b) it contains the "DO NOT" guardrail language, (c) it includes the bulleted line comments.
