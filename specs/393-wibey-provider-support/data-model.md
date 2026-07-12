# Data Model: Wibey Provider Support

**Branch**: `393-wibey-provider-support` | **Date**: 2026-07-09

## Entity: `ProviderPaths` (existing shape — no changes)

Defined in `src/ai-providers/aiProvider.ts`. All fields are pre-existing; this feature only adds a new registry entry.

| Field | Type | Wibey CLI value | Notes |
|---|---|---|---|
| `steeringFile` | `string` | `'AGENTS.md'` | confirmed: `FILE_NAMES.AGENTS` in `paths.ts` |
| `globalSteeringFile` | `string \| null` | `null` | no global AGENTS.md; `~/.wibey/RULES.md` serves different purpose |
| `steeringDir` | `string` | `''` | steering file at project root, no subdir |
| `steeringPattern` | `string` | `'AGENTS.md'` | |
| `agentsDir` | `string` | `'.wibey/agents'` | confirmed: `PROJECT_PATHS.getAgentsDir()` |
| `agentsPattern` | `string` | `'*.md'` | |
| `skillsDir` | `string` | `'.wibey/skills'` | confirmed in this project + `getSkillsDir()` |
| `skillsPattern` | `string` | `'*/SKILL.md'` | confirmed in this project |
| `mcpConfigPath` | `string` | `'.wibey/.mcp.json'` | confirmed: `PROJECT_PATHS.getMcpConfigPath()` |
| `configDir` | `string` | `'.wibey'` | workspace-relative |
| `supportsHooks` | `boolean` | `true` | confirmed: `.wibey/hooks/hooks.json` |
| `displayName` | `string` | `'Wibey CLI'` | shown in all UI surfaces |
| `commandFormat` | `'dot' \| 'dash'` | `'dash'` | confirmed: `/speckit-specify` |
| `quickPickIcon` | `string` | `'$(hubot)'` | codicon |
| `quickPickDescription` | `string` | `"Walmart's built-in AI coding assistant…"` | shown in QuickPick |
| `supportsInteractivePermissions` | `boolean` | `true` | Wibey has SHIFT+TAB permission cycling |
| `autoApproveFlag` | `string` | `''` | no CLI flag; permission via settings.json |

---

## Entity: `AIProviders` constant (additive change)

```typescript
// src/core/constants.ts
WIBEY: 'wibey'
```

Derived type `AIProviderType` (`typeof AIProviders[keyof typeof AIProviders]`) automatically includes `'wibey'` — no separate type change needed.

---

## Entity: `WibeyCliProvider` class

| Property | Value |
|---|---|
| `name` | `'Wibey CLI'` |
| `type` | `AIProviders.WIBEY` (`'wibey'`) |
| Base class | `IAIProvider` directly (not `CliTerminalProvider`) |
| Terminal title | `'SpecKit - Wibey'` |
| Init delay | 6000 ms (TUI startup on new terminal) |
| Reuse strategy | Scan `vscode.window.terminals` for live "SpecKit - Wibey" terminal |
| Dispatch pattern | Start `wibey` interactively → `sendText(command, false)` → `sendText('', true)` |
| Slash command pattern | Same as dispatch — send `/speckit-specify` as text to the TUI input |
| ⚠️ Original design | `extends CliTerminalProvider` with `wibey -p "$(cat ...)"` — changed after macOS path-spaces bug and exit-on-complete issue |

---

## Entity: `package.json` schema additions

```json
{
  "speckit.aiProvider": {
    "enum": ["...", "wibey"],
    "enumItemLabels": ["...", "Wibey CLI"],
    "enumDescriptions": ["...", "Walmart's built-in AI coding assistant..."]
  }
}
```

**Backward compatibility**: existing stored values (`claude`, `gemini`, `copilot`, etc.) are unchanged. `wibey` is a new enum value — no migration needed.

---

## Deferred Entity: `WibeyPanelProvider` (Phase 2)

Not implemented in this feature. Blocked on `genaica/wibey-vscode-extension` adding `wibey.sendPrompt(text: string)`.

When available, shape mirrors `ClaudePanelProvider`:
- `EXTENSION_ID = 'wibey.wibey-vscode-extension'`
- `PROMPT_REL_PATH = '.wibey/speckit-companion-prompt.md'`
- `dispatch`: `vscode.commands.executeCommand('wibey.sendPrompt', panelPrompt)`
- `AIProviders.WIBEY_VSCODE: 'wibey-vscode'` (reserved in Phase 2)
