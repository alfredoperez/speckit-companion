# Tasks: IDE Chat Provider

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** Register `ide-chat` in the provider constant — `src/core/constants.ts` | R001
  - **Do**: Add `IDE_CHAT: 'ide-chat'` to the `AIProviders` const so the new provider has a canonical key shared by the factory, paths map, and package.json enum.
  - **Verify**: `npm run compile` passes; `AIProviders.IDE_CHAT` resolves to `'ide-chat'`.
  - **Leverage**: existing entries in `AIProviders` (e.g. `CLAUDE_CODE`, `GEMINI`) — match the key/value casing convention.

- [x] **T002** Add IDE Chat path entry + widen `IAIProvider` return types — `src/ai-providers/aiProvider.ts` *(depends on T001)* | R001, R002
  - **Do**: Add `PROVIDER_PATHS[AIProviders.IDE_CHAT]` carrying only QuickPick metadata (`displayName: 'IDE Chat'`, icon `$(comment-discussion)`, a short description, `autoApproveFlag: ''`, `supportsInteractivePermissions: true`) with neutral/empty steering·agents·skills config. Widen `IAIProvider.executeInTerminal` and `executeSlashCommand` return types to `Promise<vscode.Terminal | undefined>`.
  - **Verify**: `npm run compile` passes with no errors at existing dispatch call sites (terminal tracker already tolerates `undefined`).
  - **Leverage**: an existing `PROVIDER_PATHS` entry (e.g. the Copilot CLI one) for the metadata shape; the current `IAIProvider` interface signatures for the return-type edit.

- [x] **T003** Implement `IdeChatProvider` — `src/ai-providers/ideChatProvider.ts` *(depends on T002)* | R002, R003, R004, R005, R006, NFR001
  - **Do**: Create `IdeChatProvider implements IAIProvider`. Add `detectHostIde` (read `vscode.env.appName`/`uriScheme` → `'vscode' | 'cursor' | 'windsurf'`) and `resolveChatCommand` (per-IDE ordered candidate list — base `workbench.action.chat.open` first, then fork candidates — verified against `vscode.commands.getCommands(true)`). Dispatch via `vscode.commands.executeCommand(cmdId, { query, isPartialQuery: true })`. `executeInTerminal`/`executeSlashCommand` dispatch and return `undefined`; `executeHeadless` dispatches and returns `{ exitCode: undefined }`; `isInstalled` returns whether a target resolved; `getPermissionFlag` returns `''`. Wrap all paths so nothing throws (NFR001); on no resolvable target show the R005 warning pointing back to a CLI provider; log detected IDE + chosen command to the output channel (R006).
  - **Verify**: `npm run compile` passes; class satisfies `IAIProvider` with no missing-member errors.
  - **Leverage**: `src/ai-providers/copilotCliProvider.ts` (constructor `(ctx, out)` shape, output-channel logging, `IAIProvider` member layout).

- [x] **T004** [P] Wire IDE Chat into the provider factory — `src/ai-providers/aiProviderFactory.ts` *(depends on T003)* | R001
  - **Do**: Add `[AIProviders.IDE_CHAT]: (ctx, out) => new IdeChatProvider(ctx, out)` to `PROVIDER_CONSTRUCTORS`.
  - **Verify**: `npm run compile` passes; `getAIProvider()` returns an `IdeChatProvider` when the setting is `ide-chat`.
  - **Leverage**: existing `PROVIDER_CONSTRUCTORS` entries in the same file.

- [x] **T005** [P] Export the new provider — `src/ai-providers/index.ts` *(depends on T003)* | R001
  - **Do**: Add `export * from './ideChatProvider';`.
  - **Verify**: `npm run compile` passes; `IdeChatProvider` is importable from `ai-providers`.
  - **Leverage**: the existing `export *` lines in `index.ts`.

- [x] **T006** [P] Add `ide-chat` to the setting enum — `package.json` | R001
  - **Do**: Add `"ide-chat"` to `contributes.configuration["speckit.aiProvider"].enum` and a matching `enumDescriptions` entry ("Route prompts to the host editor's built-in AI chat (Copilot / Cursor / Windsurf)").
  - **Verify**: `ide-chat` appears in the provider QuickPick; enum length matches `enumDescriptions` length.
  - **Leverage**: the existing CLI-provider entries in the same enum/enumDescriptions arrays.

- [x] **T007** [P] Test the provider behavior — `src/ai-providers/__tests__/ideChatProvider.test.ts` *(depends on T003)* | R002, R003, R005, NFR001
  - **Do**: BDD tests covering host detection per `appName`/`uriScheme`, command resolution picking the first available candidate, undetectable target → graceful `showWarningMessage` with no throw, `executeInTerminal` returns `undefined`, and `executeHeadless` returns `{ exitCode: undefined }`. Extend `tests/__mocks__/vscode.ts` with `env.appName`/`env.uriScheme` and `commands.getCommands`/`commands.executeCommand` as needed.
  - **Verify**: `npm test` passes for the new suite.
  - **Leverage**: `src/ai-providers/__tests__/providerRegistry.test.ts` (BDD layout) and `tests/__mocks__/vscode.ts` (mock-extension pattern).

- [x] **T008** [P] Document the IDE Chat provider — `README.md` | R001
  - **Do**: Add IDE Chat to the "Supported AI Providers" matrix and bump the stated provider count (e.g. "Six providers ship today").
  - **Verify**: README matrix lists IDE Chat; the count matches `package.json` enum length.
  - **Leverage**: the existing "Supported AI Providers" matrix rows.

## Phase 2: Auto-submit + spec-kit readiness (follow-up from manual testing)

- [x] **T009** Gate auto-submit on spec-kit readiness — `src/ai-providers/ideChatProvider.ts` | R007
  - **Do**: In `dispatchToChat`, set `isPartialQuery: false` (auto-submit) when `isWorkspaceSpecKitReady()` is true, else `true` (prefill). Add `isWorkspaceSpecKitReady()` delegating to `SpecKitDetector.checkWorkspaceInitialized()`.
  - **Verify**: `npm run compile`; happy-path test asserts `isPartialQuery: false`.
  - **Leverage**: `src/speckit/detector.ts` (`checkWorkspaceInitialized`).

- [x] **T010** Warn when spec-kit isn't initialized — `src/ai-providers/ideChatProvider.ts` | R007
  - **Do**: Add `warnSpecKitNotReady(host)` — `showWarningMessage` with an "Initialize SpecKit" action that runs `Commands.initWorkspace`; call it (fire-and-forget) on the not-ready branch. Log readiness to the output channel.
  - **Verify**: not-ready test asserts the warning fires and the prompt is prefilled (not submitted).
  - **Leverage**: `Commands.initWorkspace` (`src/core/constants.ts`); existing `SWITCH_TO_CLI_HINT` message pattern.

- [x] **T011** Tests for auto-submit + warn-when-not-ready — `src/ai-providers/__tests__/ideChatProvider.test.ts` | R007
  - **Do**: Stub `isWorkspaceSpecKitReady` via `jest.spyOn`; assert `isPartialQuery: false` when ready, and warning + `isPartialQuery: true` when not ready.
  - **Verify**: `npx jest ideChatProvider` passes.

- [x] **T012** Strip the context-update preamble before dispatch — `src/ai-providers/{promptBuilder,ideChatProvider,claudeCodeProvider}.ts` | R008
  - **Do**: Add `splitContextPreamble(prompt)` to `promptBuilder.ts` (single source of truth for the marker split); dispatch only `.command` from IDE Chat; refactor Claude's `splitPreambleFromPrompt` to delegate to it.
  - **Verify**: new test asserts a wrapped prompt dispatches only the `/speckit.*` command; full suite passes.
  - **Leverage**: existing `MARKER_CLOSE` in `promptBuilder.ts`; Claude's prior split logic.

- [x] **T013** Reduce the dispatched query for the host chat — `src/ai-providers/ideChatProvider.ts` | R008
  - **Do**: Add async `buildChatQuery` (+ `specNameFromPath`, `readSpecDescription`): shorten a single spec-dir path arg to the spec name; leave free-text/multi-token args alone; for `specify <temp.md>` read the file and inline the description (drop the `## Post-Specification` block). Apply to the dispatched query.
  - **Verify**: tests assert `/speckit.tasks <abs-path>` → `/speckit.tasks <spec-name>`, typed `specify` text is unchanged, and `specify <temp.md>` inlines the description.

- [x] **T014** Per-host command formatting + Antigravity host — `src/ai-providers/ideChatProvider.ts` | R003, R009
  - **Do**: Add `antigravity` to `HostIde`/candidates/labels/detection. Add `DASH_COMMAND_HOSTS` ({cursor, antigravity}) and `formatCommandForHost` converting `/speckit.X` → `/speckit-X` for those hosts; apply in `buildChatQuery`. Dot form stays for Copilot/Windsurf.
  - **Verify**: tests assert Windsurf dot, Cursor/Antigravity dash, and antigravity detection.
