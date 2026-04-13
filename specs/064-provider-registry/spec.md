# Spec: Provider Registry

**Slug**: 064-provider-registry | **Date**: 2026-04-13

## Summary

Consolidate scattered AI-provider configuration into a single registry so adding a new provider takes ~25 declarative lines instead of touching 6–8 files. Add OpenCode support (#72), fix silent Copilot permission failures in interactive mode (#78), and clean up the spec-editor terminal dispatch by moving Post-Specification instructions into the temp markdown file.

## Requirements

### Phase 1 — Registry pattern

- **R001** (MUST): `ProviderPaths` interface in `src/ai-providers/aiProvider.ts` includes `globalSteeringFile: string | null`, `configDir: string`, `quickPickIcon: string`, `quickPickDescription: string`, `supportsInteractivePermissions: boolean`, and `autoApproveFlag: string` fields, populated for every entry in `PROVIDER_PATHS`.
- **R002** (MUST): `aiProviderFactory.ts` replaces its switch statement with a `PROVIDER_CONSTRUCTORS: Record<AIProviderType, () => IAIProvider>` lookup, and `getSupportedProviders()` is derived from `Object.keys(PROVIDER_PATHS)`.
- **R003** (MUST): `promptForProviderSelection()` builds its QuickPick items by iterating `PROVIDER_PATHS`, using each provider's `quickPickIcon`, `displayName`, and `quickPickDescription` — no hardcoded list of providers in the function.
- **R004** (MUST): `steeringExplorerProvider.ts` file watchers and visibility checks read agent/skill paths from `getProviderPaths()` instead of hardcoded `.claude/...` patterns; sections show or hide based on `providerPaths.agentsDir`/`providerPaths.skillsDir` being non-empty (no `if (providerType === AIProviders.CLAUDE)` checks).
- **R005** (MUST): `getSteeringFilePaths` resolves global and project steering paths from the new `globalSteeringFile` and existing `steeringFile` fields — the per-provider switch is removed.
- **R006** (MUST): In `steeringManager.ts`, `createProjectClaudeMd` is renamed to `createProjectSteeringFile` and `createUserClaudeMd` to `createUserSteeringFile`; all call sites (including command registrations in `steeringExplorerProvider.ts`) are updated in the same change so no broken references remain.

### Phase 2 — OpenCode (#72)

- **R007** (MUST): `AIProviders.OPENCODE = 'opencode'` is added to `src/core/constants.ts`, with a corresponding entry in `PROVIDER_PATHS` (steering=`AGENTS.md`, agents=`.opencode/agent/*.md`, config=`.opencode/opencode.jsonc`) and a new `src/ai-providers/openCodeProvider.ts` modeled on `qwenCliProvider.ts`.
- **R008** (MUST): Adding OpenCode requires only: 1 entry in `PROVIDER_PATHS`, 1 new provider file, 1 line in the factory `PROVIDER_CONSTRUCTORS` lookup, 1 line in the barrel export, 1 entry in the `package.json` `speckit.aiProvider` enum.

### Phase 3 — Clean spec-editor dispatch

- **R009** (MUST): `tempFileManager.ts` exposes an `appendToMarkdownFile(filePath, content)` (or equivalent) method, and `specEditorProvider.ts` appends the Post-Specification instruction block to the temp `spec.md` file rather than to the prompt string.
- **R010** (MUST): The terminal command dispatched by `specEditorProvider.ts` is of the form `{command} {tempFilePath}` — the markdown content and instruction block no longer appear in the visible terminal line.

### Phase 4 — Permissions (#78)

- **R011** (MUST): A `validatePermissionMode()` function runs during extension activation and on changes to `speckit.permissionMode` or `speckit.aiProvider`. When `interactive` is set but the active provider has `supportsInteractivePermissions: false` and a non-empty `autoApproveFlag`, it shows a warning notification with a "Switch to Auto-Approve" action that updates the setting.
- **R012** (MUST): A shared `getPermissionFlagForProvider(providerType)` utility returns the appropriate flag using `PROVIDER_PATHS[providerType].autoApproveFlag` and the current permission mode; per-provider `getPermissionFlag()` implementations delegate to it.
- **R013** (SHOULD): The `speckit.permissionMode` description in `package.json` clarifies which providers support interactive prompting.
- **R014** (SHOULD): When the registry adds future capability flags (e.g., `supportsHiddenPromptDispatch`), call sites use the flag rather than `if (providerType === AIProviders.X)` checks — this spec establishes the pattern for `supportsInteractivePermissions`.

## Scenarios

### Switching providers updates the steering sidebar

**When** the user changes `speckit.aiProvider` from Claude to Gemini in settings
**Then** the steering sidebar reloads, file watchers re-bind to `GEMINI.md`/`.gemini/*` paths from `PROVIDER_PATHS`, the Skills section is hidden (Gemini's `skillsDir` is empty), and no hardcoded `.claude/` paths are still being watched.

### Provider selection prompt lists every registered provider

**When** the user runs the "Choose AI Provider" command on a fresh install
**Then** the QuickPick shows all six providers (Claude, Copilot, Gemini, Codex, Qwen, OpenCode) with each entry's icon and description sourced from the corresponding `PROVIDER_PATHS` entry.

### Adding OpenCode requires only registry edits

**When** a developer follows R008 to add OpenCode
**Then** OpenCode appears in the QuickPick, its `isInstalled()` returns false gracefully when the CLI is missing, the steering sidebar shows `AGENTS.md` and `.opencode/agent/` agents, and no other source file (factory switches, sidebar conditionals, command registrations) needs to change.

### Copilot + interactive mode warns the user

**When** `speckit.aiProvider` is `copilot` and `speckit.permissionMode` is `interactive`
**Then** `validatePermissionMode()` shows a warning toast: "Copilot does not support interactive permission prompts. Switch to Auto-Approve?" with an action button; clicking it updates `speckit.permissionMode` to `auto-approve` and the warning is not re-shown until the combination recurs.

### Spec-editor dispatch hides instructions from the terminal

**When** the user triggers a spec-editor AI dispatch
**Then** the visible terminal line is `<cli> "/sdd:specify <tempFilePath>"` (or the provider-equivalent), the markdown body and the Post-Specification instruction block are written into the temp file, and the AI still receives both when it reads the file.

### AGENTS.md collision is acceptable

**When** both OpenCode and Codex are configured against the same workspace and the user switches between them
**Then** the same `AGENTS.md` file is reused as the steering file for whichever provider is active — no error, no duplicate-file prompt — because the content is provider-agnostic.

## Non-Functional Requirements

- **NFR001** (SHOULD): Registry refactor preserves existing public behavior — `formatCommandForProvider.test.ts` and other existing tests pass unchanged without modification.
- **NFR002** (SHOULD): No regression in extension activation time; the validation/warning logic runs after activation completes (not blocking).

## Out of Scope

- A base class or inheritance hierarchy for providers (composition is preferred per spec 04).
- Visual redesign of the provider selection QuickPick beyond data-driven population.
- Auto-detection of installed providers on the user's machine.
- Migrating Gemini and Codex to the hidden-prompt-dispatch helper from #82 (left unchanged per that PR's decision); a `supportsHiddenPromptDispatch` capability flag is noted as a future extension but not implemented here.
