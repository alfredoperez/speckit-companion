# Tasks: Provider Registry

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-13

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Extend ProviderPaths interface and PROVIDER_PATHS entries — `src/ai-providers/aiProvider.ts` | R001
  - **Do**: Add `globalSteeringFile: string | null`, `configDir: string`, `quickPickIcon: string`, `quickPickDescription: string`, `supportsInteractivePermissions: boolean`, `autoApproveFlag: string` to `ProviderPaths`. Populate all six existing entries (Claude, Gemini, Copilot, Codex, Qwen) — Copilot gets `supportsInteractivePermissions: false` and a non-empty `autoApproveFlag`; others reflect their CLI reality.
  - **Verify**: `npm run compile` passes; no other file references break (TS will catch missing fields).

- [x] **T002** Add OPENCODE constant + PROVIDER_PATHS entry *(depends on T001)* — `src/core/constants.ts`, `src/ai-providers/aiProvider.ts` | R007
  - **Do**: Add `OPENCODE: 'opencode'` to `AIProviders`. Add `[AIProviders.OPENCODE]` entry to `PROVIDER_PATHS` with steering=`AGENTS.md`, agentsDir=`.opencode/agent`, agentsPattern=`*.md`, configDir=`.opencode`, mcpConfigPath=`.opencode/opencode.jsonc`, displayName='OpenCode', commandFormat='dot', appropriate icon/description, `supportsInteractivePermissions: true`.
  - **Verify**: `tsc` passes; `Object.keys(PROVIDER_PATHS).length === 6`.

- [x] **T003** Create OpenCode provider implementation *(depends on T002)* — `src/ai-providers/openCodeProvider.ts`, `src/ai-providers/index.ts` | R007
  - **Do**: Mirror `qwenCliProvider.ts` structure: `name`, `type = AIProviders.OPENCODE`, `isInstalled()` shells `opencode --version` (graceful ENOENT → false), `executeInTerminal`/`executeSlashCommand` use `dispatchSlashCommandViaTempFile`, `getPermissionFlag()` delegates (placeholder until T010). Add barrel export in `index.ts`.
  - **Verify**: `tsc` passes; `import { OpenCodeProvider } from './ai-providers'` resolves.
  - **Leverage**: `src/ai-providers/qwenCliProvider.ts`.

- [x] **T004** Replace factory switch with PROVIDER_CONSTRUCTORS lookup *(depends on T003)* — `src/ai-providers/aiProviderFactory.ts` | R002, R008
  - **Do**: Define `const PROVIDER_CONSTRUCTORS: Record<AIProviderType, () => IAIProvider> = { [AIProviders.CLAUDE]: () => new ClaudeCodeProvider(), ..., [AIProviders.OPENCODE]: () => new OpenCodeProvider() }`. Rewrite the create function to do `PROVIDER_CONSTRUCTORS[type]()`. Replace any hardcoded `getSupportedProviders()` body with `Object.keys(PROVIDER_PATHS) as AIProviderType[]`.
  - **Verify**: `tsc` passes; existing factory call sites still resolve all six providers.

- [x] **T005** Make promptForProviderSelection data-driven *(depends on T004)* — `src/ai-providers/aiProvider.ts` | R003
  - **Do**: Replace the hardcoded QuickPick array in `promptForProviderSelection()` with `Object.entries(PROVIDER_PATHS).map(([type, p]) => ({ label: \`${p.quickPickIcon} ${p.displayName}\`, description: p.quickPickDescription, value: type as AIProviderType }))`.
  - **Verify**: F5 → run "Choose AI Provider" command → all six providers appear with correct icons/descriptions.

- [x] **T006** Refactor steering sidebar to derive paths from registry *(depends on T005)* — `src/features/steering/steeringExplorerProvider.ts` | R004, R005, R007 (capability checks)
  - **Do**: Replace hardcoded `.claude/agents`, `.claude/skills` watcher patterns with values from `getProviderPaths()`. Replace `if (providerType === AIProviders.CLAUDE)` visibility checks with `if (providerPaths.agentsDir)` / `if (providerPaths.skillsDir)`. Remove the `getSteeringFilePaths` per-provider switch; resolve global path from `globalSteeringFile` and project from `steeringFile`.
  - **Verify**: F5 → switch provider Claude→Gemini in settings → sidebar reloads, Skills section hides for Gemini, no `.claude/` watcher remains active.

- [x] **T007** Rename steering manager methods *(depends on T006)* — `src/features/steering/steeringManager.ts`, `src/features/steering/steeringExplorerProvider.ts`, any other callers | R006
  - **Do**: Rename `createProjectClaudeMd` → `createProjectSteeringFile`, `createUserClaudeMd` → `createUserSteeringFile`. Update all call sites including command registrations in `steeringExplorerProvider.ts`. Use `Grep` for both old names to confirm zero remaining references.
  - **Verify**: `tsc` passes with zero references to the old names; commands still register.

- [x] **T008** Add appendToMarkdownFile to tempFileManager *(depends on T007)* — `src/features/spec-editor/tempFileManager.ts` | R009
  - **Do**: Add `async appendToMarkdownFile(filePath: string, content: string): Promise<void>` that does `fs.promises.appendFile(filePath, '\n\n' + content)`.
  - **Verify**: `tsc` passes; existing temp file callers unaffected.

- [x] **T009** Move Post-Specification instructions into temp file *(depends on T008)* — `src/features/spec-editor/specEditorProvider.ts` | R009, R010
  - **Do**: After `tempFileManager.createTempFileSet`, call `appendToMarkdownFile(tempPath, specContextInstruction)`. Change the dispatched line from `{command} {markdownContent}{specContextInstruction}` to `{command} {tempFilePath}` (single argument).
  - **Verify**: F5 → trigger spec-editor dispatch → terminal shows `<cli> "/sdd:specify <tempfile>"` only; the AI still receives full content (open the temp file to confirm append happened before dispatch).

- [x] **T010** Create permission validation + shared flag helper *(depends on T009)* — `src/ai-providers/permissionValidation.ts`, all five existing provider files + `openCodeProvider.ts` | R011, R012
  - **Do**: Create `permissionValidation.ts` exporting:
    - `getPermissionFlagForProvider(type: AIProviderType): string` — reads `readPermissionMode()`, returns `PROVIDER_PATHS[type].autoApproveFlag` when mode is `auto-approve` and flag is non-empty, else `''`.
    - `validatePermissionMode(context: vscode.ExtensionContext): Promise<void>` — when active provider has `supportsInteractivePermissions: false`, mode is `interactive`, and `autoApproveFlag` is non-empty, show warning toast with "Switch to Auto-Approve" button → updates `speckit.permissionMode` global setting.
    Update each provider's `getPermissionFlag()` to delegate to `getPermissionFlagForProvider(this.type)`.
  - **Verify**: `tsc` passes; unit-test (or manual) `getPermissionFlagForProvider('copilot')` returns flag only in auto-approve mode.

- [x] **T011** Wire validatePermissionMode into activation + setting changes *(depends on T010)* — `src/extension.ts` | R011
  - **Do**: After activation completes (non-blocking), call `validatePermissionMode(context)`. Subscribe to `vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('speckit.permissionMode') || e.affectsConfiguration('speckit.aiProvider')) validatePermissionMode(context); })`. Push subscription into `context.subscriptions`. Debounce repeated warnings via a `globalState` flag keyed on `${provider}-${mode}` so the same combo doesn't re-prompt within a session.
  - **Verify**: F5 → set Copilot + interactive → warning toast appears with action; click "Switch to Auto-Approve" → setting flips, warning gone; reopening window with same combo doesn't re-spam.

- [x] **T012** Update package.json (opencode enum + permission description) *(depends on T011)* — `package.json` | R007, R013
  - **Do**: Add `'opencode'` to `speckit.aiProvider.enum`; add matching `enumDescriptions` entry. Reword `speckit.permissionMode.description` to clarify that `interactive` is honored only by providers that support interactive permission prompts (e.g., Claude, Gemini); Copilot will be auto-switched.
  - **Verify**: F5 → settings UI shows OpenCode in dropdown; permissionMode help text updated.

- [x] **T013** Verify existing tests + manual scenario walkthrough *(depends on T012)* | NFR001, NFR002
  - **Do**: Run `npm test` (existing `formatCommandForProvider.test.ts` and others must pass unchanged). Add a tiny test asserting `getSupportedProviders()` returns all 6 keys and `getPermissionFlagForProvider('copilot')` mode behavior. Then F5 walk through every scenario in spec.md.
  - **Verify**: `npm test` green; all six spec scenarios behave as described; no regressions in steering sidebar across provider switches.

---

## Progress

- Phase 1: T001–T013 [x]
