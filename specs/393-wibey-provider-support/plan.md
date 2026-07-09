# Implementation Plan: Wibey VSCode and Wibey CLI Provider Support

**Branch**: `393-wibey-provider-support` | **Date**: 2026-07-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/393-wibey-provider-support/spec.md`

## Summary

Register **Wibey CLI** (`wibey`) as a first-class AI provider in SpecKit Companion so Walmart developers can use Wibey natively for all SpecKit actions (Refine, workflow steps, inline comment resolution). Wibey CLI is built on the Claude Agent SDK, uses the `-p` prompt flag, and requires zero method overrides on `CliTerminalProvider`. A companion `wibey-vscode` panel provider is scoped out of Phase 1: `genaica/wibey-vscode-extension` v1.0.19 exposes no prompt-injection API — an InnerSource issue is opened as part of this work to request `wibey.sendPrompt(text)`.

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
import { AIProviders } from '../core/constants';
import { AIProviderType } from './aiProvider';
import { CliTerminalProvider } from './cliTerminalProvider';

/**
 * Wibey CLI provider — dispatches SpecKit commands to the Wibey CLI
 * (`wibey -p "…"`) in a VS Code terminal.
 *
 * Wibey CLI is built on the Claude Agent SDK and uses the same `-p` flag
 * for non-interactive prompt dispatch, so no method overrides are required.
 * The base CliTerminalProvider handles: install check (`wibey --version`),
 * terminal lifecycle (create/reuse), temp-file dispatch, and cleanup.
 *
 * NOTE — Phase 2: A WibeyPanelProvider for the `wibey-vscode` key is deferred
 * until genaica/wibey-vscode-extension exposes wibey.sendPrompt(text: string).
 */
export class WibeyCliProvider extends CliTerminalProvider {
    public readonly name = 'Wibey CLI';
    public readonly type: AIProviderType = AIProviders.WIBEY;

    protected readonly cliBinary = 'wibey';
    protected readonly installHint = {
        displayName: 'Wibey CLI',
        installCommand: 'curl -sSL https://wibey.walmart.com/cli/setup | bash',
    };
    protected readonly defaultTerminalTitle = 'SpecKit - Wibey';
    protected readonly headlessTerminalName = 'Wibey Background';
    protected readonly logPrefix = 'WibeyCliProvider';

    // No method overrides needed.
    // Dispatch: wibey -p "$(cat /tmp/prompt.md)"
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
