# Tasks: Claude Code Panel Provider

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** Extract shared prompt-cleanup helpers — `src/ai-providers/promptBuilder.ts` | R004
  - **Do**: Add exported pure functions lifted from `ideChatProvider`: `readSpecDescription(filePath): Promise<string | null>` (read a specify temp `spec.md`, slice off the bookkeeping marker, return the description), `specNameFromPath(p): string` (last path segment, or its parent when the segment is a `.md` file), and `cleanCommandArg(command): Promise<string>` (split on first space; keep free-text/multi-token/non-path args as-is; inline `*specify <temp.md>` to `<description>` via `readSpecDescription`; otherwise shorten a spec-dir path arg to `specNameFromPath`). Do NOT reformat the command verb here — leave dot/dash formatting to callers.
  - **Verify**: `npm run compile` passes; functions exported from `promptBuilder.ts`.
  - **Leverage**: `src/ai-providers/ideChatProvider.ts` (`buildChatQuery`, `readSpecDescription`, `specNameFromPath`) — the exact logic to extract.

- [x] **T002** [P] Delegate IDE Chat arg cleanup to shared helpers *(depends on T001)* — `src/ai-providers/ideChatProvider.ts` | R004
  - **Do**: Replace the private `readSpecDescription`/`specNameFromPath` and the arg-cleanup branch of `buildChatQuery` with calls to the new `promptBuilder` helpers. Keep host-specific dot/dash verb formatting (`formatCommandForHost`) local. No observable behavior change.
  - **Verify**: `npx jest ideChatProvider` stays green.
  - **Leverage**: shared helpers from T001.

- [x] **T003** [P] Apply cleanup + finalize preamble in panel provider *(depends on T001)* — `src/ai-providers/claudePanelProvider.ts` | R002, R003, R004, R005, R007
  - **Do**: Run the dispatched command through `cleanCommandArg` before building the panel prefill so the prefilled text shows an inlined description / short spec name instead of absolute temp paths. Keep the URI-handler open, `isInstalled` check, and the "press Enter" notification. Resolve R005: keep the `@`-mention of the prompt file (carries the bookkeeping preamble) — the panel resolves workspace file paths — falling back gracefully if no workspace folder.
  - **Verify**: `npm run compile` passes; manual dispatch shows a clean prefilled command.
  - **Leverage**: shared helpers from T001; existing `splitContextPreamble`.

- [x] **T004** [P] Update README provider matrix + count — `README.md` | R008
  - **Do**: Add a `claude-panel` ("Claude Code (Panel)") column/row to the "Supported AI Providers" matrix and bump the provider count everywhere it's stated (Seven → Eight). Cross-check `package.json` enum already lists `claude-panel` (it does).
  - **Verify**: matrix + count consistent with the eight-provider enum.
  - **Leverage**: existing `ide-chat` row/column as the formatting template.

- [x] **T005** [P] Verify getAIProvider fresh-resolution fix — `src/extension.ts` | R006
  - **Do**: Confirm `getAIProvider()` resolves through `AIProviderFactory.getProvider(extensionContext, outputChannel)` on every call (already present on this branch). Sanity-check the factory caches by type so repeated calls don't rebuild providers, and that switching `speckit.aiProvider` applies without a window reload.
  - **Verify**: `npm run compile` passes; switching provider mid-session routes a viewer action to the new provider.
  - **Leverage**: `src/ai-providers/aiProviderFactory.ts` (`getProvider`, type cache).

- [x] **T006** Unit tests for the panel provider *(depends on T003)* — `src/ai-providers/__tests__/claudePanelProvider.test.ts` | R009
  - **Do**: New test file mirroring `ideChatProvider.test.ts`. Stub `vscode.extensions.getExtension` and `vscode.env.openExternal`. Cover: `isInstalled` true/false on extension presence; URI built with the running `uriScheme`; prefilled command is the cleaned form (description inlined, spec-dir path shortened); "press Enter" notification fires; no throw when the extension is absent or `openExternal` fails.
  - **Verify**: `npx jest claudePanelProvider` passes.
  - **Leverage**: `src/ai-providers/__tests__/ideChatProvider.test.ts` (mock setup, `tests/__mocks__/vscode.ts`).
