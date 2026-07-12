# Implementation Plan: Wibey VSCode and Wibey CLI Provider Support

**Branch**: `393-wibey-provider-support` | **Date**: 2026-07-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/393-wibey-provider-support/spec.md`

## Summary

Register **Wibey CLI** (`wibey`) and **Wibey (VS Code)** (`wibey-vscode`) as first-class AI providers in SpecKit Companion.

**Wibey CLI** — implements `IAIProvider` directly (outside the `CliTerminalProvider` hierarchy, same pattern as `GeminiCliProvider`). Starts `wibey` in interactive TUI mode, waits 6 seconds for the TUI to initialise, then sends the command as text. Reuses an existing "SpecKit - Wibey" terminal via `vscode.window.terminals` scan when available, avoiding a new process per dispatch.

**Wibey (VS Code)** — panel provider dispatching via a two-step runtime waterfall: (1) `wibey.sendPrompt(text)` command (auto-detected, requires genaica/wibey-vscode-extension#442); (2) clipboard + `wibey.openChat` fallback (works today). A URI-handler path was prototyped but disabled — `vscode.env.openExternal` returns `true` silently even without a registered handler, blocking the fallback.

> **Note**: The original design planned `WibeyCliProvider` to extend `CliTerminalProvider` with the `-p` flag and zero overrides. Real-world testing on macOS showed the headless `-p/-f` approach fails due to spaces in `~/Library/Application Support/...` paths, and also exits Wibey after each task. The interactive TUI approach was adopted instead (matching how `GeminiCliProvider` works).

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022, strict mode)

**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`); `CliTerminalProvider` (internal base class); `AIProviders` constants; `PROVIDER_PATHS` registry

**Storage**: Static — `package.json` `enum` / `enumItemLabels` / `enumDescriptions`; `PROVIDER_PATHS` in `aiProvider.ts`

**Testing**: Jest + ts-jest (`npm test`). `WibeyCliProvider` is a pure subclass with no logic — test coverage comes from the existing `CliTerminalProvider` contract tests. `PROVIDER_PATHS` validation is exercised by `validateProviderRegistry` at module load.

**Target Platform**: VS Code extension host (macOS, Windows, Linux, WSL)

**Project Type**: Single VS Code extension

**Performance Goals**: N/A — provider registration is static; no runtime cost

**Constraints**: Stored setting values must remain unchanged for all existing providers; `ProviderPaths` shape must pass `validateProviderRegistry` without error

**Scale/Scope**: 5 files changed, ~60 lines of new code

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| Extensibility and Configuration | ✅ PASS | New `IAIProvider` implementation created; no existing provider logic modified |
| Spec-Driven Workflow | ✅ PASS | Feature enhances the spec pipeline by supporting Walmart's primary AI tool |
| Visual and Interactive | ✅ PASS | Provider appears in sidebar config tree and QuickPick with friendly label |
| Modular Architecture | ✅ PASS | Single focused file `wibeyCliProvider.ts`; shared logic stays in `CliTerminalProvider` |
| AI Provider Integration | ✅ PASS | New `IAIProvider` implementation created; `autoApproveFlag: ''` correct for no-flag providers |

## Project Structure

### Documentation (this feature)

```text
specs/393-wibey-provider-support/
├── spec.md              # Requirements (FR-002 deferred to Phase 2)
├── plan.md              # This file
├── research.md          # Phase 0 findings (all 4 open questions resolved)
├── data-model.md        # ProviderPaths entry shape
├── quickstart.md        # End-to-end validation guide
└── tasks.md             # Phase 2 output (/speckit-tasks — not yet created)
```

### Source Code (files changed)

```text
src/core/
└── constants.ts
    └── AIProviders: add WIBEY: 'wibey'

src/ai-providers/
├── aiProvider.ts
│   └── _PROVIDER_PATHS_RAW: add [AIProviders.WIBEY] entry
├── wibeyCliProvider.ts              ← NEW FILE
│   └── class WibeyCliProvider extends CliTerminalProvider
└── aiProviderFactory.ts
    └── PROVIDER_CONSTRUCTORS: add [AIProviders.WIBEY]

package.json
└── contributes.configuration["speckit.aiProvider"]
    ├── enum: add "wibey"
    ├── enumItemLabels: add "Wibey CLI"
    └── enumDescriptions: add description
```

## Approach

### Change 1 — `src/core/constants.ts`: Add `WIBEY` constant

```typescript
export const AIProviders = {
    CLAUDE: 'claude',
    GEMINI: 'gemini',
    COPILOT: 'copilot',
    CODEX: 'codex',
    QWEN: 'qwen',
    OPENCODE: 'opencode',
    IDE_CHAT: 'ide-chat',
    CLAUDE_VSCODE: 'claude-vscode',
    WIBEY: 'wibey',           // ← add
} as const;
```

---

### Change 2 — `src/ai-providers/aiProvider.ts`: Add `PROVIDER_PATHS` entry

Add to `_PROVIDER_PATHS_RAW` after the `CLAUDE_VSCODE` entry:

```typescript
[AIProviders.WIBEY]: {
    steeringFile: 'AGENTS.md',           // confirmed: FILE_NAMES.AGENTS in paths.ts
    globalSteeringFile: null,            // no global AGENTS.md; ~/.wibey/RULES.md serves a different purpose
    steeringDir: '',                     // steering file lives at project root, no subdirectory
    steeringPattern: 'AGENTS.md',
    agentsDir: '.wibey/agents',          // confirmed: PROJECT_PATHS.getAgentsDir()
    agentsPattern: '*.md',
    skillsDir: '.wibey/skills',          // confirmed: PROJECT_PATHS.getSkillsDir()
    skillsPattern: '*/SKILL.md',         // confirmed from active .wibey/ in this project
    mcpConfigPath: '.wibey/.mcp.json',   // confirmed: PROJECT_PATHS.getMcpConfigPath() → .wibey/.mcp.json
    configDir: '.wibey',
    supportsHooks: true,                  // confirmed: WIBEY_PATHS.HOOKS_CONFIG = ~/.wibey/hooks/hooks.json
    displayName: 'Wibey CLI',
    commandFormat: 'dash',               // confirmed: /speckit-specify, /flux-commit, etc.
    quickPickIcon: '$(hubot)',
    quickPickDescription: "Walmart's built-in AI coding assistant — terminal mode with full SDD support",
    supportsInteractivePermissions: true,
    autoApproveFlag: '',                  // no CLI flag; --append-system-prompt NOT supported; permission via settings.json
},
```

---

### Change 3 — `src/ai-providers/wibeyCliProvider.ts`: New provider class

```typescript
// Implements IAIProvider directly (not CliTerminalProvider).
// Interactive TUI mode: starts `wibey`, waits 6s for TUI to load,
// then sends the command as text. Reuses existing "SpecKit - Wibey"
// terminal via vscode.window.terminals scan.
export class WibeyCliProvider implements IAIProvider {
    public readonly name = 'Wibey CLI';
    public readonly type = AIProviders.WIBEY;
    private static readonly TERMINAL_TITLE = 'SpecKit - Wibey';
    private static readonly INIT_DELAY_MS = 6000;

    private findOrCreateTerminal() { /* scans vscode.window.terminals */ }

    async executeInTerminal(prompt: string): Promise<vscode.Terminal> {
        const { terminal, isNew } = this.findOrCreateTerminal();
        if (isNew) {
            terminal.sendText('wibey', true);
            setTimeout(() => terminal.sendText(command, false), 6000);
            setTimeout(() => terminal.sendText('', true), 6200);
        } else {
            terminal.sendText(command, false);
            setTimeout(() => terminal.sendText('', true), 200);
        }
        return terminal;
    }
}
```

---

### Change 4 — `src/ai-providers/aiProviderFactory.ts`: Wire constructor

```typescript
import { WibeyCliProvider } from './wibeyCliProvider';   // add import

const PROVIDER_CONSTRUCTORS: Record<AIProviderType, ProviderConstructor> = {
    // ... existing entries ...
    [AIProviders.WIBEY]: (ctx, out) => new WibeyCliProvider(ctx, out),  // add
};
```

---

### Change 5 — `package.json`: Add enum entry

In `contributes.configuration["speckit.aiProvider"]`, append to all three arrays:

```json
"enum": [...existing..., "wibey"],
"enumItemLabels": [...existing..., "Wibey CLI"],
"enumDescriptions": [
  "...existing descriptions...",
  "Walmart's built-in AI coding assistant — dispatches SpecKit commands to the Wibey CLI in a VS Code terminal"
]
```

---

## Phase 2 Gate: InnerSource issue for `wibey.sendPrompt`

Open an issue on `genaica/wibey-vscode-extension`:

**Title**: `feat: expose wibey.sendPrompt(text: string) command for external extension integration`

**Body**:
> SpecKit Companion needs to pre-fill the Wibey chat panel with a slash command when the user clicks Refine or runs a workflow step. `wibey.addSelectionToChat` adds code context, not command text in the input area. A `wibey.sendPrompt` command that sets the chat input and focuses the panel would unblock the `wibey-vscode` provider in `speckit-companion`.
>
> Proposed implementation (in `extension.ts`):
> ```typescript
> vscode.commands.registerCommand('wibey.sendPrompt', async (text: string) => {
>     await vscode.commands.executeCommand('wibey.chatView.focus');
>     await new Promise(resolve => setTimeout(resolve, 100));
>     chatPanel.getWebviewController().postMessage({ type: 'prefillInput', text });
> });
> ```
> Plus webview store/reducer: `case 'prefillInput': setChatInputText(message.text)`

---

## Implementation notes

- `validateProviderRegistry` runs at module load and throws `ProviderRegistryError` on invalid `commandFormat`, empty `displayName`, or `autoApproveFlag` without trailing space. The new entry must pass all checks (`commandFormat: 'dash'`, non-empty `displayName`, `autoApproveFlag: ''`).
- **`steeringFile: 'AGENTS.md'`** — confirmed from `src/constants/paths.ts` `FILE_NAMES.AGENTS`. No verification needed; `hasProjectConfig()` also checks `CLAUDE.md` so both files are recognized.
- **`wibey --version`** — confirmed supported in CLI help text. No override of `isInstalled()` needed.
- **`--append-system-prompt` NOT supported** — confirmed absent from Wibey CLI flags list. The default `prepareDispatch` (no override) is correct for Phase 1.
- **Phase 1.5 optimization**: Wibey CLI supports `--prompt-file / -f` which reads the prompt directly from a file path. Override `prepareDispatch` to emit `wibey -f "/tmp/prompt.md"` instead of `wibey -p "$(cat "/tmp/prompt.md")"` — shell-agnostic and cmd.exe-safe without special escaping.
