# Spec: Provider-Aware Workflow Filtering

**Slug**: 105-workflow-provider-filter | **Date**: 2026-05-23

## Summary

Custom workflows can declare which AI providers they support, and the extension
hides any workflow whose supported-providers list excludes the currently active
provider (`speckit.aiProvider`). This removes dead affordances like the
Claude-only SDD workflow (`/sdd:*` skills) appearing under GitHub Copilot,
Gemini, Qwen, or Codex — where its commands dispatch to a host chat that has no
idea what they are and can never succeed. The rule is generic: any future
provider-specific workflow is handled by its own declaration instead of a
one-off check.

## Requirements

- **R001** (MUST): Add an optional `supportedAiProviders?: string[]` field to the
  `WorkflowConfig` type. Each entry is an AI provider id (e.g. `"claude"`,
  `"copilot"`). When the field is omitted or an empty array, the workflow is
  treated as supported by **all** providers (current behavior preserved).
- **R002** (MUST): When the field is present and non-empty, the workflow is
  surfaced only if the active provider — `getConfiguredProviderType()` reading
  `speckit.aiProvider` — is in the list. Otherwise it is hidden entirely (no
  greyed-out / disabled state).
- **R003** (MUST): Apply the same provider filter in **both** workflow-listing
  paths: `getWorkflows()` in [workflowManager.ts](../../src/features/workflows/workflowManager.ts)
  (feeds the QuickPick selector, `getWorkflow`, viewer footer/steps) and the
  private `getWorkflows()` in [specEditorProvider.ts](../../src/features/spec-editor/specEditorProvider.ts)
  (feeds the spec-editor webview workflow picker).
- **R004** (MUST): The built-in default `speckit` workflow must never be filtered
  out — it has no `supportedAiProviders` declaration and always remains the
  baseline so at least one workflow is always available.
- **R005** (SHOULD): Comparison is case-sensitive against the canonical provider
  id strings in `AIProviders` (`claude`, `gemini`, `copilot`, `codex`, `qwen`,
  `opencode`, `ide-chat`, `claude-vscode`). `claude-vscode` and `claude` are
  distinct ids and must each be listed explicitly if both are intended.
- **R006** (SHOULD): `validateWorkflow()` accepts `supportedAiProviders` when it
  is an array of strings; a non-array value is an error and a workflow with an
  unknown provider id logs a warning (the unknown id simply never matches, so
  the workflow stays hidden for every real provider).
- **R007** (SHOULD): A workflow hidden because the active provider was changed
  becomes visible again when the provider is switched back — no caching that
  outlives a `speckit.aiProvider` change.

## Scenarios

### SDD hidden under an incompatible provider

**When** the SDD custom workflow declares `supportedAiProviders: ["claude"]` and
the active provider is `copilot`
**Then** SDD does not appear in the spec-editor workflow picker, the QuickPick
selector, or any footer/step affordance, and `getWorkflow("sdd")` returns
`undefined` (callers fall back to the default `speckit` workflow for display).

### SDD visible under Claude

**When** the same SDD workflow is declared Claude-only and the active provider is
`claude`
**Then** SDD appears in every workflow surface exactly as it does today.

### Workflow with no declaration

**When** a custom workflow omits `supportedAiProviders` (or sets `[]`)
**Then** it appears under every provider, unchanged from current behavior.

### Provider switched at runtime

**When** the user changes `speckit.aiProvider` from `claude` to `gemini` while a
Claude-only workflow exists
**Then** the next time workflows are listed (selector opened, editor opened,
viewer refreshed) that workflow is absent; switching back to `claude` restores
it.

### Default workflow always present

**When** the active provider matches no custom workflow's declaration
**Then** the built-in `speckit` workflow is still listed and selectable.

## Out of Scope

- Making SDD (or any workflow) actually *run* on non-Claude providers.
- Per-command (vs per-workflow) provider gating.
- Runtime probing of provider capabilities — declarations are static config.
- A settings UI to edit `supportedAiProviders` — config/definition-level only.
- Authoring the SDD workflow's `supportedAiProviders: ["claude"]` value itself:
  the SDD workflow definition is installed into the user's
  `speckit.customWorkflows` settings by the **SDD skill installer** (separate
  repo), not shipped by this extension. This spec delivers the extension-side
  field + filtering mechanism that the declaration relies on; tagging SDD is a
  one-line config change made wherever that workflow is defined.
