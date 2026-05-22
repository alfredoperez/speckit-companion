# Plan: Claude Code Panel Provider

**Spec**: [spec.md](./spec.md)

## Approach

The provider scaffolding already exists on this branch (`feat/claude-panel-provider`): the `CLAUDE_PANEL` constant, a `PROVIDER_PATHS` entry mirroring `claude`, the factory constructor, the `index.ts` export, the `package.json` enum/enumDescriptions, the `ClaudePanelProvider` class (URI-handler open + "press Enter" notification), and the `getAIProvider()` fresh-resolution fix in `extension.ts`. This plan **completes** that PoC rather than starting from scratch.

The one real code gap is prefilled-command cleanup. The cleanup logic (inline a new-spec description from the temp `spec.md`, shorten spec-dir path arguments to just the spec name) currently lives as private methods inside `ideChatProvider`. The key decision: **extract those into shared pure functions in `promptBuilder.ts`** so both `ideChatProvider` and `ClaudePanelProvider` consume them — no duplication, and `ideChatProvider`'s observable behavior stays identical. The panel receives commands already in dash form (its `commandFormat` is `dash`), so it only needs the argument cleanup, not verb reformatting.

The `.spec-context.json` preamble handling (R005) hinges on one empirical question — does an `@`-mention inside a prefilled prompt attach the file as context, or land as literal text? This is resolved by a manual smoke test during implement; the code keeps the `@`-mention if it attaches, otherwise drops the preamble entirely like `ide-chat`.

## Files

### Create

- `src/ai-providers/__tests__/claudePanelProvider.test.ts` — unit tests mirroring `ideChatProvider.test.ts`: `isInstalled` true/false on extension presence, prefilled-command cleanup (description inlined, spec-dir path shortened), graceful no-throw when the extension is absent or `openExternal` fails.

### Modify

- `src/ai-providers/promptBuilder.ts` — add exported pure helpers extracted from `ideChatProvider`: `readSpecDescription(filePath)`, `specNameFromPath(path)`, and a `cleanCommandArg(command)` that inlines a `specify <temp.md>` description and shortens spec-dir path args. Async where file reads are needed.
- `src/ai-providers/ideChatProvider.ts` — delegate `buildChatQuery`'s arg cleanup to the new shared helpers (keep host-specific dot/dash verb formatting local). No behavior change.
- `src/ai-providers/claudePanelProvider.ts` — run the prefilled command through `cleanCommandArg` before building the panel prompt; finalize preamble handling per the `@`-mention smoke-test result.
- `README.md` — add a `claude-panel` column to the "Supported AI Providers" matrix and bump the provider count everywhere it's stated (Seven → Eight).

## Testing Strategy

- **Unit**: Jest + `tests/__mocks__/vscode.ts`. Stub `vscode.extensions.getExtension` and `vscode.env.openExternal`; assert the URI is built with the running `uriScheme`, the cleaned command is what gets prefilled, and the "press Enter" notification fires.
- **Regression**: re-run `ideChatProvider.test.ts` after the helper extraction to confirm IDE Chat is unchanged.
- **Manual smoke test**: with the Claude Code extension installed, dispatch each step from the panel provider and confirm (a) the panel opens prefilled, (b) the command reads cleanly (no absolute temp paths), and (c) whether an `@`-mentioned prompt file attaches as context — this decides R005.

## Risks

- `@`-mention lands as literal text rather than attached context: drop the preamble entirely (panel loses `.spec-context.json` bookkeeping, an accepted trade-off matching `ide-chat`).
- Helper extraction regresses IDE Chat: mitigated by keeping the extracted functions pure and re-running `ideChatProvider.test.ts`.
