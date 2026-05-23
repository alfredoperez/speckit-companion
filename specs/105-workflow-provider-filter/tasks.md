# Tasks: Provider-Aware Workflow Filtering

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** Add `supportedAiProviders` to `WorkflowConfig` — `src/features/workflows/types.ts` | R001
  - **Do**: Add `supportedAiProviders?: string[];` to the `WorkflowConfig` interface (after `commands`), with a doc comment: omitted or empty array = supported by all providers; otherwise the workflow is only surfaced when the active provider id is in the list.
  - **Verify**: `npm run compile` type-checks clean.
  - **Leverage**: existing optional fields in `WorkflowConfig` ([src/features/workflows/types.ts](../../src/features/workflows/types.ts#L59-L76)).

- [x] **T002** [P] Predicate + provider filter + validation in workflow manager *(depends on T001)* — `src/features/workflows/workflowManager.ts` | R002, R003, R004, R005, R006
  - **Do**: (1) Export `isWorkflowSupportedForProvider(workflow: WorkflowConfig, providerType: AIProviderType): boolean` — returns `true` when `supportedAiProviders` is undefined/empty, else `true` only if `providerType` is included. (2) In `getWorkflows()`, read the active provider via `getConfiguredProviderType()` once, and after the duplicate check skip any custom workflow for which the predicate returns `false` (log a line via `outputChannel`); push `DEFAULT_WORKFLOW` unconditionally so it is never filtered. (3) In `validateWorkflow()`, if `supportedAiProviders` is present and not an array of strings push an error; for each entry not in `AIProviders` push a non-blocking warning.
  - **Verify**: `npm run compile` passes; no circular-import error from importing `getConfiguredProviderType`/`AIProviderType` (if one appears, read `aiProvider` config inline per plan Risks).
  - **Leverage**: `getConfiguredProviderType()` + `AIProviders` ([src/ai-providers/aiProvider.ts](../../src/ai-providers/aiProvider.ts#L419-L426), [src/core/constants.ts](../../src/core/constants.ts#L250-L260)); existing `getWorkflows()` loop ([src/features/workflows/workflowManager.ts](../../src/features/workflows/workflowManager.ts#L160-L189)).

- [x] **T003** [P] Add `supportedAiProviders` to the settings schema *(depends on T001)* — `package.json` | R001
  - **Do**: Add a `supportedAiProviders` property to the `speckit.customWorkflows` items schema (the item schema sets `additionalProperties: false`, so the field is rejected without this): `type: array`, `items: { type: string }`, with a description listing valid provider ids (`claude`, `gemini`, `copilot`, `codex`, `qwen`, `opencode`, `ide-chat`, `claude-vscode`) and noting empty/omitted = all providers.
  - **Verify**: `package.json` stays valid JSON; the field is accepted in settings without a validation squiggle.
  - **Leverage**: existing `commands`/`steps` property definitions in the same schema block ([package.json](../../package.json#L864-L991)).

- [x] **T004** [P] Document `supportedAiProviders` *(depends on T001)* — `README.md` | R001
  - **Do**: Add `supportedAiProviders` to the Custom Workflows properties table (string array; omitted/empty = all providers; lists which workflows show under which providers) and note SDD is Claude-only as the motivating example.
  - **Verify**: README renders; entry matches the field name and semantics.
  - **Leverage**: existing Custom Workflows properties table in README.

- [x] **T005** Filter the spec-editor webview workflow list *(depends on T002)* — `src/features/spec-editor/specEditorProvider.ts` | R003
  - **Do**: Add `supportedAiProviders?: string[]` to the inline `customWorkflows` type in the private `getWorkflows()`, and in the custom-workflow loop skip any workflow for which `isWorkflowSupportedForProvider(...)` (imported from `workflowManager`) returns `false`, using `getConfiguredProviderType()`. Leave the hardcoded `speckit` entry unconditional.
  - **Verify**: `npm run compile` passes; under a non-Claude provider the editor picker omits Claude-only workflows.
  - **Leverage**: existing imports from `workflowManager` and the loop at [src/features/spec-editor/specEditorProvider.ts](../../src/features/spec-editor/specEditorProvider.ts#L54-L100).

- [x] **T006** [P] Tests for predicate, filtering, and validation *(depends on T002)* — `src/features/workflows/__tests__/workflowManager.test.ts` | R002, R004, R005, R006
  - **Do**: Add BDD tests: claude-only workflow hidden when `speckit.aiProvider` is `copilot` and shown when `claude`; no-declaration and empty-array workflows always present; `speckit` default always present even when no custom workflow matches; unknown provider id never matches; `validateWorkflow` errors on non-array `supportedAiProviders` and warns (stays valid) on an unknown id.
  - **Verify**: `npm test` passes.
  - **Leverage**: existing VS Code config mocking pattern in [workflowManager.test.ts](../../src/features/workflows/__tests__/workflowManager.test.ts).
