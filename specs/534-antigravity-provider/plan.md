# Implementation Plan: Add Antigravity as an AI Provider

**Spec**: [spec.md](./spec.md) · **Tasks**: [tasks.md](./tasks.md)

## Summary

Add `antigravity` as an eleventh AI provider. It joins the terminal-CLI provider family (Codex/Gemini/Qwen/OpenCode), dispatching assembled SpecKit prompts to the `antigravity` CLI in an integrated terminal. The change is a mechanical extension of the existing provider abstraction plus the documentation/manifest surfaces the docs-consistency test guards.

## Technical Context

- **Language/stack**: TypeScript 5.3+ (ES2022, strict), VS Code Extension API, Webpack 5, Jest.
- **Provider abstraction** (`src/ai-providers/`): each provider is (a) a constant in `AIProviders` (`src/core/constants.ts`), (b) a `PROVIDER_PATHS` entry in `aiProvider.ts` validated at module load by `providerRegistry.ts`, (c) a dispatch class — terminal-CLI providers extend `CliTerminalProvider`, (d) an entry in `PROVIDER_CONSTRUCTORS` (`aiProviderFactory.ts`), and (e) a `package.json` enum + `enumItemLabels` + `enumDescriptions` triple.
- **Fallback safety**: `getConfiguredProviderType()` already guards unknown values (`configured in PROVIDER_PATHS ? … : CLAUDE`), and `AIProviderFactory.getProviderByType` falls back to Claude for an unmapped constructor. Adding a value strictly widens the maps; no guard weakens.

## Design Decisions

### Dispatch shape: terminal-CLI provider

Antigravity is chosen to extend `CliTerminalProvider` with the **default** `prepareDispatch` (no override), identical in shape to `QwenCliProvider`: write the prompt to a temp file, invoke `antigravity -p "$(cat <tmp>)"`, clean up. Rationale:

- The `ide-chat` path is reserved for the *host editor's own* built-in chat (Copilot/Cursor/Windsurf) detected at runtime; it owns no CLI and no config surface. Antigravity is a distinct external agent CLI, so it belongs with Codex/Gemini/Qwen, not IDE Chat.
- The default `CliTerminalProvider` dispatch (`-p ` prompt flag, temp-file substitution) is the smallest, most correctable footprint. The only Antigravity-specific facts are the `cliBinary` name and the install hint — isolated to the new provider file.

### `ProviderPaths` config (conservative)

Antigravity's steering/agents/skills/MCP layout is not verifiable from inside this repo, so the entry claims only what is safe:

- `steeringFile: 'AGENTS.md'`, `steeringPattern: 'AGENTS.md'`, `steeringDir: ''` (project-root AGENTS.md, the cross-tool agent-instruction convention) — mirrors the OpenCode/Codex minimal shape.
- `agentsDir/skillsDir/agentsPattern/skillsPattern: ''`, `supportsHooks: false` — nothing claimed that isn't confirmed.
- `mcpConfigPath: ''`, `globalSteeringFile: null`.
- `configDir: '.antigravity'`.
- `commandFormat: 'dot'` (the default for non-Claude CLIs).
- `quickPickIcon: '$(rocket)'`, a valid codicon that reads for "Antigravity".
- `supportsInteractivePermissions: true`, `autoApproveFlag: ''` (no verified auto-approve flag; permission handling stays neutral).

These secondary fields never affect the core dispatch and can be tightened once Antigravity's layout is confirmed.

## Files to Change

| File | Change |
|------|--------|
| `src/core/constants.ts` | Add `ANTIGRAVITY: 'antigravity'` to `AIProviders`. |
| `src/ai-providers/aiProvider.ts` | Add the `PROVIDER_PATHS[ANTIGRAVITY]` entry. |
| `src/ai-providers/antigravityCliProvider.ts` | New `AntigravityCliProvider extends CliTerminalProvider`. |
| `src/ai-providers/aiProviderFactory.ts` | Register in `PROVIDER_CONSTRUCTORS`. |
| `src/ai-providers/index.ts` | Export the new provider. |
| `package.json` | Add `antigravity` to the enum + label + description. |
| `README.md` | Add matrix column; bump "Ten" → "Eleven" provider counts. |
| `docs/architecture.md` | Bump count; name `antigravityCliProvider.ts` in the provider inventory. |
| `docs/how-it-works.md` | Bump count; add to provider list. |
| `CHANGELOG.md` | `[Unreleased]` user-facing entry. |
| `tests/integration/docs-consistency.test.ts` | Add `antigravity → antigravityCliProvider.ts` to `idToFile`; add `11: 'eleven'` to `wordForCount`. |
| `src/ai-providers/__tests__/antigravityProvider.test.ts` | New test: `antigravity` resolves to `AntigravityCliProvider` and is a valid enum value. |

## Verification

`npm run compile && npm test && npm run package`. The docs-consistency test is the primary guard that enum/matrix/count agree.
