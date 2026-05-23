# Plan: Provider-Aware Workflow Filtering

**Spec**: [spec.md](./spec.md)

## Approach

Add an optional `supportedAiProviders?: string[]` field to `WorkflowConfig` and
introduce a single shared predicate, `isWorkflowSupportedForProvider(workflow,
providerType)`, in [workflowManager.ts](../../src/features/workflows/workflowManager.ts).
Both workflow-listing paths — `getWorkflows()` in `workflowManager.ts` (selector,
viewer, `getWorkflow`) and the private `getWorkflows()` in
[specEditorProvider.ts](../../src/features/spec-editor/specEditorProvider.ts)
(editor webview picker) — filter their custom-workflow loop through that predicate
against the active provider from `getConfiguredProviderType()`. The default
`speckit` workflow is never run through the filter, so a workflow is always
available. Empty/omitted list = supported everywhere, preserving today's behavior.

## Files

### Modify

- `src/features/workflows/types.ts` — add `supportedAiProviders?: string[]` to
  `WorkflowConfig` with a doc comment (omitted/empty = all providers).
- `src/features/workflows/workflowManager.ts` — (1) export
  `isWorkflowSupportedForProvider(workflow, providerType)`: returns `true` when
  `supportedAiProviders` is absent/empty, else `true` only if `providerType` is in
  the list; (2) in `getWorkflows()`, after the duplicate check, skip any custom
  workflow the active provider doesn't support (read provider via
  `getConfiguredProviderType()`); `DEFAULT_WORKFLOW` is pushed unconditionally;
  (3) extend `validateWorkflow()` to error when `supportedAiProviders` is present
  and not an array of strings, and warn (non-blocking) on a provider id not in
  `AIProviders`.
- `src/features/spec-editor/specEditorProvider.ts` — add `supportedAiProviders?:
  string[]` to the inline `customWorkflows` type, and reuse
  `isWorkflowSupportedForProvider` to skip unsupported workflows in the custom
  loop (the hardcoded `speckit` entry stays).
- `package.json` — add a `supportedAiProviders` property to the
  `speckit.customWorkflows` items schema (array of strings; the item schema has
  `additionalProperties: false`, so without this the field is rejected by settings
  validation). Describe it and reference the valid provider ids.
- `README.md` — document `supportedAiProviders` in the Custom Workflows
  properties table (per the CLAUDE.md feature→README map: a new sub-document /
  workflow property).
- `src/features/workflows/__tests__/workflowManager.test.ts` — tests for the
  predicate, provider-aware `getWorkflows()` filtering, default-always-present,
  and validation of the new field.

## Testing Strategy

- **Unit**: with the VS Code config mock, set `speckit.aiProvider` and
  `speckit.customWorkflows`, then assert `getWorkflows()` includes/excludes each
  workflow. Cover: claude-only workflow hidden under `copilot`, shown under
  `claude`; no-declaration workflow always present; empty-array treated as all;
  `speckit` default always present even when nothing else matches; unknown
  provider id never matches (stays hidden).
- **Edge cases**: `validateWorkflow` rejects a non-array `supportedAiProviders`;
  warns on an unknown id but keeps the workflow valid.

## Risks

- Importing `getConfiguredProviderType` into `workflowManager.ts`: verify it
  introduces no circular import (`aiProvider.ts` imports only `constants`, not
  `workflows`, so it should be safe). If a cycle appears, read the config inline
  (`getConfiguration('speckit').get('aiProvider', 'claude')`) instead.
